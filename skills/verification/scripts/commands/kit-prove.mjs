import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
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
  for (const stream of ['stdout', 'stderr']) {
    child[stream].on('data', chunk => { output[stream] = (output[stream] + chunk).slice(-outputLimit) })
  }
  const exited = new Promise(done => {
    child.once('error', error => { output.error = error.message; done(null) })
    child.once('close', code => done(code ?? 1))
  })
  return { child, output, exited }
}

function stop(child) {
  if (!child.pid) return
  try { process.kill(-child.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
}

async function capture(spec) {
  const { child, output, exited } = start(spec)
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; stop(child) }, commandTimeoutMs)
  const exit = await exited
  clearTimeout(timer)
  try { process.kill(-child.pid, 'SIGKILL') } catch {}
  return { command: spec.argv, exit: timedOut ? null : exit, timedOut, ...output }
}

async function launch(spec, plan, values) {
  const run = start(spec)
  const deadline = Date.now() + readySeconds(plan) * 1000
  const { url, output } = plan.launch.ready
  let early = false
  run.exited.then(() => { early = true })
  while (Date.now() < deadline) {
    if (early) return { run, problem: failure('launch-exited', `The launch command exited before it was ready: ${(run.output.error ?? run.output.stderr).slice(-500)}`, 'Fix the launch command or its prerequisites; report a product blocker instead of editing product code.') }
    if (output ? new RegExp(output).test(run.output.stdout + run.output.stderr)
      : await fetch(substitute(url, values), { signal: AbortSignal.timeout(1000) }).then(response => response.ok, () => false)) return { run }
    await new Promise(done => setTimeout(done, 100))
  }
  return { run, problem: failure('launch-not-ready', `The launch command was not ready within ${readySeconds(plan)} seconds.`, 'Correct the ready condition or the launch command.') }
}

async function evidenceHashes(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true }).catch(() => [])
  const hashes = []
  for (const entry of entries.filter(entry => entry.isFile())) {
    const path = join(entry.parentPath, entry.name)
    hashes.push([relative(directory, path), createHash('sha256').update(await readFile(path)).digest('hex')])
  }
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
  const record = { app: plan.app, feature: feature.id, runId, doctor: null, steps: [] }
  const problems = []
  let launched
  let before
  try {
    await mkdir(values.evidenceDir, { recursive: true })
    const started = await launch(prepare(plan.launch, values, target.root), plan, values)
    launched = started.run
    if (started.problem) problems.push(started.problem)
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
    await writeFile(join(values.evidenceDir, `${feature.id}.json`), `${JSON.stringify(record, null, 2)}\n`)
    before = await evidenceHashes(values.evidenceDir)
    if (launched) {
      stop(launched.child)
      const grace = setTimeout(() => { try { process.kill(-launched.child.pid, 'SIGKILL') } catch {} }, terminationGraceMs)
      await launched.exited
      clearTimeout(grace)
      try { process.kill(-launched.child.pid, 'SIGKILL') } catch {}
    }
    if (plan.cleanup.command) {
      const cleaned = await capture(prepare(plan.cleanup, values, target.root))
      if (cleaned.exit !== 0) problems.push(failure('cleanup-failed', `Cleanup exited ${cleaned.exit}: ${cleaned.stderr.slice(-300)}`, 'Fix the cleanup command so it leaves nothing running.'))
    }
    await rm(values.runDir, { recursive: true, force: true })
  }
  const after = await evidenceHashes(values.evidenceDir)
  if (JSON.stringify(before) !== JSON.stringify(after)) problems.push(failure('evidence-lost', 'Evidence changed or disappeared during cleanup.', 'Make cleanup remove only what the run started, never the evidence directory.'))
  if (problems.length) throw new CommandError('failed', problems)
  return { inputs: { target, app: plan.app, feature: feature.id }, data: { runId, evidenceDirectory: relative(target.root, values.evidenceDir),
    evidence: after.map(([path, sha256]) => ({ path, sha256 })), steps: record.steps.map(step => ({ label: step.label, exit: step.exit })) } }
}
