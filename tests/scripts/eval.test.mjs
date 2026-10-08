import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, mkdir, chmod, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Each test invokes the real command with disposable evaluation records.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function run(directory, ...args) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'eval.mjs'), ...args, '--results', directory, '--json'], { encoding: 'utf8' })
  return { ...result, data: JSON.parse(result.stdout) }
}

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack eval é & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

function start(t, directory, mode = 'without', ...extra) {
  const result = run(directory, '--manual', '--scenario', 'ambiguous-idea', '--mode', mode, '--stage', 'baseline', '--agent', 'test-host', '--model', 'test-model', ...extra)
  assert.equal(result.status, 2, result.stdout)
  const record = result.data.data
  assert.ok(record.id, result.stdout)
  t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
  return record
}

async function inputs(directory, record, passed = true) {
  const answers = { schemaVersion: 1, runId: record.id, reviewer: 'Fixture reviewer', checks: [{ id: 'decision', passed, startLine: 1, endLine: 2 }] }
  const answersPath = join(directory, `${record.id}.answers.json`)
  const transcriptPath = join(directory, `${record.id}.transcript.txt`)
  await writeFile(answersPath, JSON.stringify(answers))
  await writeFile(transcriptPath, 'User: Offline access is unresolved.\nAgent: Which option do you want? I will stop until it is resolved.\n')
  return { answers, answersPath, transcriptPath }
}

test('manual run prints its fixture, request, scripted answers and checklist with unique history paths', async t => {
  const directory = await temporary(t)
  const first = start(t, directory)
  const second = start(t, directory)
  assert.notEqual(first.id, second.id)
  assert.notEqual(first.fixture.path, second.fixture.path)
  assert.equal(first.fixture.revision, second.fixture.revision)
  assert.equal(first.status, 'blocked')
  assert.equal(first.isolation.verified, false)
  assert.ok(first.request)
  assert.ok(first.scenario.answers.length)
  assert.equal(first.scenario.checks[0].caseId, 'AC-2')
  assert.equal(JSON.parse(await readFile(join(directory, first.id, 'run.json'), 'utf8')).id, first.id)
})

for (const missing of ['answers', 'transcript']) {
  test(`missing ${missing} leaves manual scoring blocked`, async t => {
    const directory = await temporary(t)
    const record = start(t, directory)
    const files = await inputs(directory, record)
    const args = missing === 'answers' ? ['--transcript', files.transcriptPath] : ['--answers', files.answersPath]
    assert.equal(run(directory, 'score', '--run', record.id, ...args).status, 2)
    assert.equal(JSON.parse(await readFile(join(directory, record.id, 'run.json'), 'utf8')).status, 'blocked')
  })
}

for (const [name, mutate] of [
  ['missing checklist answer', answers => { answers.checks = [] }],
  ['duplicate checklist answer', answers => { answers.checks.push(answers.checks[0]) }],
  ['unknown checklist answer', answers => { answers.checks[0].id = 'unknown' }],
  ['wrong run', answers => { answers.runId = 'other' }],
  ['string verdict', answers => { answers.checks[0].passed = 'yes' }],
  ['invalid transcript range', answers => { answers.checks[0].endLine = 3 }],
  ['missing reviewer', answers => { answers.reviewer = '' }]
]) {
  test(`manual scoring blocks ${name}`, async t => {
    const directory = await temporary(t)
    const record = start(t, directory)
    const files = await inputs(directory, record)
    mutate(files.answers)
    await writeFile(files.answersPath, JSON.stringify(files.answers))
    assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 2)
    assert.equal(JSON.parse(await readFile(join(directory, record.id, 'run.json'), 'utf8')).transcript, null)
  })
}

test('empty and unavailable transcripts leave a run blocked', async t => {
  const directory = await temporary(t)
  const record = start(t, directory)
  const files = await inputs(directory, record)
  await writeFile(files.transcriptPath, ' \n')
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 2)
  await rm(files.transcriptPath)
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 2)
})

