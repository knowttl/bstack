import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { root, options, readJSON, fail } from './lib/evaluation.mjs'
import { correctedScore, validateScore } from './lib/evaluation-scoring.mjs'
import { readJudge, judgeInput, judgeAnswers } from './lib/evaluation-judge.mjs'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'

// Adoption uses the complete retained human-scored corpus, never a selected passing subset.
const expectedRuns = 124
// The approved agreement threshold counts check verdicts, not whole-run verdicts or citations.
const minimumAgreement = 0.95
// Planning never invokes a provider; execution requires an explicit fresh output directory.
const help = 'eval-calibrate [--judge <config.json>] [--runs <directory>] --plan [--json]\neval-calibrate [--judge <config.json>] [--runs <directory>] --output <new-directory> [--json]\nDefaults: Claude Sonnet 5.5 medium; --runs tests/eval/results/release/runs. Requires exactly 124 human-scored runs. Makes one judge call per run, stops on provider failure, never retries. Agreement below 95% fails and records disagreements.\nExamples:\n  node scripts/eval-calibrate.mjs --plan --json\n  node scripts/eval-calibrate.mjs --judge judge.json --output .cache/judge-calibration --json'

try {
  if (process.argv.includes('--help')) console.log(help)
  else {
    const opts = options(process.argv.slice(2), ['judge', 'runs', 'output'], ['plan'])
    if ((!opts.plan && !opts.output) || (opts.plan && opts.output)) fail(help, 'usage-error')
    const config = await readJudge(resolve(opts.judge ?? join(root, 'tests/eval/judge/claude.json')))
    const runs = resolve(opts.runs ?? join(root, 'tests/eval/results/release/runs'))
    const corpus = []
    for (const entry of (await readdir(runs, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue
      const directory = join(runs, entry.name)
      const bytes = await readFile(join(directory, 'run.json'))
      const original = JSON.parse(bytes)
      if (!original.transcript) continue
      if (original.id !== entry.name) fail('Calibration run ID does not match its directory.')
      const record = await correctedScore(directory, original)
      if (record.caseResults.some(check => !['human', 'machine'].includes(check.scoring))) fail('Calibration requires retained human verdicts, not judge verdicts.')
      const transcript = await readFile(join(directory, record.transcript), 'utf8')
      const human = record.scoreCorrection ?? await readJSON(join(directory, record.answers))
      validateScore(record, { ...human, runId: record.id }, transcript)
      if (record.caseResults.some(check => {
        const answer = human.checks.find(answer => answer.id === check.id)
        return !answer || ['passed', 'startLine', 'endLine'].some(key => check[key] !== answer[key])
      })) fail('Retained human answers do not match the run verdicts.')
      corpus.push({ record, transcript, human, binding: { runId: record.id,
        runHash: hashBytes(bytes), humanHash: hashBytes(canonicalJSON(human)) } })
    }
    if (corpus.length !== expectedRuns) fail(`Calibration requires all ${expectedRuns} retained human-scored runs; found ${corpus.length}.`)
    for (const run of corpus) {
      run.prepared = await judgeInput(run.record, run.transcript, { corpus, human: run.human })
      const { inputHash, transcriptHash, criteriaHash, companions, companionsHash } = run.prepared
      Object.assign(run.binding, { inputHash, transcriptHash, criteriaHash, companions, companionsHash })
    }
    const plan = { schemaVersion: 1, model: config.model, configHash: hashBytes(canonicalJSON(config)),
      rubricHash: corpus[0].prepared.rubricHash, expectedCalls: corpus.filter(run => run.prepared.input.checks.length).length,
      checks: corpus.reduce((sum, run) => sum + run.prepared.input.checks.length, 0),
      inputBytes: corpus.reduce((sum, run) => sum + Buffer.byteLength(JSON.stringify(run.prepared.input)), 0),
      pending: corpus.flatMap(run => run.prepared.pending.map(check => ({ runId: run.record.id, ...check }))),
      corpus: corpus.map(run => run.binding) }
    if (opts.plan) {
      if (!opts.json) console.log(`model: ${plan.model}\ncalls: ${plan.expectedCalls}\nchecks: ${plan.checks}\ninput bytes: ${plan.inputBytes}`)
      emitResult({ command: 'eval calibrate', status: plan.pending.length ? 'blocked' : 'passed', data: plan }, opts.json)
    }
    else {
      const output = resolve(opts.output)
      await mkdir(output, { mode: 0o700 })
      await writeFile(join(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
      const report = { schemaVersion: 1, model: config.model, configHash: plan.configHash, rubricHash: plan.rubricHash,
        planHash: hashBytes(canonicalJSON(plan)), startedAt: new Date().toISOString(),
        expectedRuns, completedRuns: 0, total: 0, agreed: 0, agreement: 0, minimumAgreement,
        status: 'blocked', pending: plan.pending, disagreements: [], runs: [] }
      try {
        for (const run of corpus) {
          const { record, transcript, prepared } = run
          const { answers, evidence } = await judgeAnswers(config, record, transcript, prepared)
          await writeFile(join(output, `${record.id}.answers.json`), JSON.stringify(answers, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
          report.runs.push({ runId: record.id, answersHash: hashBytes(canonicalJSON(answers)), ...evidence })
          report.completedRuns++
          for (const answer of answers.checks) {
            const human = record.caseResults.find(check => check.id === answer.id)
            report.total++
            if (answer.passed === human.passed) report.agreed++
            else report.disagreements.push({ runId: record.id, check: answer.id, caseId: human.caseId,
              human: { passed: human.passed, startLine: human.startLine, endLine: human.endLine }, judge: answer })
          }
        }
      } catch {
        // Never include provider diagnostics or automatically repeat a possibly billed request.
        report.reason = 'Calibration interrupted by invalid judge output or provider failure. Review saved answers and the private provider session; do not retry or tune the rubric.'
      }
      report.agreement = report.total ? report.agreed / report.total : 0
      if (report.completedRuns === expectedRuns && !report.pending.length) report.status = report.agreement >= minimumAgreement ? 'passed' : 'failed'
      report.finishedAt = new Date().toISOString()
      await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
      if (!opts.json) console.log(`report: ${join(output, 'report.json')}\nagreement: ${report.agreed}/${report.total}\ndisagreements: ${report.disagreements.length}`)
      emitResult({ command: 'eval calibrate', status: report.status, data: report }, opts.json)
    }
  }
} catch (error) {
  emitResult({ command: 'eval calibrate', status: error.status === 'usage-error' ? error.status : 'blocked',
    problems: error.problems ?? [{ code: 'calibration-blocked', message: 'Calibration inputs or output directory are unavailable.', fix: help }] }, process.argv.includes('--json'))
}
