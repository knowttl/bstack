import { appendFile, mkdir, readFile, realpath, rename, rm, statfs, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { freemem, platform, release } from 'node:os'
import { root, text, object, array, options, scenario, readJSON, fail, verifiedExecution, isApprovedBaseline, fixtureHash } from './lib/evaluation.mjs'
import { validateData, validateIds } from '../skills/repo-audit/scripts/lib/schema.mjs'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { runCommand } from '../skills/repo-audit/scripts/lib/run.mjs'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'
import { readAdapter, isolate, hostTurn, closeHost, redactEvidence, candidateSkillHash } from './lib/evaluation-host.mjs'
import { scoreChecks, validateScore, correctedScore } from './lib/evaluation-scoring.mjs'
import { readJudge, judgeAnswers } from './lib/evaluation-judge.mjs'

// Manual runs remain separate from task evidence and final selections.
const defaultResults = join(root, 'tests', 'eval', 'results', 'runs')
// Judge grading remains explicit so callers can audit answers before score publication.
const judgeHelp = 'eval judge --run <id> [--judge <config.json>] [--transcript <manual-file>] [--results <directory>] [--json]\nDefault: Claude Sonnet 5.5 medium in the disposable container. Writes answers.json for eval score; real calibration must pass before release adoption.\nExamples:\n  npm run eval -- judge --run <id> --json\n  npm run eval -- judge --run <id> --judge judge.json --results <directory> --json'
// Batch capture and grading are separate until the judge is available.
const batchHelp = 'eval batch --tier smoke|full --mode without|with --adapter <file> [--repeat 5] [--concurrency 6] [--scenario <id,id>] [--stage <checkpoint>] [--results <directory>] [--json]\neval batch --batch <id> [--results <directory>] [--json]\nConcurrency: 1 to 6. Stage defaults to each scenario\'s last checkpoint. Captures all scripted replies and closes every host. Score pending runs with eval score, then finalize with --batch to append aggregate ledger lines.\nExamples:\n  npm run eval -- batch --tier smoke --mode without --adapter tests/eval/adapters/codex.json\n  npm run eval -- batch --tier full --scenario ambiguous-idea,clear-goals --stage baseline --mode without --adapter tests/eval/adapters/codex.json --repeat 3 --concurrency 2\n  npm run eval -- batch --batch <id>'
// Adapter runs capture host turns, while unsupported hosts retain the manual interface.
const help = 'eval --scenario <id> --mode without|with --stage <checkpoint> --adapter <file> [--repo <maintained-fixture>] [--results <directory>] [--json]\neval --manual --scenario <id> --mode without|with --stage <checkpoint> --agent <name> --model <name> [--invocation <explicit-command>] [--results <directory>] [--json]\neval turn --run <id> --answer <one-based-script-index> [--results <directory>] [--json]\neval close --run <id> [--results <directory>] [--json]\neval score --run <id> --answers <file> --transcript <file> [--results <directory>] [--json]\neval correct --run <id> --correction <file> [--results <directory>] [--json]\neval compare --without <id> --with <id> [--results <directory>] [--json]\n--repo reuses an explicit disposable maintained fixture for a final adapter follow-up; the caller owns its preservation and cleanup.'

async function child(executable, args, targetRoot = root) {
  const result = await runCommand({ root: targetRoot }, { executable, args, cwd: '.', versionArgs: ['--version'], timeoutMs: 120000 })
  if (result.status !== 'passed') fail(`${executable} failed: ${result.stderr || result.error}`, result.status)
  return result
}

async function capacity(concurrency = 6) {
  const disk = await statfs(root)
  const memory = platform() === 'linux'
    ? Number(/MemAvailable:\s+(\d+) kB/.exec(await readFile('/proc/meminfo', 'utf8'))?.[1]) * 1024
    : freemem()
  if (!(disk.bavail * disk.bsize >= 20_000_000_000 && memory >= concurrency * 4 * 1024 ** 3)) {
    fail(`Evaluation startup requires at least 20 GB free disk and ${concurrency * 4} GiB available memory. Start again when capacity is available.`)
  }
}

function openingRequest(opts, definition) {
  return (opts.invocation ? `${opts.invocation}\n` : '') +
    (['foundation', 'final'].includes(opts.stage) ? `Active checkpoint: ${opts.stage}.\n` : '') + definition.request
}

function batchInputs(record) {
  const inputs = { scenario: record.scenario, request: record.request, adapter: record.adapter,
    adapterHash: record.adapterHash, criteriaHash: record.criteriaHash, fixtureHash: record.fixture.revision,
    agent: record.agent, model: record.model, stage: record.stage, mode: record.mode }
  return hashBytes(canonicalJSON(JSON.parse(redactEvidence(JSON.stringify(inputs), record))))
}

async function start(opts, results, frozen = null) {
  if (opts.manual && opts.adapter) fail('Adapter runs capture the opening turn automatically. Omit --manual, or omit --adapter and supply --agent and --model for a manual run.', 'usage-error')
  for (const name of ['scenario', 'mode', 'stage', ...(opts.adapter ? [] : ['agent', 'model'])]) if (!opts[name]?.trim()) fail(`Missing --${name}`, 'usage-error')
  if (!['without', 'with'].includes(opts.mode)) fail('Mode must be without or with.', 'usage-error')
  const definition = frozen ? structuredClone(frozen.definition) : await scenario(opts.scenario)
  opts.mode = definition.mode ?? opts.mode
  if (!definition.checkpoints.includes(opts.stage)) fail(`Unknown checkpoint: ${opts.stage}`, 'usage-error')
  const adapter = frozen ? structuredClone(frozen.adapter) : opts.adapter ? await readAdapter(resolve(opts.adapter), definition.id) : null
  if (!opts.manual && !adapter) fail('Automatic execution requires --adapter. Use --manual for unsupported hosts.')
  if (adapter) {
    if (opts.agent || opts.model || opts.invocation) fail('The adapter owns agent, model and invocation. Omit these options.', 'usage-error')
    opts.agent = adapter.invocation.agent
    opts.model = adapter.invocation.model
    if (opts.mode === 'with' && definition.invocation === 'explicit') opts.invocation = adapter.invocation.explicit
  }
  if (opts.mode === 'with' && definition.invocation === 'explicit' && !opts.invocation?.trim()) fail('An ordinary with-skill run requires --invocation for the current host.', 'usage-error')
  if (opts.invocation && (opts.mode === 'without' || definition.invocation === 'implicit')) fail('Baseline and implicit runs use the outcome request without --invocation.', 'usage-error')
  if (opts.repo && (!adapter || opts.stage !== 'final')) fail('--repo requires a final-stage adapter follow-up.', 'usage-error')
  // A batch checks its resource budget once before creating any run resources.
  if (adapter && !frozen) await capacity()
  const git = await child('git', ['rev-parse', 'HEAD'])
  const revision = git.stdout.trim()
  const fixtureRevision = await fixtureHash(definition.fixture)
  if (frozen && (revision !== frozen.candidate || fixtureRevision !== frozen.fixtureRevision)) fail('Batch candidate or fixture inputs changed before execution.')
  let fixture
  if (opts.repo) {
    const path = await realpath(resolve(opts.repo))
    if ((await child('git', ['rev-parse', '--show-toplevel'], path)).stdout.trim() !== path) fail('--repo must name the disposable maintained repository root.')
    fixture = { name: definition.fixture, path, kind: 'repo', reused: true,
      head: (await child('git', ['rev-parse', 'HEAD'], path)).stdout.trim(),
      workingTree: (await child('git', ['status', '--porcelain=v1'], path)).stdout }
  } else {
    const built = await child('node', ['tests/fixtures/build.mjs', definition.fixture])
    fixture = JSON.parse(built.stdout.trim())
  }
  if (frozen && await fixtureHash(definition.fixture) !== frozen.fixtureRevision) {
    await rm(fixture.path, { recursive: true, force: true })
    fail('Batch fixture inputs changed during preparation.')
  }
  const id = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
  const directory = join(results, id)
  await mkdir(directory, { recursive: true })
  const record = { schemaVersion: 1, id, createdAt: new Date().toISOString(), sourceRevision: revision,
    agent: opts.agent, model: opts.model, os: `${platform()} ${release()}`, tools: { node: process.version, git: git.toolVersion.stdout.trim() },
    fixture: { ...fixture, revision: fixtureRevision }, scenario: definition, criteriaHash: hashBytes(canonicalJSON(definition.checks)),
    stage: opts.stage, mode: opts.mode, request: openingRequest(opts, definition),
    status: 'blocked', reason: 'Awaiting explicit manual answers and transcript. Host isolation is not verified by C7a.',
    isolation: { verified: false }, transcript: null, answers: null, caseResults: [] }
  if (definition.fixture.startsWith('ts-') || definition.fixture === 'maintained-ts-shop') {
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
    if (frozen) {
      await saveRecord(record, directory, 'wx')
      await frozen.register(record)
    }
    try {
      await isolate(record, frozen?.skillHash)
      await captureTurn(record, record.request, directory)
    } catch (error) {
      record.reason = error.message
      record.hostFailure = true
      if (record.isolation.home) await closeHost(record, directory).catch(() => { record.isolation.verified = false })
    }
    if (record.installer) await writeFile(join(directory, 'installer.json'), redactEvidence(JSON.stringify(record.installer, null, 2) + '\n', record))
  }
  await saveRecord(record, directory, frozen ? undefined : 'wx')
  return record
}

async function captureTurn(record, message, directory) {
  // Retain even failed host output as evidence rather than manufacturing a score.
  try {
    await hostTurn(record, message)
    record.reason = 'Host turn captured. Deliver the next scripted answer with eval turn, then score the transcript.'
  } finally {
    const transcript = record.turns.map(turn => `User: ${turn.message}\nHost JSONL:\n${turn.result.stdout}\nHost stderr:\n${turn.result.stderr}\n`).join('\n')
    await writeFile(join(directory, record.conversation), redactEvidence(transcript, record))
  }
}

async function turn(opts, results) {
  const { record } = await load(results, opts.run)
  if (!record.adapter || !record.sessionId || record.transcript || record.isolation.cleanedAt) fail('Host turns require an open, unscored adapter conversation. A failed opening needs a fresh run.')
  if (!/^[1-9]\d*$/.test(opts.answer ?? '') || Number(opts.answer) !== record.nextAnswer ||
      !record.scenario.answers[record.nextAnswer - 1]) fail('Supply the next one-based scripted answer index.')
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
  const { record } = await load(results, opts.run)
  if (!record.adapter) fail('Only adapter conversations have an isolated host to close.')
  try { await closeHost(record, join(results, record.id)) }
  catch (error) { record.reason = error.message }
  await saveRecord(record, join(results, record.id))
  return record
}

async function batch(opts, results) {
  if (opts.batch) {
    if (Object.keys(opts).some(key => !['batch', 'results', 'json'].includes(key))) fail('Finalize with --batch and --results only.', 'usage-error')
    if (!/^[0-9a-f-]{36}$/.test(opts.batch)) fail('Supply the batch ID printed by eval batch.', 'usage-error')
    return await finishBatch(await readJSON(join(results, 'batches', `${opts.batch}.json`)), results)
  }
  for (const name of ['tier', 'mode', 'adapter']) if (!opts[name]?.trim()) fail(`Missing --${name}`, 'usage-error')
  if (!['smoke', 'full'].includes(opts.tier)) fail('Tier must be smoke or full.', 'usage-error')
  if (!['without', 'with'].includes(opts.mode)) fail('Mode must be without or with.', 'usage-error')
  for (const name of ['repeat', 'concurrency']) {
    opts[name] ??= name === 'repeat' ? '5' : '6'
    if (!/^[1-9]\d*$/.test(opts[name]) || !Number.isSafeInteger(Number(opts[name]))) fail(`--${name} must be a positive integer.`, 'usage-error')
  }
  const concurrency = Number(opts.concurrency)
  if (concurrency > 6) fail('--concurrency must be between 1 and 6 to fit the container budget.', 'usage-error')
  // The approved smoke set precedes scenario-owned tier metadata.
  const smoke = ['existing-repo', 'existing-repo-python', 'clear-goals', 'ambiguous-idea', 'implicit-invocation',
    'verification-limitations', 'scope-and-prerequisites', 'research-main-typescript', 'maintenance', 'selected-rule-relocation']
  const registry = await readJSON(join(root, 'tests/eval/scenarios/scenarios.json'))
  const selected = opts.scenario ? opts.scenario.split(',') : opts.tier === 'smoke' ? smoke : registry.scenarios.map(item => item.id)
  if (new Set(selected).size !== selected.length) fail('Scenario subsets must contain unique comma-separated IDs.', 'usage-error')
  const candidate = (await child('git', ['rev-parse', 'HEAD'])).stdout.trim()
  let skillHash = null
  const frozen = {}
  for (const id of selected) {
    const definition = await scenario(id)
    if (opts.tier === 'smoke' && !smoke.includes(id)) fail(`Scenario ${id} is outside the smoke tier. Use --tier full.`, 'usage-error')
    if (opts.stage !== undefined && !definition.checkpoints.includes(opts.stage)) fail(`Unknown checkpoint for ${id}: ${opts.stage}`, 'usage-error')
    const adapter = await readAdapter(resolve(opts.adapter), id)
    const stage = opts.stage ?? definition.checkpoints.at(-1)
    const fixtureRevision = await fixtureHash(definition.fixture)
    const mode = definition.mode ?? opts.mode
    if (mode === 'with') skillHash ??= candidateSkillHash(candidate)
    frozen[id] = { candidate, skillHash: mode === 'with' ? skillHash : null, definition, adapter, stage, fixtureRevision, mode }
  }
  await capacity(concurrency)
  const record = { schemaVersion: 1, id: randomUUID(), date: new Date().toISOString(),
    candidate, skillHash, inputs: Object.fromEntries(selected.map(id => {
      const { definition, adapter, stage, fixtureRevision, mode } = frozen[id]
      return [id, batchInputs({ scenario: definition, adapter, adapterHash: hashBytes(canonicalJSON(adapter)),
        criteriaHash: hashBytes(canonicalJSON(definition.checks)), fixture: { revision: fixtureRevision },
        agent: adapter.invocation.agent, model: adapter.invocation.model, stage, mode,
        request: openingRequest({ stage, invocation: mode === 'with' && definition.invocation === 'explicit' ? adapter.invocation.explicit : null }, definition) })]
    })), tier: opts.tier, mode: opts.mode,
    stage: opts.stage ?? null, repeat: Number(opts.repeat), concurrency, scenarios: selected, runIds: [], fixtures: [], errors: [] }
  await mkdir(join(results, 'batches'), { recursive: true, mode: 0o700 })
  const inventory = join(results, 'batches', `${record.id}.json`)
  await writeFile(inventory, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  let saved = Promise.resolve()
  function persist() {
    const bytes = JSON.stringify(record, null, 2) + '\n'
    saved = saved.then(async () => {
      await writeFile(`${inventory}.tmp`, bytes, { mode: 0o600 })
      await rename(`${inventory}.tmp`, inventory)
    })
    return saved
  }
  async function register(run) {
    record.runIds.push(run.id)
    record.fixtures.push({ runId: run.id, scenario: run.scenario.id, path: run.fixture.path })
    await persist()
  }
  const jobs = selected.flatMap(id => Array.from({ length: record.repeat }, () => id))
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (jobs.length) {
      const id = jobs.shift()
      try {
        let run = await start({ scenario: id, mode: frozen[id].mode, stage: frozen[id].stage, adapter: opts.adapter }, results, { ...frozen[id], register })
        try {
          while (!run.hostFailure && run.nextAnswer <= run.scenario.answers.length) {
            run = await turn({ run: run.id, answer: String(run.nextAnswer) }, results)
          }
        } finally { await close({ run: run.id }, results) }
      } catch (error) {
        record.errors.push({ scenario: id, reason: error.message })
        await persist()
      }
    }
  }))
  await saved
  return await finishBatch(record, results)
}

