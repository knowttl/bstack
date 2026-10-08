import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
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

test('automatic host execution remains blocked pending C7b', async t => {
  const directory = await temporary(t)
  assert.equal(run(directory, '--scenario', 'new-idea', '--mode', 'without', '--stage', 'baseline', '--agent', 'test', '--model', 'test').status, 2)
})
