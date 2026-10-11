import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, mkdir, chmod, readdir, rename, stat, symlink } from 'node:fs/promises'
import { homedir, tmpdir, userInfo } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { redactEvidence } from '../../scripts/lib/evaluation-host.mjs'

// Each test invokes the real command with disposable evaluation records.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function run(directory, ...args) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'eval.mjs'), ...args, '--results', directory, '--json'], { encoding: 'utf8', env: testEnvironment(directory) })
  return { ...result, data: JSON.parse(result.stdout) }
}

function testEnvironment(directory) {
  return { ...process.env, PATH: `${join(directory, 'bin')}${delimiter}${process.env.PATH}`, TEST_DOCKER_STATE: directory }
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

test('manual scoring publishes redacted records, transcripts and answers with intact verdicts and citations', async t => {
  const directory = await temporary(t)
  const record = start(t, directory)
  const files = await inputs(directory, record)
  const username = userInfo().username
  files.answers.reviewer = username
  await writeFile(files.answersPath, JSON.stringify(files.answers))
  const transcript = `User: ${username} opened ${record.fixture.path}\r\n` +
    `Agent: Read ${homedir()}/notes; {"thread_id":"manual-host-session"}\r\n`
  await writeFile(files.transcriptPath, transcript)
  const result = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath)
  assert.equal(result.status, 0, result.stdout)
  const saved = await readFile(join(directory, record.id, 'run.json'), 'utf8')
  const scored = JSON.parse(saved)
  assert.deepEqual(result.data.data, scored)
  assert.equal(scored.fixture.path, '[fixture]')
  assert.equal(scored.isolation.verified, false)
  assert.equal(scored.status, 'passed')
  assert.equal(scored.caseResults[0].reviewer, '[redacted: user name]')
  assert.equal(scored.caseResults[0].passed, true)
  assert.equal(scored.caseResults[0].startLine, 1)
  assert.equal(scored.caseResults[0].endLine, 2)
  const publishedTranscript = await readFile(join(directory, record.id, scored.transcript), 'utf8')
  assert.equal(publishedTranscript, 'User: [redacted: user name] opened [scratch-path]\r\n' +
    'Agent: Read [host-home]/notes; {"thread_id":"[identifier]"}\r\n')
  const publishedAnswers = await readFile(join(directory, record.id, scored.answers), 'utf8')
  assert.deepEqual(JSON.parse(publishedAnswers), { ...files.answers, reviewer: '[redacted: user name]' })
  assert.equal(await readFile(files.transcriptPath, 'utf8'), transcript)
  assert.equal(JSON.parse(await readFile(files.answersPath, 'utf8')).reviewer, username)
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

for (const [name, event, expected] of [
  ['assistant claim without execution', { type: 'item.completed', item: { type: 'agent_message', text: 'Both units passed.' } }, 2],
  ['unrun command', { type: 'item.started', item: { type: 'command_execution', command: 'node --test unit.test.mjs' } }, 2],
  ['failed suite', { type: 'item.completed', item: { type: 'command_execution', command: 'node --test unit.test.mjs', aggregated_output: '# pass 1\n# fail 1\n', exit_code: 1 } }, 2],
  ['captured passing suite', { type: 'item.completed', item: { type: 'command_execution', command: 'node --test unit.test.mjs', aggregated_output: '# pass 2\n# fail 0\n', exit_code: 0 } }, 0],
  ['captured npm unit script', { type: 'item.completed', item: { type: 'command_execution', command: 'npm run test', aggregated_output: '> test\n> node --test unit.test.mjs\nℹ pass 2\nℹ fail 0\n', exit_code: 0 } }, 0],
  ['discussed npm units without execution', { type: 'item.completed', item: { type: 'agent_message', text: 'npm run test passed: 2 passed, 0 failed, exit 0.' } }, 2],
  ['npm unit script with nonzero exit', { type: 'item.completed', item: { type: 'command_execution', command: 'npm run test', aggregated_output: 'ℹ pass 2\nℹ fail 0\n', exit_code: 1 } }, 2],
  ['wrapped passing units with a preflight and failed journey', { type: 'item.completed', item: {
    type: 'command_execution', command: 'python3 gate.py run-checks', exit_code: 1,
    aggregated_output: '{"source":"host","permitted":true}\n' + JSON.stringify({ command: 'run-checks', status: 'failed',
      data: { checks: [{ command: { executable: 'python3', args: ['leaf.py', 'units'] }, status: 'passed', satisfied: true,
        execution: { status: 'passed', exitCode: 0, stdout: '# pass 2\n# fail 0\n',
          toolVersion: { status: 'passed', stdout: process.version + '\n' } } }] } }) + '\nexit=1\n'
  } }, 0],
  ['wrapped units with a different native version', { type: 'item.completed', item: {
    type: 'command_execution', command: 'python3 gate.py run-checks', exit_code: 0,
    aggregated_output: JSON.stringify({ command: 'run-checks', data: { checks: [{ command: { executable: 'python3', args: ['leaf.py', 'units'] },
      status: 'passed', satisfied: true, execution: { status: 'passed', exitCode: 0, stdout: '# pass 2\n# fail 0\n',
        toolVersion: { status: 'passed', stdout: 'v0.0.0\n' } } }] } })
  } }, 2],
  ['wrapped truncated units', { type: 'item.completed', item: {
    type: 'command_execution', command: 'python3 gate.py run-checks', exit_code: 0,
    aggregated_output: JSON.stringify({ command: 'run-checks', data: { checks: [{ command: { executable: 'python3', args: ['leaf.py', 'units'] },
      status: 'passed', satisfied: true, execution: { status: 'passed', exitCode: 0, stdout: '# pass 2\n# fail 0\n', outputTruncated: true,
        toolVersion: { status: 'passed', stdout: process.version + '\n' } } }] } })
  } }, 2]
]) {
  test(`AC-29 scoring requires actual passing unit evidence: ${name}`, async t => {
    const directory = await temporary(t)
    const started = run(directory, '--manual', '--scenario', 'verification-limitations', '--mode', 'without',
      '--stage', 'final', '--agent', 'test-host', '--model', 'test-model').data.data
    t.after(() => rm(started.fixture.path, { recursive: true, force: true }))
    const answers = join(directory, 'answers.json')
    const transcript = join(directory, 'transcript.txt')
    await writeFile(answers, JSON.stringify({ schemaVersion: 1, runId: started.id, reviewer: 'Fixture reviewer',
      checks: started.scenario.checks.map(check => ({ id: check.id, passed: true, startLine: 1, endLine: 1 })) }))
    await writeFile(transcript, JSON.stringify(event) + '\n')
    const scored = run(directory, 'score', '--run', started.id, '--answers', answers, '--transcript', transcript)
    assert.equal(scored.status, expected, scored.stdout)
  })
}

test('append-only correction changes comparison without modifying the original score and refuses overwrite or stale evidence', async t => {
  const directory = await temporary(t)
  const before = start(t, directory)
  const after = start(t, directory, 'with', '--invocation', '$repo-audit')
  for (const record of [before, after]) {
    const files = await inputs(directory, record)
    assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath).status, 0)
  }
  const original = await readFile(join(directory, before.id, 'run.json'), 'utf8')
  const record = JSON.parse(original)
  const originalAnswers = await readFile(join(directory, before.id, record.answers), 'utf8')
  const originalTranscript = await readFile(join(directory, before.id, record.transcript), 'utf8')
  const correction = join(directory, 'correction.json')
  await writeFile(correction, JSON.stringify({ corrector: 'Fixture corrector', reason: 'The initial score incorrectly credited the unresolved decision.',
    evidence: { startLine: 1, endLine: 2 }, checks: [{ id: 'decision', passed: false, startLine: 1, endLine: 2 }] }))
  const corrected = run(directory, 'correct', '--run', before.id, '--correction', correction)
  assert.equal(corrected.data.data.caseResults[0].passed, false, corrected.stdout)
  assert.equal(await readFile(join(directory, before.id, 'run.json'), 'utf8'), original)
  assert.equal(await readFile(join(directory, before.id, record.answers), 'utf8'), originalAnswers)
  assert.equal(await readFile(join(directory, before.id, record.transcript), 'utf8'), originalTranscript)
  assert.deepEqual(run(directory, 'compare', '--without', before.id, '--with', after.id).data.data.gained, ['decision'])
  assert.equal(run(directory, 'correct', '--run', before.id, '--correction', correction).status, 2)
  await writeFile(join(directory, before.id, record.transcript), originalTranscript + 'Changed evidence.\n')
  assert.equal(run(directory, 'compare', '--without', before.id, '--with', after.id).status, 2)
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
    assert.equal(scored.caseResults[0].reviewer, '[redacted: user name]')
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
  await mkdir(join(directory, 'bin'), { recursive: true })
  try { await symlink(join(root, 'tests/inputs/docker.mjs'), join(directory, 'bin/docker')) } catch (error) { if (error.code !== 'EEXIST') throw error }
  try { await symlink(join(root, 'tests/inputs/processes.mjs'), join(directory, 'bin/ps')) } catch (error) { if (error.code !== 'EEXIST') throw error }
  const adapter = JSON.parse(await readFile(join(root, 'tests/eval/adapters/codex.json'), 'utf8'))
  adapter.executable = 'node'
  adapter.isolation.authentication = 'none'
  const fake = join(root, 'tests/inputs/evaluation-host.mjs')
  await mkdir(join(directory, 'outside-project'), { recursive: true })
  await writeFile(join(directory, 'outside-project', 'SKILL.md'), 'Outside project guidance\n')
  adapter.args = [fake, mode, '--scope-fixture', directory, ...adapter.args]
  adapter.versionArgs = [fake, '--version']
  adapter.invocation.resumeArgs = [fake, mode, '--scope-fixture', directory, ...adapter.invocation.resumeArgs]
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
    if (record.isolation.home) t.after(() => rm(record.isolation.home + '-other', { recursive: true, force: true }))
  }
  return { result, record }
}

