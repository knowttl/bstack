import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { resolveTarget } from '../lib/repo.ts'
import { resolvePath } from '../lib/paths.ts'
import { CommandError } from '../lib/result.ts'
import { readKitPlan, readySeconds } from '../lib/kit.ts'
import type { ChildProcess } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import type { KitPlan } from '../lib/kit.ts'
import type { CommandSpec } from '../lib/render.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn, Problem } from '../lib/result.ts'

// A single doctor or drive command that outlives this limit is stuck, not slow.
const commandTimeoutMs = 120000
// Output beyond this size adds noise to the evidence record without adding proof.
const outputLimit = 65536
// A launched process that ignores the first termination signal is killed after this wait.
const terminationGraceMs = 5000

type Values = { port: number; runDir: string; evidenceDir: string }

type Prepared = { argv: string[]; cwd: string; env: NodeJS.ProcessEnv }

type Output = { stdout: string; stderr: string; error?: string }

type Run = { child: ChildProcess; output: Output; command: string[]; exit: number | null; finished: boolean; exited?: Promise<number | null> }

type Capture = Output & { command: string[]; exit: number | null; timedOut: boolean }

type ProofRecord = {
  app: string; feature: string; runId: string; launch: (Output & { command: string[]; exit: number | null }) | null; doctor: Capture | null
  steps: (Capture & { label: string; matched: boolean; missingArtifacts: string[] })[]; cleanup: Capture | null
}

function failure(code: string, message: string, fix: string) {
  return { code, message, fix }
}

function proofJSON(record: ProofRecord) {
  return `${JSON.stringify(record, (key, value) => (key === 'stdout' || key === 'stderr') && typeof value === 'string' ? value.slice(-outputLimit) : value, 2)}\n`
}

function freePort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolvePort(port))
    })
  })
}

function substitute(value: string, values: Values) {
  return value.replace(/\{(port|runDir|evidenceDir)\}/g, (_, name: keyof Values) => String(values[name]))
}

function prepare(spec: CommandSpec, values: Values, root: string): Prepared {
  return { argv: spec.command.map(word => substitute(word, values)), cwd: resolve(root, spec.cwd ?? '.'),
    env: { ...process.env, ...Object.fromEntries(Object.entries(spec.env ?? {}).map(([key, value]) => [key, substitute(value, values)])) } }
}

function start({ argv, cwd, env }: Prepared) {
  const output: Output = { stdout: '', stderr: '' }
  const child = spawn(argv[0], argv.slice(1), { cwd, env, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const run: Run = { child, output, command: argv, exit: null, finished: false }
  for (const stream of ['stdout', 'stderr'] as const) {
    child[stream].setEncoding('utf8')
    child[stream].on('data', chunk => { output[stream] += chunk })
  }
  run.exited = new Promise<number | null>(done => {
    const finish = (code: number | null) => { run.exit = code; run.finished = true; done(code) }
    child.once('error', error => { output.error = error.message; finish(null) })
    child.once('close', code => finish(code ?? 1))
  })
  child.once('exit', code => { run.exit = code ?? 1 })
  return run
}

function stop(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') {
  if (!child.pid) return
  try { process.kill(-child.pid, signal) } catch (error: any) { if (error.code !== 'ESRCH') throw error }
}

async function terminate(run: Run) {
  const grace = setTimeout(() => stop(run.child, 'SIGKILL'), terminationGraceMs)
  try {
    stop(run.child)
    await run.exited
  } finally {
    clearTimeout(grace)
    stop(run.child, 'SIGKILL')
  }
}

async function capture(spec: Prepared): Promise<Capture> {
  const run = start(spec)
  let timedOut = false
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([run.exited, new Promise<void>(done => {
      timer = setTimeout(() => { timedOut = true; done() }, commandTimeoutMs)
    })])
  } finally {
    clearTimeout(timer)
    await terminate(run)
  }
  return { command: spec.argv, exit: timedOut ? null : run.exit, timedOut, ...run.output }
}

async function launch(run: Run, plan: KitPlan, values: Values) {
  const deadline = Date.now() + readySeconds(plan) * 1000
  const { url, output } = plan.launch.ready
  while (Date.now() < deadline) {
    const ready = output ? new RegExp(output).test(run.output.stdout + run.output.stderr)
      : await fetch(substitute(url!, values), { signal: AbortSignal.timeout(1000) }).then(response => response.ok, () => false)
    if ((run.exit !== null && run.exit !== 0) || (run.finished && output && !ready) || run.output.error) return failure('launch-exited', `The launch command exited before it was ready: ${(run.output.error ?? run.output.stderr).slice(-500)}`, 'Fix the launch command or its prerequisites; report a product blocker instead of editing product code.')
    if (ready) return
    await new Promise(done => setTimeout(done, 100))
  }
  return failure('launch-not-ready', `The launch command was not ready within ${readySeconds(plan)} seconds.`, 'Correct the ready condition or the launch command.')
}

async function evidenceHashes(directory: string) {
  const hashes: [string, string | null][] = []
  async function visit(path: string, ancestors: Set<string>) {
    const info = await stat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error })
    if (info?.isDirectory()) {
      const actual = await realpath(path)
      if (ancestors.has(actual)) return
      const parents = new Set(ancestors).add(actual)
      for (const name of await readdir(path)) await visit(join(path, name), parents)
    } else {
      const bytes = await readFile(path).catch(error => { if (error.code === 'ENOENT') return null; throw error })
      hashes.push([relative(directory, path), bytes === null ? null : createHash('sha256').update(bytes).digest('hex')])
    }
  }
  await visit(directory, new Set())
  return hashes.sort(([a], [b]) => a.localeCompare(b))
}

