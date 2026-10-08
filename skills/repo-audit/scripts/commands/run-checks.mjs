import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { CommandError } from '../lib/result.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { resolveFilePath, resolvePath } from '../lib/paths.mjs'
import { pathGlob, matchesPath } from '../lib/glob.mjs'
import { repoFiles, readGit } from '../lib/discovery.mjs'
import { canonicalJSON, hashBytes, fingerprint } from '../lib/fingerprint.mjs'
import { createScratch, scratchDirectory } from '../lib/scratch.mjs'
import { runCommand } from '../lib/run.mjs'

export async function run(options) {
  if (!options.plan || (options.phase && !['before', 'after'].includes(options.phase)) || (options.phase === 'before' && options['prior-run'])) {
    throw new CommandError('usage-error', [{ code: 'invalid-check-options', message: 'Supply a plan and phase before or after. Prior runs apply only after changes.', fix: 'Use --plan <file> [--phase before|after] [--prior-run <id>].' }])
  }
  const target = await resolveTarget(options)
  const phase = options.phase ?? 'after'
  const schema = JSON.parse(await readFile(new URL('../../schemas/check-plan.json', import.meta.url), 'utf8'))
  let plan
  try { plan = inspectJSON(await readFile(options.plan, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('failed', [{ code: 'invalid-check-plan', message: 'Check plan must be readable JSON.', fix: 'Supply a plan following schemas/check-plan.json.' }])
  }
  validateData(schema, plan)
  if (options['prior-run'] && !['bug-fix', 'refactor'].includes(plan.changeKind)) {
    throw new CommandError('usage-error', [{ code: 'unexpected-prior-run', message: 'Only bug fixes and refactors use prior runs.', fix: 'Omit --prior-run for this change kind.' }])
  }
  for (const key of ['checks', 'acceptanceCases', 'acceptanceSources']) validateIds(plan[key], `$/${key}`)
  const problems = []
  const problem = (code, message) => problems.push({ code, message, fix: 'Review the check plan and capture the required evidence against the correct state.' })
  for (const source of plan.acceptanceSources) {
    const path = await resolveFilePath(target.root, source.path)
    let bytes
    try { bytes = await readFile(path) } catch { problem('acceptance-source-unavailable', `Source ${source.id} is unavailable.`); continue }
    if (hashBytes(bytes) !== source.contentHash) problem('stale-acceptance-source', `Source ${source.id} no longer matches its approved bytes.`)
    for (const acceptance of plan.acceptanceCases.filter(item => item.sourceId === source.id)) {
      if (!bytes.toString('utf8').includes(acceptance.pointer)) problem('missing-acceptance-pointer', `Case ${acceptance.id} pointer is absent from ${source.id}.`)
    }
  }
  for (const acceptance of plan.acceptanceCases) {
    if (!plan.acceptanceSources.some(source => source.id === acceptance.sourceId)) problem('missing-source-id', `Case ${acceptance.id} names an unknown source.`)
  }
  for (const check of plan.checks) {
    for (const id of check.acceptanceCases) if (!plan.acceptanceCases.some(item => item.id === id)) problem('missing-case-id', `Check ${check.id} names unknown case ${id}.`)
    const cwd = await resolvePath(target.root, check.command.cwd)
    try {
      if (!(await stat(cwd)).isDirectory()) problem('invalid-cwd', `Check ${check.id} needs an existing working directory.`)
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
      problem('invalid-cwd', `Check ${check.id} needs an existing working directory.`)
    }
    if (check.command.timeoutMs !== undefined && (!Number.isSafeInteger(check.command.timeoutMs) || check.command.timeoutMs <= 0)) problem('invalid-timeout', `Check ${check.id} needs a positive safe timeout.`)
    check.inputScopes.forEach(pathGlob)
  }
  const required = role => plan.checks.filter(check => check.required && check.role === role)
  if (plan.changeKind === 'bug-fix' && !required('reproduction').length) problem('missing-reproduction', 'A bug fix needs a required reproduction check.')
  if (plan.changeKind === 'refactor') {
    if (!required('protection').length) problem('missing-protection', 'A refactor needs required protective checks.')
    if (!required('compatibility').length) problem('missing-compatibility', 'A refactor needs a required compatibility check.')
  }
  if (problems.length) throw new CommandError('failed', problems)
  const planDigest = hashBytes(canonicalJSON(plan))
  async function inputState(checks) {
    const scopes = checks.flatMap(check => check.inputScopes)
    const globs = scopes.map(pathGlob)
    const files = await repoFiles(target.root)
    const paths = [...scopes.filter(scope => !/[*?]/.test(scope)), ...files.filter(path => globs.some(glob => matchesPath(glob, path))), ...plan.acceptanceSources.map(source => source.path)]
    for (const path of paths) await resolveFilePath(target.root, path)
    const head = readGit(target.root, ['rev-parse', '--verify', 'HEAD'])
    let planContentHash = null
    try { planContentHash = hashBytes(await readFile(options.plan)) } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return fingerprint(target, { baseCommit: head.status === 0 ? head.stdout.trim() : null, paths, inputs: { planDigest, planContentHash } })
  }
  const originalState = await inputState(plan.checks)
  const startedAt = new Date().toISOString()
  let prior = null
  if (phase === 'after' && ['bug-fix', 'refactor'].includes(plan.changeKind)) {
    if (options['prior-run']) {
      try { prior = JSON.parse(await readFile(join(await scratchDirectory(target, options['prior-run']), 'checks.json'), 'utf8')) } catch { /* Missing or malformed capture cannot satisfy a prerequisite. */ }
    }
    if (!prior || prior.schemaVersion !== 1 || prior.phase !== 'before' || prior.planDigest !== planDigest || prior.originalState?.state.root !== target.root || prior.status !== 'passed' || !prior.completedAt || prior.completedAt > startedAt) {
      problem('missing-prior-evidence', 'The change needs a completed passing before capture for this target and exact plan.')
    } else {
      if (prior.originalState.fingerprint === originalState.fingerprint) problem('unchanged-original-state', 'Before and after inputs are identical. Capture protection before structural edits.')
      const role = plan.changeKind === 'bug-fix' ? 'reproduction' : 'protection'
      for (const check of required(role)) {
        const captured = prior.checks?.find(item => item.id === check.id)
        if (!captured?.satisfied || !captured.execution || captured.inputFingerprint !== captured.finalFingerprint) problem('invalid-prior-check', `Prior capture does not establish ${check.id}.`)
      }
    }
  }
  const checks = []
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.on('SIGINT', cancel)
  process.on('SIGTERM', cancel)
  try {
    for (const check of plan.checks) {
      const active = phase === 'after' || ['reproduction', 'protection'].includes(check.role)
      const reason = !active ? 'Check belongs to the after phase.' : problems.length ? 'Prior evidence prerequisite was not met.' : check.skipReason
      const captured = { id: check.id, role: check.role, required: check.required, acceptanceCases: check.acceptanceCases,
        command: check.command, active, status: 'unverified', satisfied: false, reason: reason ?? null,
        inputFingerprint: null, finalFingerprint: null, execution: null, order: checks.length + 1 }
      checks.push(captured)
      if (reason) continue
      const before = await inputState([check])
      captured.inputFingerprint = before.fingerprint
      try { captured.execution = await runCommand(target, check.command, { signal: controller.signal }) } catch (error) {
        captured.reason = error.message
        captured.status = 'blocked'
        continue
      }
      const execution = captured.execution
      captured.status = execution.status
      captured.reason = execution.error ?? (execution.cancelled ? 'Check was cancelled.' : execution.timedOut ? 'Check timed out.' : execution.status !== 'passed' ? 'Command did not pass.' : null)
      const reproduced = phase === 'before' && plan.changeKind === 'bug-fix' && check.role === 'reproduction'
      captured.satisfied = reproduced ? execution.status === 'failed' && execution.exitCode !== null && execution.exitCode !== 0 && !execution.signal && !execution.cancelled && !execution.timedOut && execution.toolVersion.status === 'passed' : execution.status === 'passed'
      if (reproduced && !captured.satisfied) captured.reason = 'Reproduction must execute normally and fail against the original state.'
      captured.finalFingerprint = (await inputState([check])).fingerprint
      if (captured.inputFingerprint !== captured.finalFingerprint) captured.status = 'stale'
    }
  } finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
  }
  for (const captured of checks.filter(check => check.execution)) {
    const check = plan.checks.find(item => item.id === captured.id)
    captured.finalFingerprint = (await inputState([check])).fingerprint
    if (captured.status === 'stale' || captured.inputFingerprint !== captured.finalFingerprint) {
      captured.status = 'stale'
      captured.reason = 'Inputs changed during this run.'
      captured.satisfied = false
    }
  }
  const coverage = plan.acceptanceCases.map(acceptance => {
    const evidence = checks.filter(check => check.active && check.acceptanceCases.includes(acceptance.id))
    const status = evidence.some(check => !check.satisfied && (check.status === 'stale' || check.status === 'failed' && check.execution?.toolVersion.status === 'passed' && !check.execution.cancelled && !check.execution.timedOut)) ? 'failed'
      : evidence.some(check => check.satisfied) && evidence.filter(check => check.required).every(check => check.satisfied) ? 'passed' : 'unverified'
    return { id: acceptance.id, sourceId: acceptance.sourceId, pointer: acceptance.pointer, outcome: acceptance.outcome, userJourney: acceptance.userJourney,
      status, checkIds: evidence.map(check => check.id), reason: status === 'unverified' ? 'No completed successful check establishes this case.' : null }
  })
  const unsatisfied = checks.filter(check => check.active && check.required && !check.satisfied)
  let status = problems.length || unsatisfied.length ? 'blocked' : 'passed'
  if (unsatisfied.some(check => ['failed', 'stale'].includes(check.status))) status = 'failed'
  if (!checks.some(check => check.active && check.required)) { problem('no-required-checks', 'This phase has no required checks.'); status = 'blocked' }
  if (phase === 'after' && coverage.some(item => item.userJourney && item.status !== 'passed')) status = coverage.some(item => item.userJourney && item.status === 'failed') ? 'failed' : 'blocked'
  const journeyCoverage = coverage.some(item => item.userJourney && item.status === 'passed') ? 'User journey evidence captured.' : 'No user journey is verified by this result.'
  const directory = await createScratch(target)
  const data = { schemaVersion: 1, runId: basename(directory), phase, status, planDigest, originalState, startedAt,
    completedAt: new Date().toISOString(), priorRun: prior?.runId ?? null, executionOrder: [...(prior ? [prior.runId] : []), basename(directory)], checks, coverage, journeyCoverage,
    limitations: ['Local capture trusts its declared input scopes and approved acceptance sources. Live probes remain unverified until C15b.'] }
  const path = join(directory, 'checks.json')
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
  return { status, problems, inputs: { repo: target.root, plan: options.plan, phase }, data: { ...data, path } }
}