for (const [scenario, mode] of [['research-main-typescript', 'require-no-subagents'],
  ['research-main-python', 'require-no-subagents'], ['ambiguous-idea', 'require-subagents']]) {
  test(`evaluation preserves the ${scenario} subagent policy on opening and resume`, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory, mode)
    const stage = scenario.startsWith('research-') ? 'discovery' : 'baseline'
    const started = run(directory, '--scenario', scenario, '--mode', 'without', '--stage', stage, '--adapter', path)
    const record = started.data.data
    t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
    t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
    assert.equal(record.hostFailure, undefined, started.stdout)
    // Empty-answer discovery scenarios cannot resume through the scripted CLI;
    // exercise their effective resume template at the same host boundary.
    const { hostTurn, closeHost } = await import('../../scripts/lib/evaluation-host.mjs')
    const previousPath = process.env.PATH
    process.env.PATH = testEnvironment(directory).PATH
    process.env.TEST_DOCKER_STATE = directory
    try { await hostTurn(record, 'Continue the capability control without changing its policy.') }
    finally { process.env.PATH = previousPath; delete process.env.TEST_DOCKER_STATE }
    assert.equal(record.turns.length, 2)
    assert.equal(record.turns[1].sessionId, record.turns[0].sessionId)
    await closeHost(record, join(directory, record.id))
    assert.equal(record.isolation.verified, true)
  })
}

