import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from '../skills/repo-audit/scripts/lib/args.mjs'
import { resolveTarget } from '../skills/repo-audit/scripts/lib/repo.mjs'
import { readGit } from '../skills/repo-audit/scripts/lib/discovery.mjs'
import { createScratch } from '../skills/repo-audit/scripts/lib/scratch.mjs'
import { runCommand } from '../skills/repo-audit/scripts/lib/run.mjs'
import { canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { resolveLinks } from '../skills/repo-audit/scripts/lib/paths.mjs'
import { CommandError, emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'
import { leafCommand } from '../skills/repo-audit/scripts/commands/contract.mjs'
import { run as checkDocuments } from '../skills/repo-audit/scripts/commands/docs-check.mjs'
import { run as validateEvidence } from '../skills/repo-audit/scripts/commands/evidence-validate.mjs'
export { run as validateContract } from '../skills/repo-audit/scripts/commands/contract.mjs'
export { run as checkDocuments } from '../skills/repo-audit/scripts/commands/docs-check.mjs'
export { run as validateEvidence } from '../skills/repo-audit/scripts/commands/evidence-validate.mjs'
export { validateData } from '../skills/repo-audit/scripts/lib/schema.mjs'
import { run as generateDocuments } from '../skills/repo-audit/scripts/commands/docs-generate.mjs'

export function checkGeneratedFacts(options) {
  return generateDocuments({ ...options, check: true })
}

function blocked(code, message, fix) {
  throw new CommandError('blocked', [{ code, message, fix }])
}

export async function runChecker(options, { comparisonPolicy = false } = {}) {
  if (!options.repo || !options.base || !options.assessment || options.workspace) throw new CommandError('usage-error', [{
    code: 'missing-checker-input', message: 'Explicit repo, base and assessment are required.',
    fix: 'Supply --repo <path> --base <ref> --assessment <file> [--contract <path>].' }])
  const target = await resolveTarget(options)
  options = { ...options, assessment: await resolveLinks(resolve(options.assessment)) }
  // The explicitly selected record carries any reconciled custom prior path.
  const selected = await readFile(options.assessment, 'utf8').then(JSON.parse).catch(() => null)
  if (selected?.previousContract) options['previous-contract'] = selected.previousContract
  const preflight = await validateEvidence({ ...options, preflight: true })
  if (preflight.status !== 'passed') return { ...preflight, data: { ...preflight.data, phase: 'preflight' } }
  const assessment = JSON.parse(await readFile(options.assessment, 'utf8'))
  const assessmentFile = relative(target.root, options.assessment).split('\\').join('/')
  const committed = assessment.repo === '.' ? readGit(target.root, ['show', `HEAD:${assessmentFile}`]) : null
  async function checkAssessment() {
    if (committed && (committed.status !== 0 || committed.stdout !== await readFile(options.assessment, 'utf8'))) {
      blocked('assessment-not-committed', 'Clean-checkout review must use the unchanged selected committed assessment.', 'Bind and commit the completed portable assessment before execution.')
    }
  }
  await checkAssessment()
  const coverageLimits = new Map()
  function retainCoverageLimits(result) {
    for (const limit of result.data?.coverageLimits ?? []) coverageLimits.set(canonicalJSON(limit), limit)
    return { ...result, data: { ...result.data, coverageLimits: [...coverageLimits.values()] } }
  }
  async function checkStructure() {
    for (const policy of preflight.data.policies) {
      const docs = retainCoverageLimits(await checkDocuments({ ...options, coveragePolicy: policy }))
      if (docs.status !== 'passed') return docs
      const facts = retainCoverageLimits(await checkGeneratedFacts({ ...options, coveragePolicy: policy }))
      if (facts.status !== 'passed') return facts
    }
    return null
  }
  const structure = await checkStructure()
  if (structure) return { ...structure, data: { ...structure.data, phase: 'preflight' } }
  // Validate old leaves too, before any leaf is started.
  for (const check of preflight.data.requiredChecks) await leafCommand(target.root, check.command)
  const directory = await createScratch(target)
  let previous = null
  const policyChanged = preflight.data.paths.some(path => [preflight.inputs.contract,
    preflight.data.previousContract, '.bstack/bin/bstack-check.mjs'].includes(path))
  if (!comparisonPolicy && policyChanged && preflight.data.previousContract && preflight.data.base.kind === 'commit') {
    const bytes = readGit(target.root, ['show', `${preflight.data.base.objectId}:.bstack/bin/bstack-check.mjs`])
    if (bytes.status !== 0) blocked('previous-checker-unavailable', 'The comparison checker is unavailable.', 'Restore the prior checker or record an explicit migration with coverage before claiming validation.')
    const path = join(directory, 'previous-checker.mjs')
    await writeFile(path, bytes.stdout, { flag: 'wx' })
    const checker = await import(pathToFileURL(path).href)
    if (typeof checker.runChecker !== 'function') blocked('previous-checker-incompatible', 'The comparison checker does not support clean-checkout validation.', 'Record an explicit migration decision and coverage for the prior policy.')
    previous = retainCoverageLimits(await checker.runChecker(options, { comparisonPolicy: true }))
    if (previous.status !== 'passed') return { ...previous, data: { ...previous.data, phase: 'previous-policy' } }
  }
  const startedAt = new Date().toISOString()
  const currentResults = []
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.on('SIGINT', cancel)
  process.on('SIGTERM', cancel)
  let validated
  try {
    for (const check of preflight.data.requiredChecks) {
      const captured = [...previous?.data.checks ?? [], ...currentResults]
        .find(record => canonicalJSON(record.check.command) === canonicalJSON(check.command))
      currentResults.push({ check, execution: captured ? captured.execution : await runCommand(target, check.command, { signal: controller.signal }) })
    }
    await checkAssessment()
    validated = await checkStructure() ?? await validateEvidence({ ...options, currentResults })
  } catch (error) {
    validated = { status: error instanceof CommandError ? error.status : 'blocked',
      problems: error instanceof CommandError ? error.problems : [{ code: 'checker-unavailable', message: error.message,
        fix: 'Restore the selected inputs and Node 24 runtime.' }], inputs: preflight.inputs, data: preflight.data }
  } finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
  }
  validated = retainCoverageLimits(validated)
  const status = currentResults.some(record => record.execution.status === 'failed') ? 'failed' : validated.status
  const data = { ...validated.data, phase: 'result-validation', startedAt, completedAt: new Date().toISOString(),
    sourceRevision: readGit(target.root, ['rev-parse', 'HEAD']).stdout.trim(), comparison: {
      source: preflight.data.head, base: preflight.data.base.objectId,
      mergeBase: preflight.data.base.kind === 'commit' ? readGit(target.root, ['merge-base', preflight.data.head, preflight.data.base.objectId]).stdout.trim() || null : null },
    checks: currentResults, previous, path: join(directory, 'checker-result.json') }
  await writeFile(data.path, JSON.stringify({ status, problems: validated.problems, data }, null, 2) + '\n', { flag: 'wx' })
  return { ...validated, status, data }
}

// Importing the bundled validators never starts the aggregate.
if (process.argv[1] && await resolveLinks(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  if (argv.length === 1 && argv[0] === '--help') console.log('Usage: node .bstack/bin/bstack-check.mjs --repo <path> --base <ref> --assessment <file> [--contract <path>] [--json]')
  else {
    try {
      emitResult({ command: 'bstack check', ...await runChecker(parseArgs(argv, ['base', 'assessment', 'contract'])) }, argv.includes('--json'))
    } catch (error) {
      emitResult({ command: 'bstack check', status: error instanceof CommandError ? error.status : 'blocked',
        problems: error instanceof CommandError ? error.problems : [{ code: 'checker-unavailable', message: error.message,
          fix: 'Restore the selected inputs and Node 24 runtime.' }] }, argv.includes('--json'))
    }
  }
}
