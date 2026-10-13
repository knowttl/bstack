import { readFile, writeFile, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { CommandError } from '../lib/result.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { validateData } from '../lib/schema.mjs'
import { resolvePath, resolveFilePath } from '../lib/paths.mjs'
import { pathGlob, matchesPath } from '../lib/glob.mjs'
import { repoFiles, readGit } from '../lib/discovery.mjs'
import { canonicalJSON, hashBytes, fingerprint } from '../lib/fingerprint.mjs'
import { createScratch, scratchDirectory } from '../lib/scratch.mjs'
import { runCommand } from '../lib/run.mjs'

// Literal resource URLs let the package checker verify every installed schema.
const schemas = {
  'probe-spec': new URL('../../schemas/probe-spec.json', import.meta.url),
  'probe-record': new URL('../../schemas/probe-record.json', import.meta.url),
  'check-plan': new URL('../../schemas/check-plan.json', import.meta.url)
}

async function schema(name) {
  return JSON.parse(await readFile(schemas[name], 'utf8'))
}

function problem(code, message) {
  return { code, message, fix: 'Capture the required probe against the correct state, using the same call and explicit approval for any side effects.' }
}

function callIdentity(record) {
  return hashBytes(canonicalJSON({ name: record.name, target: record.target, command: record.command,
    endpoint: record.spec.endpoint, environment: record.environment, sideEffects: record.spec.sideEffects,
    assumption: record.spec.assumption }))
}

async function inputState(target, spec, callDigest, specPath) {
  const globs = spec.inputScopes.map(pathGlob)
  const files = await repoFiles(target.root)
  const literals = spec.inputScopes.filter(scope => !/[*?]/.test(scope))
  for (const path of literals) await resolveFilePath(target.root, path)
  const head = readGit(target.root, ['rev-parse', '--verify', 'HEAD'])
  let specContentHash = null
  try { specContentHash = hashBytes(await readFile(specPath)) } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return fingerprint(target, { baseCommit: head.status === 0 ? head.stdout.trim() : null,
    paths: [...literals, ...files.filter(path => globs.some(glob => matchesPath(glob, path)))], inputs: { spec, callDigest, specContentHash } })
}

export async function run(options, commandName) {
  if (!options.name?.trim()) throw new CommandError('usage-error', [problem('missing-probe-name', 'Supply --name for the outside dependency requiring verification.')])
  const target = await resolveTarget(options)
  if (commandName === 'probe compare') return compare(target, options)
  if (!['before', 'after'].includes(options.phase) || !options.spec || !Array.isArray(options.command) || !options.command.length) {
    throw new CommandError('usage-error', [problem('invalid-probe-options', 'Supply --phase before|after, --spec <file> and -- <executable> [args...].')])
  }
  let spec
  let validatedSpecHash
  const specPath = resolve(options.spec)
  try {
    const bytes = await readFile(specPath)
    spec = inspectJSON(bytes.toString('utf8')).value
    validatedSpecHash = hashBytes(bytes)
  } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('failed', [problem('invalid-probe-spec', 'Probe descriptor must be readable JSON.')])
  }
  validateData(await schema('probe-spec'), spec)
  const command = { executable: options.command[0], args: options.command.slice(1), cwd: spec.cwd, versionArgs: spec.versionArgs,
    ...(spec.timeoutMs === undefined ? {} : { timeoutMs: spec.timeoutMs }) }
  validateData((await schema('check-plan')).properties.checks.items.properties.command, command)
  if (spec.timeoutMs !== undefined && (!Number.isSafeInteger(spec.timeoutMs) || spec.timeoutMs <= 0)) {
    throw new CommandError('usage-error', [problem('invalid-timeout', 'Probe timeout must be a positive safe integer.')])
  }
  if (!(await stat(await resolvePath(target.root, spec.cwd))).isDirectory()) {
    throw new CommandError('failed', [problem('invalid-cwd', 'Probe working directory must be a directory.')])
  }
  if (spec.sideEffects && !options['approved-by-user']) {
    throw new CommandError('blocked', [problem('probe-approval-required', 'This specific side-effecting call needs --approved-by-user before execution.')])
  }
  const environment = Object.fromEntries(spec.environment.map(key => [key, process.env[key] ?? null]))
  const binding = { name: options.name, target, spec, command, environment }
  const callDigest = callIdentity(binding)
  const originalState = await inputState(target, spec, callDigest, specPath)
  if (originalState.state.inputs.specContentHash !== validatedSpecHash) {
    throw new CommandError('failed', [problem('stale-probe-spec', 'Probe descriptor changed before capture.')])
  }
  const directory = await createScratch(target)
  const runId = basename(directory)
  const startedAt = new Date().toISOString()
  const approval = spec.sideEffects ? { runId, callDigest, approvedByUser: true } : null
  let execution = null
  let status = 'unverified'
  let reason = null
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.on('SIGINT', cancel)
  process.on('SIGTERM', cancel)
  try {
    execution = await runCommand(target, command, { signal: controller.signal })
    status = execution.status === 'passed' ? 'passed'
      : execution.error || execution.cancelled || execution.timedOut || execution.toolVersion.status !== 'passed' ? 'unverified' : 'failed'
    reason = execution.error ?? (execution.cancelled ? 'Probe was cancelled.' : execution.timedOut ? 'Probe timed out.'
      : execution.toolVersion.status !== 'passed' ? 'Tool version was unavailable.' : status === 'failed' ? 'Live call did not meet the asserted outcome.' : null)
  } catch (error) { reason = error.message } finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
  }
  const finalState = await inputState(target, spec, callDigest, specPath).catch(() => null)
  if (originalState.fingerprint !== finalState?.fingerprint) {
    status = 'blocked'
    reason = 'inputs changed during run'
  }
  const record = { schemaVersion: 1, runId, ...binding, specPath, phase: options.phase, callDigest, approval, startedAt,
    completedAt: new Date().toISOString(), originalState, finalState, execution, status, reason }
  validateData(await schema('probe-record'), record)
  const path = join(directory, 'probe.json')
  await writeFile(path, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' })
  return { status: status === 'unverified' ? 'blocked' : status, problems: reason ? [problem('probe-not-verified', reason)] : [], data: { ...record, path } }
}