test('comparison blocks different models and unscored runs', async t => {
  const directory = await temporary(t)
  const baseline = start(t, directory)
  const result = run(directory, '--manual', '--scenario', 'ambiguous-idea', '--mode', 'with', '--stage', 'baseline', '--agent', 'test-host', '--model', 'other-model', '--invocation', '/repo-audit')
  const withSkill = result.data.data
  assert.ok(withSkill.id)
  t.after(() => rm(withSkill.fixture.path, { recursive: true, force: true }))
  assert.equal(run(directory, 'compare', '--without', baseline.id, '--with', withSkill.id).status, 2)
  for (const record of [baseline, withSkill]) {
    const files = await inputs(directory, record)
    assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 0)
  }
  const comparison = run(directory, 'compare', '--without', baseline.id, '--with', withSkill.id)
  assert.equal(comparison.status, 2)
  assert.match(comparison.stdout, /same scenario, fixture revision, agent, model, stage and criteria/)
})

for (const [section, field, value] of [
  ['scenario', 'fixture', 'ts-rule-proof'],
  ['fixture', 'name', 'ts-rule-proof'],
  ['scenario', 'request', 'Audit this existing repository.'],
  ['scenario', 'answers', ['Choose online access instead.']],
  ['scenario', 'invocation', 'implicit']
]) {
  for (const mode of ['without', 'with']) {
    test(`comparison blocks changed ${section}.${field} in the ${mode} run`, async t => {
      const directory = await temporary(t)
      const baseline = start(t, directory)
      const withSkill = start(t, directory, 'with', '--invocation', '/repo-audit')
      for (const [record, passed] of [[baseline, false], [withSkill, true]]) {
        const files = await inputs(directory, record, passed)
        assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, passed ? 0 : 1)
      }
      const changed = mode === 'without' ? baseline : withSkill
      const path = join(directory, changed.id, 'run.json')
      const record = JSON.parse(await readFile(path, 'utf8'))
      record[section][field] = value
      await writeFile(path, JSON.stringify(record))
      const comparison = run(directory, 'compare', '--without', baseline.id, '--with', withSkill.id)
      assert.equal(comparison.status, 2, comparison.stdout)
      assert.equal(comparison.data.status, 'blocked')
    })
  }
}

for (const passed of [true, false]) {
  test(`manual scoring records a ${passed ? 'passing' : 'failing'} reviewer verdict and preserves its transcript`, async t => {
    const directory = await temporary(t)
    const record = start(t, directory)
    const files = await inputs(directory, record, passed)
    const result = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath)
    assert.equal(result.status, passed ? 0 : 1)
    const scored = result.data.data
    assert.equal(scored.caseResults[0].scoring, 'human')
    assert.equal(scored.caseResults[0].reviewer, 'Fixture reviewer')
    assert.equal(scored.caseResults[0].startLine, 1)
    assert.equal(await readFile(join(directory, record.id, scored.transcript), 'utf8'), await readFile(files.transcriptPath, 'utf8'))
    assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 2)
    const selectionPath = join(directory, 'selection.json')
    await writeFile(selectionPath, JSON.stringify({ schemaVersion: 1, selections: [{ caseId: 'AC-2', runId: record.id, stage: record.stage, revision: record.sourceRevision }] }))
    const selection = spawnSync(process.execPath, [join(root, 'scripts', 'acceptance.mjs'), '--selections', selectionPath, '--results', directory], { encoding: 'utf8' })
    assert.equal(selection.status, 2)
    assert.match(selection.stdout, passed ? /unverified host isolation/ : /no passing scored evidence/)
  })
}

test('ordinary with-skill runs require explicit invocation while implicit runs omit it', async t => {
  const directory = await temporary(t)
  assert.equal(run(directory, '--manual', '--scenario', 'ambiguous-idea', '--mode', 'with', '--stage', 'baseline', '--agent', 'test', '--model', 'test').status, 3)
  const record = start(t, directory, 'with', '--invocation', '/repo-audit')
  assert.match(record.request, /^\/repo-audit\n/)
  const implicit = run(directory, '--manual', '--scenario', 'implicit-invocation', '--mode', 'with', '--stage', 'baseline', '--agent', 'test', '--model', 'test')
  assert.equal(implicit.status, 2)
  t.after(() => rm(implicit.data.data.fixture.path, { recursive: true, force: true }))
  assert.equal(implicit.data.data.request, 'audit this repo')
})

for (const [before, after, expected] of [[true, true, 0], [false, true, 0], [true, false, 1], [false, false, 1]]) {
  test(`comparison honours baseline ${before} and with-skill ${after}`, async t => {
    const directory = await temporary(t)
    const baseline = start(t, directory)
    const withSkill = start(t, directory, 'with', '--invocation', '/repo-audit')
    for (const [record, passed] of [[baseline, before], [withSkill, after]]) {
      const files = await inputs(directory, record, passed)
      run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath)
    }
    assert.equal(run(directory, 'compare', '--without', baseline.id, '--with', withSkill.id).status, expected)
  })
}

