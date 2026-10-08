import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { platform, release } from 'node:os'
import { root, text, object, array, options, scenario, readJSON, fail } from './lib/evaluation.mjs'
import { validateData, validateIds } from '../skills/repo-audit/scripts/lib/schema.mjs'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { runCommand } from '../skills/repo-audit/scripts/lib/run.mjs'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'

// Manual runs remain separate from task evidence and final selections.
const defaultResults = join(root, 'tests', 'eval', 'results', 'runs')
// These public forms include the pending automatic-host path.
const help = 'eval --manual --scenario <id> --mode without|with --stage <checkpoint> --agent <name> --model <name> [--invocation <explicit-command>] [--results <directory>] [--json]\neval score --run <id> --answers <file> --transcript <file> [--results <directory>] [--json]\neval compare --without <id> --with <id> [--results <directory>] [--json]'

async function child(executable, args, targetRoot = root) {
  const result = await runCommand({ root: targetRoot }, { executable, args, cwd: '.', versionArgs: ['--version'], timeoutMs: 120000 })
  if (result.status !== 'passed') fail(`${executable} failed: ${result.stderr || result.error}`, result.status)
  return result
}

async function start(opts, results) {
  for (const name of ['scenario', 'mode', 'stage', 'agent', 'model']) if (!opts[name]?.trim()) fail(`Missing --${name}`, 'usage-error')
  if (!['without', 'with'].includes(opts.mode)) fail('Mode must be without or with.', 'usage-error')
  const definition = await scenario(opts.scenario)
  if (!definition.checkpoints.includes(opts.stage)) fail(`Unknown checkpoint: ${opts.stage}`, 'usage-error')
  if (!opts.manual) fail('Automatic host execution is blocked until C7b. Use --manual and follow docs/evaluation.md.')
  if (opts.mode === 'with' && definition.invocation === 'explicit' && !opts.invocation?.trim()) fail('An ordinary with-skill run requires --invocation for the current host.', 'usage-error')
  if (opts.invocation && (opts.mode === 'without' || definition.invocation === 'implicit')) fail('Baseline and implicit runs use the outcome request without --invocation.', 'usage-error')
  const git = await child('git', ['rev-parse', 'HEAD'])
  const revision = git.stdout.trim()
  const fixtureRevision = (await child('git', ['rev-parse', 'HEAD:tests/fixtures'])).stdout.trim()
  const built = await child('node', ['tests/fixtures/build.mjs', definition.fixture])
  const fixture = JSON.parse(built.stdout.trim())
  const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
  const directory = join(results, id)
  await mkdir(directory, { recursive: true })
  const record = { schemaVersion: 1, id, createdAt: new Date().toISOString(), sourceRevision: revision,
    agent: opts.agent, model: opts.model, os: `${platform()} ${release()}`, tools: { node: process.version, git: git.toolVersion.stdout.trim() },
    fixture: { ...fixture, revision: fixtureRevision }, scenario: definition, criteriaHash: hashBytes(canonicalJSON(definition.checks)),
    stage: opts.stage, mode: opts.mode, request: opts.invocation ? `${opts.invocation}\n${definition.request}` : definition.request,
    status: 'blocked', reason: 'Awaiting explicit manual answers and transcript. Host isolation is not verified by C7a.',
    isolation: { verified: false }, transcript: null, answers: null, caseResults: [] }
  if (definition.fixture.startsWith('ts-')) {
    record.tools.npm = (await child('npm', ['--version'], fixture.path)).stdout.trim()
    record.tools.typescript = (await child('node', [join('node_modules', 'typescript', 'bin', 'tsc'), '--version'], fixture.path)).stdout.trim()
  }
  await writeFile(join(directory, 'run.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' })
  return record
}

async function load(results, id) {
  if (!/^[\dTZ.-]+-[0-9a-f-]{36}$/.test(id ?? '')) fail('Supply a run ID printed by eval.', 'usage-error')
  return await readJSON(join(results, id, 'run.json'))
}