test('fake-only ts-shop maintenance in with mode validates review and fresh standalone checks without an interview or full audit', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'maintenance')
  const result = run(directory, '--scenario', 'maintenance', '--mode', 'with', '--stage', 'maintenance', '--adapter', path)
  assert.equal(result.status, 2, result.stdout)
  const record = result.data.data
  t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
  t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  assert.equal(record.fixture.name, 'ts-shop')
  assert.equal(record.isolation.verified, true)
  const transcript = await readFile(join(directory, record.id, 'conversation.txt'), 'utf8')
  assert.match(transcript, /Fake-only bounded maintenance complete/)
  assert.match(transcript, /Existing checkout journey remains failed/)
  assert.doesNotMatch(transcript, /Which offline access option/)
  const assessment = JSON.parse(await readFile(join(record.fixture.path, '.bstack/assessment.json'), 'utf8'))
  assert.equal(assessment.documents[0].assessment.result, 'no-impact')
  assert.deepEqual(assessment.paths, ['packages/core/internal/database.ts'])
  assert.equal(record.status, 'blocked')
  assert.deepEqual(record.caseResults, [])
  const closed = run(directory, 'close', '--run', record.id)
  assert.equal(closed.status, 2, closed.stdout)
  assert.equal(closed.data.data.isolation.verified, true)
  assert.ok(closed.data.data.isolation.cleanedAt)
})

test('reviewer publication preserves JSON keys and scalar types while rejecting unsupported identities', async t => {
  for (const [reviewer, status] of [['Alice "Ali" Chen', 0], ['123', 2], ['id', 2]]) {
    await t.test(reviewer, async t => {
      const directory = await temporary(t)
      const record = start(t, directory)
      const files = await inputs(directory, record)
      files.answers.reviewer = reviewer
      await writeFile(files.answersPath, JSON.stringify(files.answers))
      const document = { id: 'stable', [reviewer]: reviewer, text: reviewer, nested: [{ [reviewer]: reviewer }], number: 123, passed: true }
      const transcript = JSON.stringify(document, null, '\t') + '\n'
      const redacted = redactEvidence(transcript, { caseResults: [{ reviewer }] })
      const expected = { ...document, [reviewer]: '[redacted: user name]', text: '[redacted: user name]', nested: [{ [reviewer]: '[redacted: user name]' }] }
      assert.deepEqual(JSON.parse(redacted), expected)
      assert.equal(redacted.split('\n').length, transcript.split('\n').length)
      assert.deepEqual(JSON.parse(JSON.parse(redactEvidence(JSON.stringify({ stdout: transcript }), { caseResults: [{ reviewer }] })).stdout), expected)
      await writeFile(files.transcriptPath, transcript)
      const result = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', files.transcriptPath)
      assert.equal(result.status, status, result.stdout)
      const saved = JSON.parse(await readFile(join(directory, record.id, 'run.json'), 'utf8'))
      assert.equal(saved.id, record.id)
      assert.equal(saved.scenario.id, record.scenario.id)
      assert.equal(saved.scenario.checks[0].id, 'decision')
      if (status === 2) {
        assert.equal(saved.transcript, null)
        assert.deepEqual(await readdir(join(directory, record.id)), ['run.json'])
      } else {
        assert.equal(saved.caseResults[0].reviewer, '[redacted: user name]')
        assert.equal(saved.caseResults[0].id, 'decision')
        assert.deepEqual(JSON.parse(await readFile(join(directory, record.id, saved.transcript), 'utf8')), expected)
        assert.deepEqual(JSON.parse(await readFile(join(directory, record.id, saved.answers), 'utf8')),
          { ...files.answers, reviewer: '[redacted: user name]' })
      }
    })
  }
})