export async function run(options: Options<'app' | 'feature'>) {
  const target = await resolveTarget(options)
  if (!options.app || !options.feature) throw new CommandError('usage-error', [{ code: 'missing-option', message: '--app and --feature are required.', fix: 'Supply --app <name> --feature <id>.' }])
  const plan = await readKitPlan(target.root, options.app)
  const feature = plan.features.find(item => item.id === options.feature)
  if (!feature) throw new CommandError('usage-error', [{ code: 'unknown-feature', message: `The kit has no feature ${options.feature}.`, fix: `Use one of: ${plan.features.map(item => item.id).join(', ')}.` }])
  const evidenceRoot = await resolvePath(target.root, plan.evidence.directory, undefined, true)
  const runId = randomUUID().slice(0, 8)
  const values = { port: await freePort(), runDir: await mkdtemp(join(tmpdir(), `verify-${plan.app}-`)), evidenceDir: join(evidenceRoot, runId) }
  const record: ProofRecord = { app: plan.app, feature: feature.id, runId, launch: null, doctor: null, steps: [], cleanup: null }
  const problems: Problem[] = []
  let launched: Run | undefined
  const recordPath = join(values.evidenceDir, `${feature.id}.json`)
  const reservation = proofJSON(record)
  let reserved = false
  const launchRecord = () => launched ? { command: launched.command, exit: launched.exit, ...launched.output } : null
  try {
    await mkdir(values.evidenceDir, { recursive: true })
    await writeFile(recordPath, reservation, { flag: 'wx' })
    reserved = true
    launched = start(prepare(plan.launch, values, target.root))
    const problem = await launch(launched, plan, values)
    if (problem) problems.push(problem)
    else {
      record.doctor = await capture(prepare(plan.doctor, values, target.root))
      if (record.doctor.exit !== 0) problems.push(failure('doctor-failed', `Doctor exited ${record.doctor.exit}: ${record.doctor.stdout.slice(-300)}${record.doctor.stderr.slice(-300)}`, 'Fix the instance or the doctor command before driving.'))
      else {
        for (const step of feature.steps) {
          const result = await capture(prepare(step, values, target.root))
          const missing = []
          for (const artifact of step.artifacts ?? []) if (!await stat(resolve(target.root, substitute(artifact, values))).then(info => info.isFile(), () => false)) missing.push(artifact)
          const matched = new RegExp(step.match).test(result.stdout)
          record.steps.push({ label: step.label, ...result, matched, missingArtifacts: missing })
          if (result.exit !== 0) problems.push(failure('step-failed', `Step "${step.label}" exited ${result.exit}: ${result.stderr.slice(-300)}`, 'Fix the harness or report the product bug; never weaken the step.'))
          else if (!matched) problems.push(failure('step-mismatch', `Step "${step.label}" output does not match ${step.match}.`, 'Compare the observed output with the feature file; report drift or a product bug.'))
          else if (missing.length) problems.push(failure('artifact-missing', `Step "${step.label}" did not produce: ${missing.join(', ')}.`, 'Make the harness write the declared artifacts.'))
          if (problems.length) break
        }
      }
    }
  } finally {
    let before
    try {
      record.launch = launchRecord()
      if (reserved) {
        if (await readFile(recordPath, 'utf8') !== reservation) problems.push(failure('evidence-collision', `A command replaced the reserved proof record: ${relative(target.root, recordPath)}.`, 'Write captured artifacts to a different path from the proof record.'))
        else await writeFile(recordPath, proofJSON(record))
      }
      before = await evidenceHashes(values.evidenceDir)
    } finally {
      try {
        if (launched) {
          if (((launched.exit !== null && launched.exit !== 0) || launched.output.error) && !problems.some(problem => problem.code === 'launch-exited')) problems.push(failure('launch-exited', `The launch command exited unsuccessfully: ${launched.exit}.`, 'Fix the launch command or report a product blocker.'))
          await terminate(launched)
        }
      } finally {
        try {
          if (plan.cleanup.command) {
            record.cleanup = await capture(prepare(plan.cleanup as CommandSpec, values, target.root))
            if (record.cleanup.exit !== 0) problems.push(failure('cleanup-failed', `Cleanup exited ${record.cleanup.exit}: ${record.cleanup.stderr.slice(-300)}`, 'Fix the cleanup command so it leaves nothing running.'))
          }
        } finally {
          await rm(values.runDir, { recursive: true, force: true })
        }
      }
    }
    const after = await evidenceHashes(values.evidenceDir)
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      problems.push(failure('evidence-lost', 'Evidence changed or disappeared during cleanup.', 'Make cleanup remove only what the run started, never the evidence directory.'))
    } else if (reserved && !problems.some(problem => problem.code === 'evidence-collision')) {
      record.launch = launchRecord()
      await writeFile(recordPath, proofJSON(record))
    }
  }
  const after = await evidenceHashes(values.evidenceDir)
  const data = { runId, evidenceDirectory: relative(target.root, values.evidenceDir),
    evidence: after.map(([path, sha256]) => ({ path, sha256 })), steps: record.steps.map(step => ({ label: step.label, exit: step.exit })) }
  if (problems.length) throw new CommandError('failed', problems, data)
  return { inputs: { target, app: plan.app, feature: feature.id }, data } satisfies CommandReturn
}
