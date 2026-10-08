import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { root, text, object, array, options, readJSON, checkRegistry, fail } from './lib/evaluation.mjs'
import { validateData } from '../skills/repo-audit/scripts/lib/schema.mjs'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'

// Final selections are explicit inputs, independent of run history ordering.
const help = 'acceptance --check-registry [--registry <file>] [--json]\nacceptance --selections <file> [--results <directory>] [--json]'

async function selections(path, results) {
  const input = await readJSON(path)
  validateData(object({ schemaVersion: { const: 1 }, selections: { ...array(object({
    caseId: text, stage: text, revision: text, runId: text
  })), minItems: 1 } }), input)
  const registry = await readJSON(join(root, 'tests', 'acceptance', 'cases.json'))
  const seen = new Set()
  for (const selected of input.selections) {
    const key = JSON.stringify([selected.caseId, selected.stage, selected.revision])
    if (seen.has(key)) fail(`Duplicate final selection: ${key}`)
    seen.add(key)
  }
  for (const selected of input.selections) {
    if (!registry.cases.some(item => item.id === selected.caseId)) fail(`Unknown case: ${selected.caseId}`)
    if (!/^[\dTZ.-]+-[0-9a-f-]{36}$/.test(selected.runId)) fail('Invalid selected run ID.')
    const directory = join(results, selected.runId)
    const run = await readJSON(join(directory, 'run.json'))
    if (run.id !== selected.runId || run.stage !== selected.stage || run.sourceRevision !== selected.revision) fail('Selection does not match the run ID, stage and source revision.')
    const checks = run.caseResults.filter(check => check.caseId === selected.caseId)
    if (!checks.length || checks.some(check => check.passed !== true) || !run.transcript || !run.answers) fail(`Selected case has no passing scored evidence: ${selected.caseId}`)
    for (const file of [run.transcript, run.answers]) if (!(await readFile(join(directory, file), 'utf8')).trim()) fail(`Empty selected artifact: ${file}`)
    if (!run.isolation?.verified) fail(`Selected run has unverified host isolation: ${selected.runId}`)
  }
  return { selected: input.selections.length }
}

try {
  const args = process.argv.slice(2)
  if (args.includes('--help')) console.log(help)
  else {
    const opts = options(args, ['registry', 'selections', 'results'], ['check-registry'])
    if (Boolean(opts['check-registry']) === Boolean(opts.selections) || (opts.registry && !opts['check-registry']) || (opts.results && opts['check-registry'])) fail(help, 'usage-error')
    const data = opts['check-registry'] ? await checkRegistry(resolve(opts.registry ?? join(root, 'tests', 'acceptance', 'cases.json')))
      : await selections(resolve(opts.selections), resolve(opts.results ?? join(root, 'tests', 'eval', 'results', 'runs')))
    emitResult({ command: 'acceptance', status: 'passed', data }, true)
  }
} catch (error) {
  emitResult({ command: 'acceptance', status: error.status === 'usage-error' ? error.status : 'blocked',
    problems: error.problems ?? [{ code: 'acceptance-blocked', message: error.message, fix: help }] }, true)
}