test('supplied reviewer identities including quoted nicknames are redacted throughout scoring publication', async t => {
  for (const [host, reviewer, mode] of [
    ['manual', 'Alice Chen', 'reviewer'],
    ['adapter', 'Alice Chen', 'reviewer'],
    ['closed-adapter', 'Alice Chen', 'reviewer'],
    ['manual', 'Alice "Ali" Chen', 'reviewer-quoted'],
    ['adapter', 'Alice "Ali" Chen', 'reviewer-quoted'],
    ['closed-adapter', 'Alice "Ali" Chen', 'reviewer-quoted']
  ]) {
    await t.test(`${host}: ${reviewer}`, async t => {
      const directory = await temporary(t)
      const { path } = await adapterFile(directory, mode)
      const record = host === 'manual' ? start(t, directory) : hostStart(t, directory, path).record
      const files = await inputs(directory, record)
      files.answers.reviewer = reviewer
      assert.notEqual(files.answers.reviewer, userInfo().username)
      await writeFile(files.answersPath, JSON.stringify(files.answers))
      const transcriptPath = host === 'manual' ? files.transcriptPath : join(directory, record.id, record.conversation)
      if (host === 'manual') await writeFile(transcriptPath, `User: Review the evidence.\nReviewer: ${reviewer}\n`)
      if (host === 'closed-adapter') run(directory, 'close', '--run', record.id)
      const original = await readFile(transcriptPath, 'utf8')
      const result = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath)
      assert.equal(result.status, 0, result.stdout)
      const saved = await readFile(join(directory, record.id, 'run.json'), 'utf8')
      const scored = JSON.parse(saved)
      assert.deepEqual(result.data.data, scored)
      assert.ok(!saved.includes('Alice'))
      assert.equal(scored.caseResults[0].reviewer, '[redacted: user name]')
      assert.equal(scored.caseResults[0].passed, true)
      assert.equal(scored.caseResults[0].startLine, 1)
      assert.equal(scored.caseResults[0].endLine, 2)
      const transcript = await readFile(join(directory, record.id, scored.transcript), 'utf8')
      assert.equal(transcript, original.replaceAll(reviewer, '[redacted: user name]')
        .replaceAll(JSON.stringify(reviewer).slice(1, -1), '[redacted: user name]'))
      assert.deepEqual(JSON.parse(await readFile(join(directory, record.id, scored.answers), 'utf8')),
        { ...files.answers, reviewer: '[redacted: user name]' })
      if (host !== 'manual') {
        assert.equal(await readFile(transcriptPath, 'utf8'), transcript)
        assert.equal(scored.conversationHash, createHash('sha256').update(transcript).digest('hex'))
      }
    })
  }
})

test('host runs use fresh homes, caches, fixtures, threads and transcripts without discoverable repo-audit', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record: first } = hostStart(t, directory, path)
  const { record: second } = hostStart(t, directory, path)
  assert.equal(first.isolation.verified, true)
  assert.deepEqual(first.isolation.discovered, [])
  assert.equal(first.tools.agent, 'fake-codex 1')
  assert.equal(first.execution.method, 'docker')
  assert.deepEqual(first.execution.turns[0].mounts, [first.fixture.path, first.isolation.home].map(path =>
    ({ Type: 'bind', Source: path, Destination: path, RW: true })))
  assert.equal(first.execution.turns[0].network, 'bridge')
  assert.equal(first.execution.turns[0].privileged, false)
  assert.deepEqual(first.execution.turns[0].publishedPorts, [])
  assert.equal(first.execution.turns[0].verified, true)
  assert.ok(first.execution.turns[0].removedAt)
  assert.notEqual(first.id, second.id)
  assert.notEqual(first.fixture.path, second.fixture.path)
  assert.notEqual(first.isolation.home, second.isolation.home)
  assert.notEqual(first.sessionId, second.sessionId)
  const observed = JSON.parse(first.turns[0].result.stdout.split('\n')[1]).item.observed
  assert.equal(observed.home, first.isolation.home)
  assert.equal(observed.state, first.isolation.state)
  assert.equal(observed.cache, join(first.isolation.home, 'cache'))
  assert.equal(observed.temporaryDirectory, join(first.isolation.home, 'tmp'))
  assert.equal(observed.temporaryAlias, observed.temporaryDirectory)
  assert.equal(observed.temporaryWindowsAlias, observed.temporaryDirectory)
  if (process.platform !== 'win32') assert.equal((await stat(observed.temporaryDirectory)).mode & 0o777, 0o700)
  assert.equal(observed.cwd, first.fixture.path)
  assert.ok(observed.message.endsWith('\n\n' + first.scenario.request))
  assert.ok(observed.message.includes(`work only inside ${first.fixture.path} and ${first.isolation.home}`))
  assert.ok((await readFile(join(directory, first.id, first.conversation), 'utf8')).includes(first.request))
})

