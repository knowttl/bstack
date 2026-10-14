import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { root, text, object, array, options, readJSON, checkRegistry, fail } from './lib/evaluation.mjs'
import { validateData } from '../runtime/scripts/lib/schema.mjs'
import { emitResult } from '../runtime/scripts/lib/result.mjs'
import { releaseGate } from './lib/release-evidence.mjs'
import { correctedScore, validateScore } from './lib/evaluation-scoring.mjs'

// Final selections are explicit inputs, independent of run history ordering.
const help = 'acceptance --check-registry [--registry <file>] [--json]\nacceptance --selections <file> [--results <directory>] [--json]\nacceptance --release <version> --candidate <commit> --checks <file> [--results <directory>] [--json]\nRelease reads ledger.jsonl and candidate-bound hard-break checks, writes release/<version>.json, and reports any scenarios needing five confirmation runs. It never starts model sessions.'

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
    const run = await correctedScore(directory, await readJSON(join(directory, 'run.json')))
    if (run.id !== selected.runId || run.stage !== selected.stage || run.sourceRevision !== selected.revision) fail('Selection does not match the run ID, stage and source revision.')
    const checks = run.caseResults.filter(check => check.caseId === selected.caseId)
    if (!checks.length || checks.some(check => check.passed !== true) || !run.transcript || !run.answers) fail(`Selected case has no passing scored evidence: ${selected.caseId}`)
    validateScore(run, { runId: run.id, checks: run.caseResults }, await readFile(join(directory, run.transcript), 'utf8'))
    for (const file of [run.transcript, run.answers]) if (!(await readFile(join(directory, file), 'utf8')).trim()) fail(`Empty selected artifact: ${file}`)
    if (!run.isolation?.verified) fail(`Selected run has unverified host isolation: ${selected.runId}`)
  }
  return { selected: input.selections.length }
}

try {
  const args = process.argv.slice(2)
  if (args.includes('--help')) console.log(help)
  else {
    if (args.includes('--require-complete')) fail('--require-complete was removed. Use --release <version> --candidate <commit> --checks <file>.', 'usage-error')
    const opts = options(args, ['registry', 'selections', 'results', 'release', 'candidate', 'checks'], ['check-registry'])
    if ([opts['check-registry'], opts.selections, opts.release].filter(Boolean).length !== 1 ||
        (opts.registry && !opts['check-registry']) || (opts.results && opts['check-registry']) ||
        (!opts.release && (opts.candidate || opts.checks)) || (opts.release && (!opts.candidate || !opts.checks))) fail(help, 'usage-error')
    const data = opts.release ? await releaseGate(opts, resolve(opts.results ?? join(root, 'tests/eval/results')))
      : opts['check-registry'] ? await checkRegistry(resolve(opts.registry ?? join(root, 'tests', 'acceptance', 'cases.json')))
      : await selections(resolve(opts.selections), resolve(opts.results ?? join(root, 'tests', 'eval', 'results', 'runs')))
    emitResult({ command: 'acceptance', status: data.verdict ?? 'passed', data }, true)
  }
} catch (error) {
  emitResult({ command: 'acceptance', status: error.status === 'usage-error' ? error.status : 'blocked',
    problems: error.problems ?? [{ code: 'acceptance-blocked', message: error.message, fix: help }] }, true)
}