test('automatic host execution requires an adapter', async t => {
  const directory = await temporary(t)
  assert.equal(run(directory, '--scenario', 'new-idea', '--mode', 'without', '--stage', 'baseline', '--agent', 'test', '--model', 'test').status, 2)
})

async function adapterFile(directory, mode = 'success') {
  const adapter = JSON.parse(await readFile(join(root, 'tests/eval/adapters/codex.json'), 'utf8'))
  adapter.executable = 'node'
  adapter.isolation.authentication = 'none'
  const fake = join(root, 'tests/inputs/evaluation-host.mjs')
  adapter.args = [fake, mode, ...adapter.args]
  adapter.versionArgs = [fake, '--version']
  adapter.invocation.resumeArgs = [fake, mode, ...adapter.invocation.resumeArgs]
  const path = join(directory, 'adapter.json')
  await writeFile(path, JSON.stringify(adapter))
  return { adapter, path }
}

function hostStart(t, directory, path, mode = 'without', scenario = 'ambiguous-idea') {
  const result = run(directory, '--scenario', scenario, '--mode', mode, '--stage', 'baseline', '--adapter', path)
  const record = result.data.data
  if (record) {
    t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
    if (record.isolation.home) t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  }
  return { result, record }
}

test('host runs use fresh homes, caches, fixtures, threads and transcripts without discoverable repo-audit', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record: first } = hostStart(t, directory, path)
  const { record: second } = hostStart(t, directory, path)
  assert.equal(first.isolation.verified, true)
  assert.deepEqual(first.isolation.discovered, [])
  assert.equal(first.tools.agent, 'fake-codex 1')
  assert.notEqual(first.id, second.id)
  assert.notEqual(first.fixture.path, second.fixture.path)
  assert.notEqual(first.isolation.home, second.isolation.home)
  assert.notEqual(first.sessionId, second.sessionId)
  const observed = JSON.parse(first.turns[0].result.stdout.split('\n')[1]).item.observed
  assert.equal(observed.home, first.isolation.home)
  assert.equal(observed.state, first.isolation.state)
  assert.equal(observed.cache, join(first.isolation.home, 'cache'))
  assert.equal(observed.cwd, first.fixture.path)
  assert.equal(observed.message, first.scenario.request)
  assert.ok((await readFile(join(directory, first.id, first.conversation), 'utf8')).includes(first.request))
})

test('with-skill staging preserves resources and ordinary invocation while implicit invocation sends only the request', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  for (const scenario of ['ambiguous-idea', 'implicit-invocation']) {
    const { record } = hostStart(t, directory, path, 'with', scenario)
    assert.equal(record.isolation.verified, true)
    assert.deepEqual(record.isolation.discovered, [join(record.isolation.stagedPath, 'SKILL.md')])
    assert.equal(record.request, scenario === 'ambiguous-idea' ? '$repo-audit\n' + record.scenario.request : 'audit this repo')
    assert.equal(await readFile(join(record.isolation.stagedPath, 'scripts/repo-audit.mjs'), 'utf8'),
      await readFile(join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), 'utf8'))
  }
})

test('scripted replies resume the exact host conversation, preserve user turns and require ordered answers', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record } = hostStart(t, directory, path)
  assert.equal(run(directory, 'turn', '--run', record.id).status, 2)
  assert.equal(run(directory, 'turn', '--run', record.id, '--answer', '2').status, 2)
  const reply = run(directory, 'turn', '--run', record.id, '--answer', '1').data.data
  assert.equal(reply.turns.length, 2)
  assert.equal(reply.turns[1].sessionId, record.sessionId)
  assert.equal(reply.turns[1].message, record.scenario.answers[0])
  assert.equal(reply.nextAnswer, 2)
  assert.equal(run(directory, 'turn', '--run', record.id, '--answer', '1').status, 2)
  const transcript = await readFile(join(directory, record.id, record.conversation), 'utf8')
  assert.ok(transcript.includes('User: ' + record.scenario.answers[0]))
})

test('manual adapter preparation is rejected before creating a run', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const rejected = run(directory, '--scenario', 'ambiguous-idea', '--mode', 'without', '--stage', 'baseline', '--adapter', path, '--manual')
  assert.equal(rejected.status, 3)
  assert.match(rejected.stdout, /Omit --manual/)
  assert.deepEqual(await readdir(directory), ['adapter.json'])
})