test('an unexpected container mount blocks agent execution and removes the container', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'container-extra-mount')
  const { record } = hostStart(t, directory, path)
  assert.equal(record.hostFailure, true)
  assert.match(record.reason, /container configuration/)
  assert.equal(record.turns.length, 0)
  assert.equal(record.execution.turns[0].verified, false)
  assert.ok(record.execution.turns[0].removedAt)
  assert.ok(record.isolation.cleanedAt)
  assert.equal((await readdir(directory)).filter(name => name.endsWith('.docker.json')).length, 0)
})

test('evaluation captures fresh aggregate host resource preflight without process inventories', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'host-preflight')
  const { record } = hostStart(t, directory, path)
  assert.equal(record.hostFailure, undefined, record.reason)
  assert.equal(record.resourcePreflight.source, 'host aggregate')
  assert.equal(record.resourcePreflight.checks.length, 2)
  const event = record.turns[0].result.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line))
    .find(event => event.item?.command === 'node "$BSTACK_EVAL_PREFLIGHT"')
  const observed = JSON.parse(event.item.aggregated_output)
  assert.equal(observed.source, 'host')
  assert.equal(observed.permitted, true)
  assert.ok(observed.existingNodeSuites >= 1)
  assert.deepEqual(observed, record.resourcePreflight.checks[1])
  await assert.rejects(stat(join(record.isolation.home, '.evaluation/preflight.sock')), { code: 'ENOENT' })
})

for (const [name, change] of [
  ['additional mount', turn => turn.mounts.push({ Type: 'bind', Source: '/unapproved', Destination: '/unapproved', RW: true })],
  ['published port', turn => turn.publishedPorts.push('8080:8080')],
  ['host networking', turn => { turn.network = 'host' }],
  ['missing cleanup', turn => { delete turn.removedAt }],
  ['different toolchain', turn => { turn.toolchain.agent = 'changed-agent' }]
]) {
  test(`container scoring rejects ${name} evidence`, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory)
    const { record } = hostStart(t, directory, path)
    change(record.execution.turns[0])
    await writeFile(join(directory, record.id, 'run.json'), JSON.stringify(record))
    const files = await inputs(directory, record)
    const scored = run(directory, 'score', '--run', record.id, '--answers', files.answersPath,
      '--transcript', join(directory, record.id, record.conversation))
    assert.equal(scored.status, 2)
    assert.match(scored.stdout, /verified evaluation filesystem scope/)
  })
}

for (const mode of ['scope-outside', 'scope-host-home', 'scope-cd-host-home', 'scope-relative',
  'scope-normalized-escape', 'scope-prefix', 'scope-native-read', 'scope-native-file-read', 'scope-native-file-write',
  'scope-native-relative', 'scope-other-skill', 'scope-resume', 'scope-resource-write',
  'scope-resource-system-write', 'scope-resource-temp-read', 'scope-resource-temp-write',
  'scope-resource-mixed', 'scope-resource-python-write', 'scope-resource-shared-capacity', 'scope-resource-shared-python-capacity',
  'scope-resource-relative-write']) {
  test(`evaluation retains advisory ${mode} observations without rejecting the turn`, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory, mode)
    const started = hostStart(t, directory, path)
    const result = mode === 'scope-resume' ? run(directory, 'turn', '--run', started.record.id, '--answer', '1') : started.result
    const record = result.data.data
    assert.equal(result.status, 2, result.stdout)
    assert.equal(record.hostFailure, undefined)
    assert.equal(record.scopeGuard.advisory, true)
    assert.equal(record.scopeGuard.verified, false)
    assert.ok(record.scopeGuard.paths.length > 0)
    assert.deepEqual([...new Set(record.scopeGuard.violations.map(item => item.target))].sort(), record.scopeGuard.paths)
    for (const observation of record.scopeGuard.violations) {
      assert.ok(observation.operation.trim())
      assert.match(observation.origin, /^(?:parent command|native .+ \(.+:\d+\))$/)
    }
    assert.equal(record.transcript, null)
    assert.equal(record.answers, null)
    assert.equal(record.isolation.verified, true)
    const closed = run(directory, 'close', '--run', record.id).data.data
    assert.ok(closed.isolation.cleanedAt)
    await assert.rejects(readFile(join(started.record.isolation.home, '.codex/fake-session.json')), { code: 'ENOENT' })
  })
}