async function compare(target, options) {
  const problems = []
  const captures = {}
  for (const phase of ['before', 'after']) {
    try {
      if (!options[phase]) throw new Error('Missing run ID.')
      const record = inspectJSON(await readFile(join(await scratchDirectory(target, options[phase]), 'probe.json'), 'utf8')).value
      validateData(await schema('probe-record'), record)
      validateData(await schema('probe-spec'), record.spec)
      validateData((await schema('check-plan')).properties.checks.items.properties.command, record.command)
      captures[phase] = record
      if (record.runId !== options[phase] || record.phase !== phase || record.name !== options.name || canonicalJSON(record.target) !== canonicalJSON(target) || record.callDigest !== callIdentity(record)) {
        problems.push(problem('incompatible-probe', `${phase} capture does not identify this probe, phase and target.`))
      }
      if (record.status !== 'passed' || record.execution?.status !== 'passed' || record.execution.toolVersion?.status !== 'passed' || record.originalState.fingerprint !== record.finalState?.fingerprint) {
        problems.push(problem('probe-not-verified', `${phase} probe is not verified: ${record.reason ?? 'No complete successful execution.'}`))
      }
      if (record.spec.sideEffects && (!record.approval?.approvedByUser || record.approval.runId !== record.runId || record.approval.callDigest !== record.callDigest)) {
        problems.push(problem('probe-approval-required', `${phase} capture lacks approval for that specific call.`))
      }
    } catch {
      problems.push(problem(`missing-${phase}-probe`, `No readable valid ${phase} probe was supplied.`))
    }
  }
  const { before, after } = captures
  if (before && after) {
    if (before.callDigest !== after.callDigest || canonicalJSON(before.spec) !== canonicalJSON(after.spec)) {
      problems.push(problem('probe-pair-mismatch', 'Before and after must repeat the same command, endpoint and relevant environment, with the same descriptor.'))
    }
    if (before.runId === after.runId || before.completedAt > after.startedAt) problems.push(problem('probe-order', 'The before probe must finish before the after probe starts.'))
    const environment = Object.fromEntries(after.spec.environment.map(key => [key, process.env[key] ?? null]))
    const current = await inputState(target, after.spec, after.callDigest, after.specPath).catch(() => null)
    if (current?.fingerprint !== after.finalState?.fingerprint || canonicalJSON(environment) !== canonicalJSON(after.environment)) {
      problems.push(problem('stale-probe', 'The after probe no longer matches current declared inputs or relevant environment.'))
    }
  }
  return { status: problems.length ? 'failed' : 'passed', problems,
    data: { name: options.name, before: before?.runId ?? null, after: after?.runId ?? null,
      verified: !problems.length, assumption: after?.spec.assumption ?? before?.spec.assumption ?? null } }
}