for (const mode of ['fail', 'malformed', 'incomplete', 'contaminate', 'truncate', 'hang']) {
  test(`host ${mode} remains blocked and retains available execution evidence`, async t => {
    const directory = await temporary(t)
    const { path, adapter } = await adapterFile(directory, mode)
    if (mode === 'hang') {
      adapter.timeoutMs = 1000
      await writeFile(path, JSON.stringify(adapter))
    }
    const { record, result } = hostStart(t, directory, path)
    assert.equal(result.status, 2, result.stdout)
    assert.equal(record.status, 'blocked')
    assert.equal(record.turns.length, 1)
    assert.equal(record.turns[0].sessionId, null)
    assert.ok(record.reason)
    assert.equal(record.turns[0].result.timedOut, mode === 'hang')
    await assert.rejects(readFile(join(record.isolation.home, '.codex', 'fake-session.json')), { code: 'ENOENT' })
  })
}

test('a resumed host turn cannot silently switch sessions', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'wrong-session')
  const { record } = hostStart(t, directory, path)
  const reply = run(directory, 'turn', '--run', record.id, '--answer', '1').data.data
  assert.equal(reply.isolation.verified, false)
  assert.equal(reply.turns[1].sessionId, null)
  assert.equal(reply.nextAnswer, 1)
})

for (const mode of ['without', 'with']) {
  test(`rejected ${mode}-skill citations can be corrected without another host turn`, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory)
    const { record } = hostStart(t, directory, path, mode)
    const files = await inputs(directory, record)
    const transcriptPath = join(directory, record.id, record.conversation)
    await writeFile(files.answersPath, JSON.stringify({ ...files.answers,
      checks: [{ ...files.answers.checks[0], endLine: 100000 }] }))
    const rejected = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath)
    assert.equal(rejected.status, 2)
    assert.match(rejected.stdout, /Invalid transcript location/)
    assert.equal(JSON.parse(await readFile(join(record.isolation.state, 'fake-session.json'), 'utf8')).id, record.sessionId)
    await writeFile(files.answersPath, JSON.stringify(files.answers))
    const scored = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath)
    assert.equal(scored.status, 0, scored.stdout)
    assert.deepEqual(scored.data.data.turns, record.turns)
    assert.equal(scored.data.data.sessionId, record.sessionId)
    assert.ok(scored.data.data.isolation.cleanedAt)
  })

  test(`a ${mode}-skill score artifact failure preserves cleanup for retry`, {
    skip: process.platform === 'win32' || process.getuid?.() === 0
  }, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory)
    const { record } = hostStart(t, directory, path, mode)
    const files = await inputs(directory, record)
    const runDirectory = join(directory, record.id)
    const transcriptPath = join(runDirectory, record.conversation)
    await chmod(runDirectory, 0o500)
    let rejected
    try { rejected = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath) }
    finally { await chmod(runDirectory, 0o700) }
    assert.equal(rejected.status, 2)
    assert.match(rejected.stdout, /EACCES/)
    const saved = JSON.parse(await readFile(join(runDirectory, 'run.json'), 'utf8'))
    assert.ok(saved.isolation.cleanedAt)
    assert.equal(saved.isolation.verified, true)
    assert.ok(saved.conversationHash)
    assert.equal(saved.transcript, null)
    await assert.rejects(readFile(join(record.isolation.state, 'fake-session.json')), { code: 'ENOENT' })
    const scored = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath)
    assert.equal(scored.status, 0, scored.stdout)
    assert.deepEqual(scored.data.data.turns, record.turns)
  })
}

test('adapter scoring requires the captured conversation and rechecks isolation and staged bytes', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record } = hostStart(t, directory, path, 'with')
  const files = await inputs(directory, record)
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 2)
  const transcriptPath = join(directory, record.id, record.conversation)
  await writeFile(join(record.isolation.stagedPath, 'SKILL.md'), '---\nname: repo-audit\n---\nchanged\n')
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath).status, 2)
  await assert.rejects(readFile(join(record.isolation.stagedPath, 'SKILL.md')), { code: 'ENOENT' })
  const rejected = JSON.parse(await readFile(join(directory, record.id, 'run.json'), 'utf8'))
  assert.ok(rejected.isolation.cleanedAt)
  assert.equal(rejected.isolation.verified, false)
  assert.equal(run(directory, 'turn', '--run', record.id, '--answer', '1').status, 2)
  const { record: fresh } = hostStart(t, directory, path, 'with')
  const freshFiles = await inputs(directory, fresh)
  const scored = run(directory, 'score', '--run', fresh.id, '--answers', freshFiles.answersPath, '--transcript', join(directory, fresh.id, fresh.conversation))
  assert.equal(scored.status, 0, scored.stdout)
  assert.equal(scored.data.data.isolation.verified, true)
  assert.equal(run(directory, 'turn', '--run', fresh.id, '--answer', '1').status, 2)
})