for (const mode of ['scope-resource-read', 'scope-resource-processes', 'scope-resource-capacity', 'scope-resource-temp',
  'scope-resource-df-output', 'scope-resource-free-output', 'scope-resource-ps-output', 'scope-output', 'scope-native-output']) {
  test(`evaluation accepts read-only resource queries and owned scratch: ${mode}`, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory, mode)
    const { record } = hostStart(t, directory, path)
    assert.equal(record.hostFailure, undefined, record.reason)
    assert.deepEqual(record.scopeGuard, { version: 3, advisory: true, verified: true, paths: [] })
    assert.equal(run(directory, 'close', '--run', record.id).data.data.isolation.verified, true)
  })
}

for (const mode of ['scope-range-measure', 'scope-range-log', 'scope-range-diff', 'scope-tool-sibling']) {
  test(`evaluation ignores revision syntax and nonexistent read targets: ${mode}`, async t => {
    const directory = await temporary(t)
    const { path } = await adapterFile(directory, mode)
    const { record } = hostStart(t, directory, path)
    assert.equal(record.hostFailure, undefined, record.reason)
    assert.equal(record.scopeGuard.verified, true)
    assert.equal(run(directory, 'close', '--run', record.id).data.data.isolation.verified, true)
  })
}

test('evaluation accepts in-scope reports, runtime executables and non-filesystem URLs and routes', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'scope-valid')
  const { record } = hostStart(t, directory, path)
  assert.equal(record.hostFailure, undefined)
  assert.deepEqual(record.scopeGuard, { version: 3, advisory: true, verified: true, paths: [] })
  const resumed = run(directory, 'turn', '--run', record.id, '--answer', '1').data.data
  const observed = JSON.parse(resumed.turns[1].result.stdout.trim().split('\n').at(-2)).item.observed
  assert.ok(observed.message.includes(`work only inside ${record.fixture.path} and ${record.isolation.home}`))
  assert.ok(observed.message.endsWith('\n\n' + record.scenario.answers[0]))
  assert.equal(resumed.scopeGuard.verified, true)
})

test('evaluation scope accepts a maintained repository whose root contains spaces', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'scope-valid')
  const first = hostStart(t, directory, path, 'without', 'clear-goals').record
  const repo = join(directory, 'maintained repo')
  await rename(first.fixture.path, repo)
  const result = run(directory, '--scenario', 'clear-goals', '--mode', 'without', '--stage', 'final', '--adapter', path, '--repo', repo)
  const record = result.data.data
  t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  assert.equal(record.hostFailure, undefined, result.stdout)
  assert.equal(record.scopeGuard.verified, true)
  assert.equal(run(directory, 'close', '--run', record.id).data.data.isolation.verified, true)
})

test('closing retains advisory worker observations arriving after the parent turn', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record } = hostStart(t, directory, path)
  const sessions = join(record.isolation.state, 'sessions')
  await mkdir(sessions)
  const outside = join(directory, 'late-private.txt')
  await writeFile(outside, 'Outside project guidance\n')
  await writeFile(join(sessions, 'late-worker.jsonl'), JSON.stringify({ type: 'response_item',
    payload: { type: 'custom_tool_call', name: 'exec', input: `cat '${outside}'` } }) + '\n')
  const closed = run(directory, 'close', '--run', record.id).data.data
  assert.equal(closed.scopeGuard.verified, false)
  assert.equal(closed.isolation.verified, true)
  assert.ok(closed.isolation.cleanedAt)
  const files = await inputs(directory, record)
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath,
    '--transcript', join(directory, record.id, record.conversation)).status, 0)
})

for (const separator of ['\n', '\r', '\t']) {
  test(`evidence redacts names after ${JSON.stringify(separator)} across nested JSON strings`, () => {
    const username = userInfo().username
    const output = `header${separator}${username}${separator}prefix-${username}-suffix`
    const expected = `header${separator}[redacted: user name]${separator}prefix-${username}-suffix`
    assert.equal(redactEvidence(output), expected)
    assert.equal(JSON.parse(redactEvidence(JSON.stringify({ output }))).output, expected)
    const record = JSON.stringify({ stdout: JSON.stringify({ output }) + '\n' })
    assert.equal(JSON.parse(JSON.parse(redactEvidence(record)).stdout).output, expected)
  })
}

test('evidence redacts JSONL surrounded by plain text with unmatched quotes', () => {
  const username = userInfo().username
  const event = JSON.stringify({ output: `header\n${username}\n` })
  const transcript = `User: "unfinished\nHost JSONL:\n${event}\nHost stderr:\n"unfinished\n`
  const redacted = redactEvidence(transcript)
  assert.equal(JSON.parse(redacted.split('\n')[2]).output, 'header\n[redacted: user name]\n')
  assert.equal(redacted.split('\n').length, transcript.split('\n').length)
})

