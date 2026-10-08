import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { platform, release } from 'node:os'
import { root, text, object, array, options, scenario, readJSON, fail } from './lib/evaluation.mjs'
import { validateData, validateIds } from '../skills/repo-audit/scripts/lib/schema.mjs'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { runCommand } from '../skills/repo-audit/scripts/lib/run.mjs'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'
import { readAdapter, isolate, hostTurn, closeHost, redactEvidence } from './lib/evaluation-host.mjs'

// Manual runs remain separate from task evidence and final selections.
const defaultResults = join(root, 'tests', 'eval', 'results', 'runs')
// Adapter runs capture host turns, while unsupported hosts retain the manual interface.
const help = 'eval --scenario <id> --mode without|with --stage <checkpoint> --adapter <file> [--results <directory>] [--json]\neval --manual --scenario <id> --mode without|with --stage <checkpoint> --agent <name> --model <name> [--invocation <explicit-command>] [--results <directory>] [--json]\neval turn --run <id> --answer <one-based-script-index> [--results <directory>] [--json]\neval close --run <id> [--results <directory>] [--json]\neval score --run <id> --answers <file> --transcript <file> [--results <directory>] [--json]\neval compare --without <id> --with <id> [--results <directory>] [--json]'

async function child(executable, args, targetRoot = root) {
  const result = await runCommand({ root: targetRoot }, { executable, args, cwd: '.', versionArgs: ['--version'], timeoutMs: 120000 })
  if (result.status !== 'passed') fail(`${executable} failed: ${result.stderr || result.error}`, result.status)
  return result
}

async function start(opts, results) {
  if (opts.manual && opts.adapter) fail('Adapter runs capture the opening turn automatically. Omit --manual, or omit --adapter and supply --agent and --model for a manual run.', 'usage-error')
  for (const name of ['scenario', 'mode', 'stage', ...(opts.adapter ? [] : ['agent', 'model'])]) if (!opts[name]?.trim()) fail(`Missing --${name}`, 'usage-error')
  if (!['without', 'with'].includes(opts.mode)) fail('Mode must be without or with.', 'usage-error')
  const definition = await scenario(opts.scenario)
  if (!definition.checkpoints.includes(opts.stage)) fail(`Unknown checkpoint: ${opts.stage}`, 'usage-error')
  const adapter = opts.adapter ? await readAdapter(resolve(opts.adapter)) : null
  if (!opts.manual && !adapter) fail('Automatic execution requires --adapter. Use --manual for unsupported hosts.')
  if (adapter) {
    if (opts.agent || opts.model || opts.invocation) fail('The adapter owns agent, model and invocation. Omit these options.', 'usage-error')
    opts.agent = adapter.invocation.agent
    opts.model = adapter.invocation.model
    if (opts.mode === 'with' && definition.invocation === 'explicit') opts.invocation = adapter.invocation.explicit
  }
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
    stage: opts.stage, mode: opts.mode, request: (opts.invocation ? `${opts.invocation}\n` : '') +
      (opts.stage === 'foundation' ? 'Active checkpoint: foundation.\n' : '') + definition.request,
    status: 'blocked', reason: 'Awaiting explicit manual answers and transcript. Host isolation is not verified by C7a.',
    isolation: { verified: false }, transcript: null, answers: null, caseResults: [] }
  if (definition.fixture.startsWith('ts-')) {
    record.tools.npm = (await child('npm', ['--version'], fixture.path)).stdout.trim()
    record.tools.typescript = (await child('node', [join('node_modules', 'typescript', 'bin', 'tsc'), '--version'], fixture.path)).stdout.trim()
  }
  if (adapter) {
    record.adapter = adapter
    record.adapterHash = hashBytes(canonicalJSON(adapter))
    record.turns = []
    record.nextAnswer = 1
    record.sessionId = null
    record.conversation = 'conversation.txt'
    try {
      await isolate(record)
      await captureTurn(record, record.request, directory)
    } catch (error) {
      record.reason = error.message
      record.hostFailure = true
      if (record.isolation.home) await closeHost(record, directory).catch(() => { record.isolation.verified = false })
    }
  }
  await saveRecord(record, directory, 'wx')
  return record
}

async function captureTurn(record, message, directory) {
  // Retain even failed host output as evidence rather than manufacturing a score.
  try {
    await hostTurn(record, message)
    record.reason = 'Host turn captured. Review the question, send its scripted answer with eval turn, then score the transcript.'
  } finally {
    const transcript = record.turns.map(turn => `User: ${turn.message}\nHost JSONL:\n${turn.result.stdout}\nHost stderr:\n${turn.result.stderr}\n`).join('\n')
    await writeFile(join(directory, record.conversation), redactEvidence(transcript, record))
  }
}

