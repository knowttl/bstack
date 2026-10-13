import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolvePath } from '../lib/paths.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { CommandError } from '../lib/result.mjs'
import { kitDirectory, readySeconds, validateKitPlan } from '../lib/kit.mjs'

// A single doctor or drive command that outlives this limit is stuck, not slow.
const commandTimeoutMs = 120000
// Output beyond this size adds noise to the evidence record without adding proof.
const outputLimit = 65536
// A launched process that ignores the first termination signal is killed after this wait.
const terminationGraceMs = 5000

function failure(code, message, fix) {
  return { code, message, fix }
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })
}

function substitute(value, values) {
  return value.replace(/\{(port|runDir|evidenceDir)\}/g, (_, name) => String(values[name]))
}

function prepare(spec, values, root) {
  return { argv: spec.command.map(word => substitute(word, values)), cwd: resolve(root, spec.cwd ?? '.'),
    env: { ...process.env, ...Object.fromEntries(Object.entries(spec.env ?? {}).map(([key, value]) => [key, substitute(value, values)])) } }
}

function start({ argv, cwd, env }) {
  const output = { stdout: '', stderr: '' }
  const child = spawn(argv[0], argv.slice(1), { cwd, env, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const run = { child, output, command: argv, exit: null, finished: false }
  for (const stream of ['stdout', 'stderr']) {
    child[stream].setEncoding('utf8')
    child[stream].on('data', chunk => { output[stream] = (output[stream] + chunk).slice(-outputLimit) })
  }
  run.exited = new Promise(done => {
    const finish = code => { run.exit = code; run.finished = true; done(code) }
    child.once('error', error => { output.error = error.message; finish(null) })
    child.once('close', code => finish(code ?? 1))
  })
  child.once('exit', code => { run.exit = code ?? 1; run.finished = true })
  return run
}

function stop(child, signal = 'SIGTERM') {
  if (!child.pid) return
  try { process.kill(-child.pid, signal) } catch (error) { if (error.code !== 'ESRCH') throw error }
}

async function terminate(run) {
  const grace = setTimeout(() => stop(run.child, 'SIGKILL'), terminationGraceMs)
  try {
    stop(run.child)
    await run.exited
  } finally {
    clearTimeout(grace)
    stop(run.child, 'SIGKILL')
  }
}

async function capture(spec) {
  const run = start(spec)
  let timedOut = false
  let timer
  try {
    await Promise.race([run.exited, new Promise(done => {
      timer = setTimeout(() => { timedOut = true; done() }, commandTimeoutMs)
    })])
  } finally {
    clearTimeout(timer)
    await terminate(run)
  }
  return { command: spec.argv, exit: timedOut ? null : run.exit, timedOut, ...run.output }
}

async function launch(run, plan, values) {
  const deadline = Date.now() + readySeconds(plan) * 1000
  const { url, output } = plan.launch.ready
  while (Date.now() < deadline) {
    const ready = output ? new RegExp(output).test(run.output.stdout + run.output.stderr)
      : await fetch(substitute(url, values), { signal: AbortSignal.timeout(1000) }).then(response => response.ok, () => false)
    if (run.finished && (run.exit !== 0 || !ready)) return failure('launch-exited', `The launch command exited before it was ready: ${(run.output.error ?? run.output.stderr).slice(-500)}`, 'Fix the launch command or its prerequisites; report a product blocker instead of editing product code.')
    if (ready) return
    await new Promise(done => setTimeout(done, 100))
  }
  return failure('launch-not-ready', `The launch command was not ready within ${readySeconds(plan)} seconds.`, 'Correct the ready condition or the launch command.')
}

async function evidenceHashes(directory) {
  const hashes = []
  async function visit(path, ancestors) {
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

export async function run(options) {
  const target = await resolveTarget(options)
  if (!options.app || !options.feature) throw new CommandError('usage-error', [{ code: 'missing-option', message: '--app and --feature are required.', fix: 'Supply --app <name> --feature <id>.' }])
  const kitFile = join(target.root, kitDirectory(options.app), 'kit.json')
  let plan
  try { plan = inspectJSON(await readFile(kitFile, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('blocked', [{ code: 'kit-unavailable', message: `No readable kit at ${kitDirectory(options.app)}/kit.json.`, fix: 'Apply the scaffolded kit first.' }])
  }
  validateKitPlan(plan)
  const feature = plan.features.find(item => item.id === options.feature)
  if (!feature) throw new CommandError('usage-error', [{ code: 'unknown-feature', message: `The kit has no feature ${options.feature}.`, fix: `Use one of: ${plan.features.map(item => item.id).join(', ')}.` }])
  const evidenceRoot = await resolvePath(target.root, plan.evidence.directory, undefined, true)
  const runId = randomUUID().slice(0, 8)
  const values = { port: await freePort(), runDir: await mkdtemp(join(tmpdir(), `verify-${plan.app}-`)), evidenceDir: join(evidenceRoot, runId) }
  const record = { app: plan.app, feature: feature.id, runId, launch: null, doctor: null, steps: [], cleanup: null }
  const problems = []
  let launched
  const recordPath = join(values.evidenceDir, `${feature.id}.json`)
  const reservation = `${JSON.stringify(record, null, 2)}\n`
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
        else await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`)
      }
      before = await evidenceHashes(values.evidenceDir)
    } finally {
      try {
        if (launched) {
          if (launched.finished && launched.exit !== 0 && !problems.some(problem => problem.code === 'launch-exited')) problems.push(failure('launch-exited', `The launch command exited unsuccessfully: ${launched.exit}.`, 'Fix the launch command or report a product blocker.'))
          await terminate(launched)
        }
      } finally {
        try {
          if (plan.cleanup.command) {
            record.cleanup = await capture(prepare(plan.cleanup, values, target.root))
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
      await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`)
    }
  }
  const after = await evidenceHashes(values.evidenceDir)
  if (problems.length) throw new CommandError('failed', problems)
  return { inputs: { target, app: plan.app, feature: feature.id }, data: { runId, evidenceDirectory: relative(target.root, values.evidenceDir),
    evidence: after.map(([path, sha256]) => ({ path, sha256 })), steps: record.steps.map(step => ({ label: step.label, exit: step.exit })) } }
}