async function finishBatch(batch, results) {
  const runs = await Promise.all(batch.runIds.map(async id => {
    const { record } = await load(results, id)
    return await correctedScore(join(results, id), record)
  }))
  const pending = runs.filter(run => !run.transcript || run.hostFailure || !run.isolation.cleanedAt || !run.isolation.verified || !verifiedExecution(run)).map(run => run.id)
  const errors = [...batch.errors, ...runs.filter(run => run.hostFailure).map(run =>
    ({ scenario: run.scenario.id, runId: run.id, reason: run.reason }))]
  const entries = []
  for (const id of batch.scenarios) {
    const group = runs.filter(run => run.scenario.id === id)
    if (!group.length) continue
    const first = group[0]
    const execution = group.find(run => !run.hostFailure)?.execution
    if (group.some(run => run.sourceRevision !== batch.candidate || run.mode !== (first.scenario.mode ?? batch.mode) || run.stage !== (batch.stage ?? first.scenario.checkpoints.at(-1)) ||
        batchInputs(run) !== batch.inputs?.[id] || (!run.hostFailure && run.isolation.skillHash !== (run.mode === 'with' ? batch.skillHash : null)) ||
        (!run.hostFailure && ['imageId', 'recipeHash', 'toolchain'].some(key => canonicalJSON(run.execution?.[key]) !== canonicalJSON(execution?.[key]))))) fail('Batch runs no longer match their candidate and execution inputs.')
    for (const check of first.scenario.checks) {
      const verdicts = group.map(run => run.caseResults.find(item => item.id === check.id) ?? run.machineResults?.find(item => item.id === check.id))
      entries.push({ date: batch.date, candidate: batch.candidate, tier: batch.tier, model: first.model,
        adapterHash: first.adapterHash, fixtureHash: first.fixture.revision, criteriaHash: first.criteriaHash,
        scenario: id, mode: first.mode, check: check.id, caseId: check.caseId,
        passes: verdicts.filter(item => item?.passed === true).length, runs: group.length,
        pending: verdicts.filter(item => typeof item?.passed !== 'boolean').length, runIds: group.map(run => run.id).sort() })
    }
  }
  const ledger = join(results === defaultResults ? resolve(defaultResults, '..') : results, 'ledger.jsonl')
  if (pending.length || batch.errors.length || runs.length !== batch.scenarios.length * batch.repeat || entries.some(entry => entry.pending)) {
    return { status: 'blocked', batch: batch.id, ledger, runIds: batch.runIds, pending, errors, checks: entries,
      reason: 'Score every completed conversation with eval score, then finalize with eval batch --batch <id> using the same --results directory. Failed captures require a fresh batch.' }
  }
  // Serialize ledger writers without making a second command wait or retry.
  const lock = `${ledger}.lock`
  let owned = false
  let interrupted = 0
  const handlers = Object.entries({ SIGINT: 130, SIGTERM: 143, SIGHUP: 129 })
    .map(([signal, code]) => [signal, () => { interrupted = code }])
  for (const [signal, handler] of handlers) process.on(signal, handler)
  try {
    try { await mkdir(lock); owned = true }
    catch (error) {
      if (error.code === 'EEXIST') fail('Another batch is appending the ledger. Finalize again after it finishes.')
      throw error
    }
    let existing = []
    try { existing = (await readFile(ledger, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    const lines = entries.map(({ pending, ...entry }) => entry).filter(entry => {
      const saved = existing.find(saved => saved.check === entry.check && saved.scenario === entry.scenario &&
        canonicalJSON(saved.runIds) === canonicalJSON(entry.runIds))
      if (saved && canonicalJSON(saved) !== canonicalJSON(entry)) fail('Published batch grades changed. Preserve the ledger and capture a fresh batch.')
      return !saved
    })
    if (interrupted) fail('Ledger finalization interrupted.')
    if (lines.length) await appendFile(ledger, lines.map(entry => JSON.stringify(entry) + '\n').join(''))
    return { status: 'passed', batch: batch.id, ledger, runIds: batch.runIds, appended: lines.length, checks: entries }
  } finally {
    try { if (owned) await rm(lock, { recursive: true }) }
    finally {
      for (const [signal, handler] of handlers) process.removeListener(signal, handler)
      if (interrupted) process.exit(interrupted)
    }
  }
}

async function load(results, id) {
  if (!/^[\dTZ.-]+-[0-9a-f-]{36}$/.test(id ?? '')) fail('Supply a run ID printed by eval.', 'usage-error')
  const bytes = await readFile(join(results, id, 'run.json'))
  return { record: JSON.parse(bytes), bytes }
}

async function saveRecord(record, directory, flag) {
  const content = JSON.stringify(record, null, 2) + '\n'
  // Open run records are private operational state required for resume and isolation checks.
  const evidence = record.adapter && !record.isolation.cleanedAt && !record.transcript ? content : redactEvidence(content, record)
  await writeFile(join(directory, 'run.json'), evidence, { flag })
  return JSON.parse(evidence)
}

async function score(opts, results) {
  const { record } = await load(results, opts.run)
  if (!opts.answers || !opts.transcript) fail('Missing answers or transcript. The run remains blocked.')
  if (record.transcript) fail('This run is already scored. Create a fresh run to keep checkpoint history.')
  const answers = await readJSON(resolve(opts.answers))
  validateData(object({ schemaVersion: { const: 1 }, runId: text, reviewer: text, checks: array(object({
    id: text, passed: { type: 'boolean' }, startLine: { type: 'integer' }, endLine: { type: 'integer' }
  })) }), answers)
  validateIds(answers.checks, '$/checks')
  if (answers.reviewer.trim().length < 3 || /^\d+$/.test(answers.reviewer.trim())) fail('Reviewer identities must contain at least three characters and cannot be purely numeric.')
  const judge = answers.reviewer.startsWith('judge:')
  if (judge && !/^judge:[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(answers.reviewer)) fail('Judge reviewer must name a model as judge:<model>.')
  const reviewer = judge ? answers.reviewer : '[redacted: user name]'
  for (const check of record.scenario.checks.filter(check => check.machine)) {
    const result = record.machineResults?.find(result => result.id === check.id)
    if (!record.adapter || !result || typeof result.passed !== 'boolean') fail(`Missing captured machine assertion: ${check.id}. Use an adapter run.`)
    answers.checks = answers.checks.filter(answer => answer.id !== check.id)
    answers.checks.push({ id: check.id, passed: result.passed, startLine: 1, endLine: 1 })
  }
  if (answers.runId !== record.id || answers.checks.length !== record.scenario.checks.length ||
      record.scenario.checks.some(check => !answers.checks.some(answer => answer.id === check.id))) fail('Answers must name this run, a reviewer and every checklist ID exactly once.')
  const transcript = await readFile(resolve(opts.transcript), 'utf8')
  if (!transcript.trim()) fail('Transcript is empty. The run remains blocked.')
  const lines = transcript.trimEnd().split(/\r?\n/).length
  for (const answer of answers.checks) if (answer.startLine < 1 || answer.endLine < answer.startLine || answer.endLine > lines) fail(`Invalid transcript location for ${answer.id}`)
  validateScore(record, answers, transcript)
  const directory = join(results, record.id)
  if (record.adapter) {
    if (record.hostFailure || !record.turns?.length || record.turns.some(turn => !turn.sessionId)) fail('Adapter scoring requires completed host turns. Use the manual procedure for unsupported conversations.')
    if (!verifiedExecution(record)) fail('Adapter scoring requires verified evaluation filesystem scope.')
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
  const redaction = { ...record, caseResults: [{ reviewer: answers.reviewer }] }
  record.caseResults = record.scenario.checks.map(check => ({ ...check, ...answers.checks.find(answer => answer.id === check.id),
    scoring: check.machine ? 'machine' : judge ? 'judge' : 'human', reviewer, transcript: record.transcript }))
  const evidence = redactEvidence(transcript, redaction)
  await writeFile(join(directory, record.transcript), evidence, { flag: 'wx' })
  await writeFile(join(directory, record.answers), redactEvidence(JSON.stringify({ ...answers, reviewer }, null, 2) + '\n', redaction), { flag: 'wx' })
  if (record.adapter) {
    await writeFile(join(directory, record.conversation), evidence)
    record.conversationHash = hashBytes(evidence)
  }
  record.scoredAt = new Date().toISOString()
  record.status = record.caseResults.every(check => check.passed) ? 'passed' : 'failed'
  record.reason = `${judge ? 'Judge' : 'Human'}-scored ` + (record.adapter ? 'captured host conversation with verified discovery isolation.' : 'transcript. Host isolation remains unverified for this manual host.')
  return await saveRecord(JSON.parse(redactEvidence(JSON.stringify(record), redaction)), directory)
}

async function judge(opts, results) {
  const config = await readJudge(resolve(opts.judge ?? join(root, 'tests/eval/judge/claude.json')))
  const { record } = await load(results, opts.run)
  if (record.transcript) fail('This run is already scored. Calibration reads historical runs separately.')
  if (!record.conversation && !opts.transcript) fail('Supply --transcript for a manual run.', 'usage-error')
  const transcript = await readFile(opts.transcript ? resolve(opts.transcript) : join(results, record.id, record.conversation), 'utf8')
  if (record.adapter && (record.hostFailure || !record.isolation.cleanedAt || !record.isolation.verified ||
      !verifiedExecution(record) || record.conversationHash !== hashBytes(transcript))) fail('Judge requires an unchanged captured conversation with verified cleanup.')
  const directory = join(results, record.id, 'judge')
  // Reserve the invocation before spending so accidental repeats cannot call the model twice.
  await mkdir(directory)
  const { answers, evidence } = await judgeAnswers(config, record, transcript)
  const path = join(directory, 'answers.json')
  await writeFile(path, JSON.stringify(answers, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  await writeFile(join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  return { status: 'passed', runId: record.id, answers: path, model: config.model,
    reason: 'Pass these answers and the captured transcript to eval score. Human audit is required for every blocking verdict and one random run per smoke scenario per release.' }
}

async function compare(opts, results) {
  const baseline = await load(results, opts.without)
  const withSkill = await load(results, opts.with)
  const before = await correctedScore(join(results, opts.without), baseline.record)
  const after = await correctedScore(join(results, opts.with), withSkill.record)
  if (!before.transcript || !after.transcript) fail('Both runs need explicit scoring before comparison.')
  for (const record of [before, after]) validateScore(record, { runId: record.id, checks: record.caseResults },
    await readFile(join(results, record.id, record.transcript), 'utf8'))
  if (before.adapterHash !== after.adapterHash) fail('Comparison requires the same host adapter and execution settings.')
  if (before.adapter && [baseline, withSkill].some(({ record, bytes }) =>
    !(record.execution ? verifiedExecution(record) : isApprovedBaseline(record, bytes)))) fail('Comparison requires the same verified filesystem scope contract.')
  if (before.execution && after.execution && ['imageId', 'recipeHash', 'toolchain'].some(key => canonicalJSON(before.execution[key]) !== canonicalJSON(after.execution[key]))) fail('Comparison requires the same container image, recipe and toolchain.')
  if (before.mode !== 'without' || after.mode !== 'with' || ['agent', 'model', 'criteriaHash', 'stage'].some(key => before[key] !== after[key]) ||
      before.scenario.id !== after.scenario.id || ['name', 'revision'].some(key => before.fixture[key] !== after.fixture[key]) ||
      ['fixture', 'request', 'answers', 'invocation'].some(key => canonicalJSON(before.scenario[key]) !== canonicalJSON(after.scenario[key]))) fail('Comparison requires the same scenario, fixture revision, agent, model, stage and criteria, with identical fixture names, requests, scripted answers and invocation modes.')
  const lost = before.caseResults.filter(check => check.passed && !after.caseResults.find(item => item.id === check.id)?.passed)
  const gained = after.caseResults.filter(check => check.passed && !before.caseResults.find(item => item.id === check.id)?.passed)
  return { status: !lost.length && (gained.length > 0 || before.caseResults.every(check => check.passed)) ? 'passed' : 'failed',
    without: before.id, with: after.id, lost: lost.map(check => check.id), gained: gained.map(check => check.id) }
}

async function correct(opts, results) {
  const { record } = await load(results, opts.run)
  if (!record.transcript || !record.answers) fail('Only a scored run can receive an append-only correction.')
  if (!opts.correction) fail('Supply --correction with a corrector, reason, evidence lines and complete checks.', 'usage-error')
  const correction = await readJSON(resolve(opts.correction))
  validateData(object({ corrector: text, reason: text,
    evidence: object({ startLine: { type: 'integer' }, endLine: { type: 'integer' } }), checks: scoreChecks }), correction)
  const directory = join(results, record.id)
  const bound = { schemaVersion: 1, runId: record.id, correctedAt: new Date().toISOString(), ...correction,
    originalAnswers: record.answers, originalAnswersSha256: hashBytes(await readFile(join(directory, record.answers), 'utf8')),
    conversationSha256: hashBytes(await readFile(join(directory, record.transcript), 'utf8')) }
  const corrected = await correctedScore(directory, record, bound)
  await writeFile(join(directory, 'score-correction.json'), redactEvidence(JSON.stringify(bound, null, 2) + '\n', record), { flag: 'wx' })
  return corrected
}

try {
  const args = process.argv.slice(2)
  if (args.includes('--help')) console.log(args[0] === 'batch' ? batchHelp : args[0] === 'judge' ? judgeHelp : batchHelp + '\n' + judgeHelp + '\n' + help)
  else if (!args.length) fail('Select a batch, manual scenario, score or compare. ' + batchHelp + '\n' + help)
  else {
    const command = args[0].startsWith('--') ? 'start' : args.shift()
    const allowed = { batch: ['batch', 'tier', 'repeat', 'concurrency', 'scenario', 'mode', 'stage', 'adapter'], start: ['scenario', 'mode', 'stage', 'agent', 'model', 'invocation', 'adapter', 'repo'], turn: ['run', 'answer'], close: ['run'], judge: ['run', 'judge', 'transcript'], score: ['run', 'answers', 'transcript'], correct: ['run', 'correction'], compare: ['without', 'with'] }
    if (!Object.hasOwn(allowed, command)) fail(`Unknown command: ${command}`, 'usage-error')
    const opts = options(args, [...allowed[command], 'results'], command === 'start' ? ['manual'] : [])
    const results = resolve(opts.results ?? defaultResults)
    const data = await ({ batch, start, turn, close, judge, score, correct, compare })[command](opts, results)
    if (!opts.json && command === 'judge') console.log(`answers: ${data.answers}\n${data.reason}`)
    if (!opts.json && command === 'start') console.log(JSON.stringify(data, null, 2))
    if (!opts.json && command === 'batch') console.log([
      `batch: ${data.batch}`, ...data.runIds.map(id => `run: ${id}`),
      `pending: ${data.pending?.join(', ') || 'none'}`,
      ...(data.errors ?? []).map(error => `${error.scenario}${error.runId ? ` (${error.runId})` : ''}: ${error.reason}`),
      ...(data.reason ? [data.reason.replace('<id>', data.batch)] : []), `ledger: ${data.ledger}`
    ].join('\n'))
    emitResult({ command: `eval ${command}`, status: data.status, data }, opts.json)
  }
} catch (error) {
  // Bad manual evidence must leave the saved run blocked rather than imply a result.
  emitResult({ command: 'eval', status: error.status === 'usage-error' ? error.status : 'blocked',
    problems: error.problems ?? [{ code: 'evaluation-blocked', message: error.message, fix: 'Follow docs/evaluation.md and retry with complete evidence.' }] }, process.argv.includes('--json'))
}