async function turn(opts, results) {
  const record = await load(results, opts.run)
  if (!record.adapter || !record.sessionId || record.transcript || record.isolation.cleanedAt) fail('Host turns require an open, unscored adapter conversation. A failed opening needs a fresh run.')
  if (!/^[1-9]\d*$/.test(opts.answer ?? '') || Number(opts.answer) !== record.nextAnswer ||
      !record.scenario.answers[record.nextAnswer - 1]) fail('Supply the next one-based scripted answer index after reviewing the corresponding host question.')
  const message = record.scenario.answers[record.nextAnswer - 1]
  try {
    await captureTurn(record, message, join(results, record.id))
    record.nextAnswer++
  } catch (error) {
    record.reason = error.message
    record.hostFailure = true
    record.isolation.verified = false
    await closeHost(record, join(results, record.id)).catch(() => { record.isolation.verified = false })
  }
  await saveRecord(record, join(results, record.id))
  return record
}

async function close(opts, results) {
  const record = await load(results, opts.run)
  if (!record.adapter) fail('Only adapter conversations have an isolated host to close.')
  try { await closeHost(record, join(results, record.id)) }
  catch (error) { record.reason = error.message }
  await saveRecord(record, join(results, record.id))
  return record
}

async function load(results, id) {
  if (!/^[\dTZ.-]+-[0-9a-f-]{36}$/.test(id ?? '')) fail('Supply a run ID printed by eval.', 'usage-error')
  return await readJSON(join(results, id, 'run.json'))
}

async function saveRecord(record, directory, flag) {
  const content = JSON.stringify(record, null, 2) + '\n'
  // Open run records are private operational state required for resume and isolation checks.
  const evidence = record.adapter && !record.isolation.cleanedAt && !record.transcript ? content : redactEvidence(content, record)
  await writeFile(join(directory, 'run.json'), evidence, { flag })
  return JSON.parse(evidence)
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
  if (record.adapter) {
    if (record.hostFailure || !record.turns?.length || record.turns.some(turn => !turn.sessionId)) fail('Adapter scoring requires completed host turns. Use the manual procedure for unsupported conversations.')
    if (transcript !== await readFile(join(results, record.id, record.conversation), 'utf8')) fail('Score the captured adapter conversation without replacing its transcript.')
    if (record.isolation.cleanedAt) {
      if (!record.isolation.verified || record.conversationHash !== hashBytes(transcript)) fail('Closed host evidence has unverified isolation or a changed conversation.')
    } else {
      try { await closeHost(record, directory) }
      finally { await saveRecord(record, directory) }
    }
  }
  const attempt = randomUUID()
  await mkdir(join(directory, attempt))
  record.transcript = join(attempt, 'transcript.txt')
  record.answers = join(attempt, 'answers.json')
  record.caseResults = record.scenario.checks.map(check => ({ ...check, ...answers.checks.find(answer => answer.id === check.id),
    scoring: 'human', reviewer: answers.reviewer, transcript: record.transcript }))
  const evidence = redactEvidence(transcript, record)
  await writeFile(join(directory, record.transcript), evidence, { flag: 'wx' })
  await writeFile(join(directory, record.answers), redactEvidence(JSON.stringify(answers, null, 2) + '\n', record), { flag: 'wx' })
  if (record.adapter) {
    await writeFile(join(directory, record.conversation), evidence)
    record.conversationHash = hashBytes(evidence)
  }
  record.scoredAt = new Date().toISOString()
  record.status = record.caseResults.every(check => check.passed) ? 'passed' : 'failed'
  record.reason = record.adapter ? 'Human-scored captured host conversation with verified discovery isolation.' : 'Human-scored transcript. Host isolation remains unverified for this manual host.'
  return await saveRecord(record, directory)
}

async function compare(opts, results) {
  const before = await load(results, opts.without)
  const after = await load(results, opts.with)
  if (!before.transcript || !after.transcript) fail('Both runs need explicit scoring before comparison.')
  if (before.adapterHash !== after.adapterHash) fail('Comparison requires the same host adapter and execution settings.')
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
    const allowed = { start: ['scenario', 'mode', 'stage', 'agent', 'model', 'invocation', 'adapter'], turn: ['run', 'answer'], close: ['run'], score: ['run', 'answers', 'transcript'], compare: ['without', 'with'] }
    if (!Object.hasOwn(allowed, command)) fail(`Unknown command: ${command}`, 'usage-error')
    const opts = options(args, [...allowed[command], 'results'], command === 'start' ? ['manual'] : [])
    const results = resolve(opts.results ?? defaultResults)
    const data = await ({ start, turn, close, score, compare })[command](opts, results)
    if (!opts.json && command === 'start') console.log(JSON.stringify(data, null, 2))
    emitResult({ command: `eval ${command}`, status: data.status, data }, opts.json)
  }
} catch (error) {
  // Bad manual evidence must leave the saved run blocked rather than imply a result.
  emitResult({ command: 'eval', status: error.status === 'usage-error' ? error.status : 'blocked',
    problems: error.problems ?? [{ code: 'evaluation-blocked', message: error.message, fix: 'Follow docs/evaluation.md and retry with complete evidence.' }] }, process.argv.includes('--json'))
}