async function score(opts, results) {
  const record = await load(results, opts.run)
  if (!opts.answers || !opts.transcript) fail('Missing answers or transcript. The run remains blocked.')
  if (record.transcript) fail('This run is already scored. Create a fresh run to keep checkpoint history.')
  const answers = await readJSON(resolve(opts.answers))
  validateData(object({ schemaVersion: { const: 1 }, runId: text, reviewer: text, checks: array(object({
    id: text, passed: { type: 'boolean' }, startLine: { type: 'integer' }, endLine: { type: 'integer' }
  })) }), answers)
  validateIds(answers.checks, '$/checks')
  if (answers.runId !== record.id || !answers.reviewer.trim() || answers.checks.length !== record.scenario.checks.length ||
      record.scenario.checks.some(check => !answers.checks.some(answer => answer.id === check.id))) fail('Answers must name this run, a reviewer and every checklist ID exactly once.')
  const transcript = await readFile(resolve(opts.transcript), 'utf8')
  if (!transcript.trim()) fail('Transcript is empty. The run remains blocked.')
  const lines = transcript.trimEnd().split(/\r?\n/).length
  for (const answer of answers.checks) if (answer.startLine < 1 || answer.endLine < answer.startLine || answer.endLine > lines) fail(`Invalid transcript location for ${answer.id}`)
  const directory = join(results, record.id)
  const attempt = randomUUID()
  await mkdir(join(directory, attempt))
  record.transcript = join(attempt, 'transcript.txt')
  record.answers = join(attempt, 'answers.json')
  await writeFile(join(directory, record.transcript), transcript, { flag: 'wx' })
  await writeFile(join(directory, record.answers), JSON.stringify(answers, null, 2) + '\n', { flag: 'wx' })
  record.scoredAt = new Date().toISOString()
  record.caseResults = record.scenario.checks.map(check => ({ ...check, ...answers.checks.find(answer => answer.id === check.id),
    scoring: 'human', reviewer: answers.reviewer, transcript: record.transcript }))
  record.status = record.caseResults.every(check => check.passed) ? 'passed' : 'failed'
  record.reason = 'Human-scored transcript. Host isolation remains unverified until C7b.'
  await writeFile(join(directory, 'run.json'), JSON.stringify(record, null, 2) + '\n')
  return record
}

async function compare(opts, results) {
  const before = await load(results, opts.without)
  const after = await load(results, opts.with)
  if (!before.transcript || !after.transcript) fail('Both runs need explicit scoring before comparison.')
  if (before.mode !== 'without' || after.mode !== 'with' || ['agent', 'model', 'criteriaHash', 'stage'].some(key => before[key] !== after[key]) ||
      before.scenario.id !== after.scenario.id || ['name', 'revision'].some(key => before.fixture[key] !== after.fixture[key]) ||
      ['fixture', 'request', 'answers', 'invocation'].some(key => canonicalJSON(before.scenario[key]) !== canonicalJSON(after.scenario[key]))) fail('Comparison requires the same scenario, fixture revision, agent, model, stage and criteria, with identical fixture names, requests, scripted answers and invocation modes.')
  const lost = before.caseResults.filter(check => check.passed && !after.caseResults.find(item => item.id === check.id)?.passed)
  const gained = after.caseResults.filter(check => check.passed && !before.caseResults.find(item => item.id === check.id)?.passed)
  return { status: !lost.length && (gained.length > 0 || before.caseResults.every(check => check.passed)) ? 'passed' : 'failed',
    without: before.id, with: after.id, lost: lost.map(check => check.id), gained: gained.map(check => check.id) }
}

try {
  const args = process.argv.slice(2)
  if (args.includes('--help')) console.log(help)
  else if (!args.length) fail('Select a manual scenario, score or compare. ' + help)
  else {
    const command = args[0].startsWith('--') ? 'start' : args.shift()
    const allowed = { start: ['scenario', 'mode', 'stage', 'agent', 'model', 'invocation'], score: ['run', 'answers', 'transcript'], compare: ['without', 'with'] }
    if (!Object.hasOwn(allowed, command)) fail(`Unknown command: ${command}`, 'usage-error')
    const opts = options(args, [...allowed[command], 'results'], command === 'start' ? ['manual'] : [])
    const results = resolve(opts.results ?? defaultResults)
    const data = await ({ start, score, compare })[command](opts, results)
    if (!opts.json && command === 'start') console.log(JSON.stringify(data, null, 2))
    emitResult({ command: `eval ${command}`, status: data.status, data }, opts.json)
  }
} catch (error) {
  // Bad manual evidence must leave the saved run blocked rather than imply a result.
  emitResult({ command: 'eval', status: error.status === 'usage-error' ? error.status : 'blocked',
    problems: error.problems ?? [{ code: 'evaluation-blocked', message: error.message, fix: 'Follow docs/evaluation.md and retry with complete evidence.' }] }, process.argv.includes('--json'))
}