for (const [name, mutate] of [
  ['shell string', adapter => { adapter.args = 'codex exec' }],
  ['unknown field', adapter => { adapter.shell = true }],
  ['unsupported conversation', adapter => { adapter.invocation.protocol = 'stdin' }],
  ['unbounded timeout', adapter => { adapter.timeoutMs = 120001 }],
  ['missing message placeholder', adapter => { adapter.args = ['exec'] }],
  ['wrong discovery paths', adapter => { adapter.isolation.discoveryPaths = [] }],
  ['escaping staging path', adapter => { adapter.isolation.stagePath = '../skill' }]
]) {
  test(`adapter blocks ${name} before creating a run`, async t => {
    const directory = await temporary(t)
    const { path, adapter } = await adapterFile(directory)
    mutate(adapter)
    await writeFile(path, JSON.stringify(adapter))
    const result = run(directory, '--scenario', 'ambiguous-idea', '--mode', 'without', '--stage', 'baseline', '--adapter', path)
    assert.equal(result.status, 2, result.stdout)
    assert.deepEqual(result.data.data, {})
  })
}

test('closing a conversation deletes isolated state and retains bound evidence for later scoring', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record } = hostStart(t, directory, path)
  const closed = run(directory, 'close', '--run', record.id).data.data
  assert.equal(closed.isolation.verified, true)
  assert.ok(closed.isolation.cleanedAt)
  await assert.rejects(readFile(join(record.isolation.state, 'fake-session.json')), { code: 'ENOENT' })
  const files = await inputs(directory, record)
  const transcriptPath = join(directory, record.id, record.conversation)
  const original = await readFile(transcriptPath, 'utf8')
  await writeFile(transcriptPath, original + 'replaced\n')
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath).status, 2)
  await writeFile(transcriptPath, original)
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath).status, 0)
})

test('throwaway authentication copies only a dummy login with private permissions and removes it after the turn', async t => {
  const directory = await temporary(t)
  const source = join(directory, 'invoking-state')
  await mkdir(source)
  await writeFile(join(source, 'auth.json'), 'dummy test login')
  await writeFile(join(source, 'config.toml'), 'must not be copied')
  const { path, adapter } = await adapterFile(directory, 'require-auth')
  adapter.isolation.authentication = 'throwaway-codex-login'
  await writeFile(path, JSON.stringify(adapter))
  const execution = spawnSync(process.execPath, [join(root, 'scripts/eval.mjs'), '--scenario', 'ambiguous-idea', '--mode', 'without',
    '--stage', 'baseline', '--adapter', path, '--results', directory, '--json'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: source } })
  const record = JSON.parse(execution.stdout).data
  assert.equal(record.turns[0].result.status, 'passed', execution.stdout)
  t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
  t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  assert.equal(record.authenticatedVia, 'throwaway copy')
  await assert.rejects(readFile(join(record.isolation.state, 'auth.json')), { code: 'ENOENT' })
  await assert.rejects(readFile(join(record.isolation.state, 'config.toml')), { code: 'ENOENT' })
  assert.equal(await readFile(join(source, 'auth.json'), 'utf8'), 'dummy test login')
  await rm(join(source, 'auth.json'))
  const reply = spawnSync(process.execPath, [join(root, 'scripts/eval.mjs'), 'turn', '--run', record.id, '--answer', '1',
    '--results', directory, '--json'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: source } })
  const failed = JSON.parse(reply.stdout).data
  assert.equal(failed.hostFailure, true)
  assert.equal(failed.isolation.verified, false)
  await assert.rejects(readFile(join(record.isolation.state, 'fake-session.json')), { code: 'ENOENT' })
  const files = await inputs(directory, record)
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath,
    '--transcript', join(directory, record.id, record.conversation)).status, 2)
})