test('captured listings and closed evidence redact host identities while retaining scoring and resume', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'listing')
  const { record } = hostStart(t, directory, path)
  assert.equal(run(directory, 'turn', '--run', record.id, '--answer', '1').data.data.turns[1].sessionId, record.sessionId)
  const transcriptPath = join(directory, record.id, record.conversation)
  const transcript = await readFile(transcriptPath, 'utf8')
  const listing = transcript.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line))
    .find(event => event.item?.command === 'ls -la').item.aggregated_output
  assert.equal(listing, 'total 8\ndrwx------ 2 [redacted: user name] [redacted: user name] 4096 Oct 8 12:00 .\n' +
    '-rw-r--r-- 1 [redacted: user name] [redacted: user name] 123 Oct 8 12:00 brief.md\n' +
    'Owner: [redacted: user name]; group: [redacted: user name]\n[redacted: user name]\n[redacted: user name]\n')
  assert.ok(!transcript.includes(record.sessionId))
  assert.ok(!transcript.includes(record.fixture.path))
  assert.ok(!transcript.includes(record.isolation.home))
  run(directory, 'close', '--run', record.id)
  const saved = await readFile(join(directory, record.id, 'run.json'), 'utf8')
  assert.ok(!saved.includes(record.sessionId))
  assert.ok(!saved.includes(record.fixture.path))
  assert.ok(!saved.includes(record.isolation.home))
  const closed = JSON.parse(saved)
  const closedListing = closed.turns[0].result.stdout.trim().split('\n').map(line => JSON.parse(line))
    .find(event => event.item?.command === 'ls -la').item.aggregated_output
  assert.equal(closedListing, listing)
  const files = await inputs(directory, record)
  files.answers.reviewer = userInfo().username
  await writeFile(files.answersPath, JSON.stringify(files.answers))
  assert.equal(run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', transcriptPath).status, 0)
  const scored = JSON.parse(await readFile(join(directory, record.id, 'run.json'), 'utf8'))
  assert.equal(await readFile(join(directory, record.id, scored.transcript), 'utf8'), transcript)
  assert.equal(scored.caseResults[0].reviewer, '[redacted: user name]')
  assert.deepEqual(JSON.parse(await readFile(join(directory, record.id, scored.answers), 'utf8')),
    { ...files.answers, reviewer: '[redacted: user name]' })
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

test('foundation execution delivers the active checkpoint to the host', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { data } = run(directory, '--scenario', 'ambiguous-idea', '--mode', 'with', '--stage', 'foundation', '--adapter', path)
  const record = data.data
  t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
  t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  const observed = JSON.parse(record.turns[0].result.stdout.split('\n')[1]).item.observed
  assert.ok(observed.message.endsWith('$repo-audit\nActive checkpoint: foundation.\n' + record.scenario.request))
})

test('final with-skill execution installs the complete package in the isolated home before the host turn', async t => {
  const directory = await temporary(t)
  const { path, adapter } = await adapterFile(directory)
  adapter.timeoutMs = 1800000
  await writeFile(path, JSON.stringify(adapter))
  const result = run(directory, '--scenario', 'ambiguous-idea', '--mode', 'with', '--stage', 'final', '--adapter', path)
  const record = result.data.data
  assert.ok(record, result.stdout)
  t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
  t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  assert.equal(record.hostFailure, undefined, result.stdout)
  assert.equal(record.installer.status, 'passed')
  const installed = JSON.parse(record.installer.stdout)
  assert.equal(installed.status, 'passed')
  assert.equal(installed.data.mode, 'copy')
  assert.equal(installed.data.installations[0].destination, record.isolation.stagedPath)
  assert.equal(installed.data.installations[0].runtime.verified, true)
  assert.ok(Object.keys(installed.data.installations[0].files).includes('scripts/bstack-check.mjs'))
  const runtime = JSON.parse(await readFile(join(record.isolation.stagedPath, 'node_modules/lavish-axi/package.json'), 'utf8'))
  assert.equal(runtime.version, installed.data.installations[0].runtime.version)
  assert.equal(record.isolation.verified, true)
  assert.equal(record.turns[0].message, '$repo-audit\nActive checkpoint: final.\n' + record.scenario.request)
  const artifact = JSON.parse(await readFile(join(directory, record.id, 'installer.json'), 'utf8'))
  assert.equal(artifact.status, 'passed')
  assert.ok(!JSON.stringify(artifact).includes(record.isolation.home))
  const closed = run(directory, 'close', '--run', record.id)
  assert.equal(closed.data.data.isolation.verified, true)
  await assert.rejects(readFile(join(record.isolation.stagedPath, 'SKILL.md')), { code: 'ENOENT' })
})

test('final follow-up uses the explicit maintained repository in a fresh skill-free conversation', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const first = hostStart(t, directory, path, 'without', 'clear-goals').record
  const result = run(directory, '--scenario', 'clear-goals', '--mode', 'without', '--stage', 'final', '--adapter', path, '--repo', first.fixture.path)
  const record = result.data.data
  assert.equal(record.hostFailure, undefined, result.stdout)
  t.after(() => rm(record.isolation.home, { recursive: true, force: true }))
  assert.equal(record.fixture.path, first.fixture.path)
  assert.equal(record.fixture.reused, true)
  assert.notEqual(record.isolation.home, first.isolation.home)
  assert.notEqual(record.sessionId, first.sessionId)
  assert.deepEqual(record.isolation.discovered, [])
  assert.equal(record.installer, undefined)
  const observed = JSON.parse(record.turns[0].result.stdout.trim().split('\n')[1]).item.observed
  assert.equal(observed.cwd, first.fixture.path)
  assert.equal(run(directory, '--scenario', 'clear-goals', '--mode', 'without', '--stage', 'baseline', '--adapter', path, '--repo', first.fixture.path).status, 3)
  assert.equal(run(directory, 'close', '--run', record.id).data.data.isolation.verified, true)
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

test('resumed Codex turns retain the opening sandbox policy', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const { record } = hostStart(t, directory, path)
  const reply = run(directory, 'turn', '--run', record.id, '--answer', '1').data.data
  const opening = JSON.parse(record.turns[0].result.stdout.trim().split('\n')[1]).item.observed
  const resumed = JSON.parse(reply.turns[1].result.stdout.trim().split('\n')[1]).item.observed
  assert.deepEqual([opening.sandboxPolicy, resumed.sandboxPolicy], ['danger-full-access', 'danger-full-access'])
})

test('manual adapter preparation is rejected before creating a run', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory)
  const rejected = run(directory, '--scenario', 'ambiguous-idea', '--mode', 'without', '--stage', 'baseline', '--adapter', path, '--manual')
  assert.equal(rejected.status, 3)
  assert.match(rejected.stdout, /Omit --manual/)
  assert.deepEqual(await readdir(directory), ['adapter.json', 'bin', 'outside-project'])
})

for (const mode of ['fail', 'malformed', 'incomplete', 'contaminate', 'truncate', 'hang']) {
  test(`host ${mode} remains blocked and retains available execution evidence`, async t => {
    const directory = await temporary(t)
    const { path, adapter } = await adapterFile(directory, mode)
    if (mode === 'hang') adapter.timeoutMs = 1000
    if (mode === 'truncate') adapter.outputLimitBytes = 65536
    await writeFile(path, JSON.stringify(adapter))
    const { record, result } = hostStart(t, directory, path)
    assert.equal(result.status, 2, result.stdout)
    assert.equal(record.status, 'blocked')
    assert.equal(record.turns.length, 1)
    assert.equal(record.turns[0].sessionId, null)
    assert.ok(record.reason)
    assert.equal(record.turns[0].result.timedOut, mode === 'hang')
    assert.equal(record.turns[0].result.outputTruncated, mode === 'truncate')
    await assert.rejects(readFile(join(record.isolation.home, '.codex', 'fake-session.json')), { code: 'ENOENT' })
  })
}

test('evaluation capture retains a complete valid host transcript larger than the product limit', async t => {
  const directory = await temporary(t)
  const { path } = await adapterFile(directory, 'large')
  const { record } = hostStart(t, directory, path)
  assert.ok(record.turns[0].result.stdout.length > 65536)
  assert.equal(record.turns[0].result.outputTruncated, false)
  assert.equal(record.turns[0].sessionId, record.sessionId)
  const files = await inputs(directory, record)
  const scored = run(directory, 'score', '--run', record.id, '--answers', files.answersPath, '--transcript', join(directory, record.id, record.conversation))
  assert.equal(scored.status, 0, scored.stdout)
})

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
    assert.deepEqual(scored.data.data.turns, JSON.parse(redactEvidence(JSON.stringify(record.turns), record)))
    assert.equal(scored.data.data.sessionId, '[identifier]')
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
    assert.deepEqual(scored.data.data.turns, JSON.parse(redactEvidence(JSON.stringify(record.turns), record)))
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
  ['unbounded timeout', adapter => { adapter.timeoutMs = 1800001 }],
  ['unbounded capture', adapter => { adapter.outputLimitBytes = 16777217 }],
  ['empty capture', adapter => { adapter.outputLimitBytes = 0 }],
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
    '--stage', 'baseline', '--adapter', path, '--results', directory, '--json'], { encoding: 'utf8', env: { ...testEnvironment(directory), CODEX_HOME: source } })
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
