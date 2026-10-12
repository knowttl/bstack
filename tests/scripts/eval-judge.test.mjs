import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir, symlink, copyFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { hashBytes, canonicalJSON } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

// Test the grading commands as child processes; no test starts a real provider.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack judge ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

function command(script, args, env = process.env) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', script), ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { ...result, body: JSON.parse(result.stdout) }
}

async function judgeConfig(directory, mode = 'pass', capture) {
  const path = join(directory, 'judge.json')
  await writeFile(path, JSON.stringify({ schemaVersion: 1, model: 'fixture-judge', host: 'process', executable: process.execPath,
    args: [join(root, 'tests/inputs/fake-judge.mjs'), '{model}', mode, ...(capture ? [capture] : [])], versionArgs: ['--version'],
    timeoutMs: 5000, outputLimitBytes: 65536 }))
  return path
}

async function comparisonRun(runs, index, fields = {}) {
  const id = `2026-10-12T00-00-00.000Z-00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const folder = join(runs, id)
  await mkdir(folder, { recursive: true })
  const check = { id: 'project-fit', caseId: 'AC-62', question: 'Are the findings project-specific? Compare with the existing-repo transcript.' }
  const record = { id, sourceRevision: 'fixture-source', mode: 'with', batchId: 'fixture-batch', repeatIndex: 1,
    scenario: { id: 'existing-repo-python', checks: [check] }, transcript: null, answers: null, caseResults: [],
    isolation: { verified: false }, conversation: 'conversation.txt', status: 'blocked', ...fields }
  await writeFile(join(folder, 'conversation.txt'), `User: Run ${index}.\nAgent: Recommendations for run ${index}.\n`)
  await writeFile(join(folder, 'run.json'), JSON.stringify(record))
  return record
}

for (const [name, first, second, selected] of [
  ['same repeat before passing fallback', { repeatIndex: 0, status: 'passed' }, { repeatIndex: 1, status: 'failed' }, 3],
  ['first passing when repeats differ', { repeatIndex: 0, status: 'failed' }, { repeatIndex: 2, status: 'passed' }, 3],
  ['first passing in run order', { repeatIndex: 0, status: 'passed' }, { repeatIndex: 2, status: 'passed' }, 2],
  ['different source stays pending', { sourceRevision: 'other-source' }, { sourceRevision: 'other-source' }, null],
  ['different mode stays pending', { mode: 'without' }, { mode: 'without' }, null],
  ['different batch stays pending', { batchId: 'other-batch' }, { batchId: 'other-batch' }, null],
  ['different repeat without passing stays pending', { repeatIndex: 0, status: 'failed' }, { repeatIndex: 2, status: 'blocked' }, null]
]) {
  test(`judge comparison selection: ${name}`, async t => {
    const directory = await temporary(t)
    const capture = join(directory, 'capture')
    await mkdir(capture)
    const config = await judgeConfig(directory, 'capture', capture)
    const record = await comparisonRun(directory, 1)
    await comparisonRun(directory, 2, { scenario: { id: 'existing-repo', checks: [] }, status: 'passed', ...first })
    await comparisonRun(directory, 3, { scenario: { id: 'existing-repo', checks: [] }, status: 'passed', ...second })
    const transcript = join(directory, record.id, record.conversation)
    const result = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', transcript, '--results', directory])
    assert.equal(result.status, selected ? 0 : 2, result.stdout)
    if (selected) {
      const answers = JSON.parse(await readFile(result.body.data.answers))
      const evidence = JSON.parse(await readFile(join(directory, record.id, 'judge/evidence.json')))
      const input = JSON.parse(await readFile(join(capture, `${record.id}.json`)))
      const { reviewer, ...bound } = input
      assert.equal(evidence.inputHash, hashBytes(canonicalJSON(bound)))
      assert.equal(evidence.companionsHash, hashBytes(canonicalJSON(input.companions)))
      assert.ok(input.companions[0].runId.endsWith(String(selected).padStart(12, '0')))
      assert.equal(input.companions[0].transcript[1].text, `Agent: Recommendations for run ${selected}.`)
      assert.equal(input.companions[0].transcriptHash, hashBytes(`User: Run ${selected}.\nAgent: Recommendations for run ${selected}.\n`))
      assert.equal(answers.checks.length, 1)
      const scored = command('eval.mjs', ['score', '--run', record.id, '--answers', result.body.data.answers, '--transcript', transcript, '--results', directory])
      assert.equal(scored.status, 0, scored.stdout)
    } else {
      assert.deepEqual(result.body.data.pending, [{ checkId: 'project-fit', scenario: 'existing-repo' }])
      assert.deepEqual(await readdir(capture), [])
      await assert.rejects(readFile(join(directory, record.id, 'judge/answers.json')), { code: 'ENOENT' })
      assert.equal(JSON.parse(await readFile(join(directory, record.id, 'run.json'))).transcript, null)
    }
  })
}

test('judge comparison uses repeat positions from an existing batch inventory', async t => {
  const directory = await temporary(t)
  const capture = join(directory, 'capture')
  await mkdir(capture)
  const config = await judgeConfig(directory, 'capture', capture)
  const first = await comparisonRun(directory, 1, { batchId: undefined, repeatIndex: undefined })
  const record = await comparisonRun(directory, 2, { batchId: undefined, repeatIndex: undefined })
  const companion = await comparisonRun(directory, 3, { scenario: { id: 'existing-repo', checks: [] }, batchId: undefined, repeatIndex: undefined })
  const second = await comparisonRun(directory, 4, { scenario: { id: 'existing-repo', checks: [] }, batchId: undefined, repeatIndex: undefined })
  await mkdir(join(directory, 'batches'))
  await writeFile(join(directory, 'batches/fixture.json'), JSON.stringify({ id: 'fixture', runIds: [first.id, companion.id, record.id, second.id] }))
  const result = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', join(directory, record.id, record.conversation), '--results', directory])
  assert.equal(result.status, 0, result.stdout)
  const input = JSON.parse(await readFile(join(capture, `${record.id}.json`)))
  assert.equal(input.companions[0].runId, second.id)
})

test('judge leaves a missing comparison pending and can grade after evidence arrives', async t => {
  const directory = await temporary(t)
  const config = await judgeConfig(directory)
  const record = await comparisonRun(directory, 1)
  record.scenario.checks.push({ id: 'native', caseId: 'AC-60', question: 'Are native checks used?' })
  await writeFile(join(directory, record.id, 'run.json'), JSON.stringify(record))
  const result = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', join(directory, record.id, record.conversation), '--results', directory])
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.body.data.pending[0].checkId, 'project-fit')
  await assert.rejects(readFile(join(directory, record.id, 'judge/answers.json')), { code: 'ENOENT' })
  await comparisonRun(directory, 2, { scenario: { id: 'existing-repo', checks: [] } })
  const completed = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', join(directory, record.id, record.conversation), '--results', directory])
  assert.equal(completed.status, 0, completed.stdout)
  const answers = JSON.parse(await readFile(completed.body.data.answers))
  assert.deepEqual(answers.checks.map(check => check.id), ['project-fit', 'native'])
})

test('human scoring preserves the cited companion run for calibration', async t => {
  const directory = await temporary(t)
  const record = await comparisonRun(directory, 1)
  const companion = await comparisonRun(directory, 2, { scenario: { id: 'existing-repo', checks: [] } })
  const answers = join(directory, 'human.json')
  await writeFile(answers, JSON.stringify({ schemaVersion: 1, runId: record.id, reviewer: 'Fixture reviewer',
    checks: [{ id: 'project-fit', passed: true, startLine: 1, endLine: 2, companionRunId: companion.id }] }))
  const result = command('eval.mjs', ['score', '--run', record.id, '--answers', answers,
    '--transcript', join(directory, record.id, record.conversation), '--results', directory])
  assert.equal(result.status, 0, result.stdout)
  assert.equal(result.body.data.caseResults[0].companionRunId, companion.id)
  const saved = JSON.parse(await readFile(join(directory, record.id, result.body.data.answers)))
  assert.equal(saved.checks[0].companionRunId, companion.id)
})

async function manual(t, directory) {
  const result = command('eval.mjs', ['--manual', '--scenario', 'ambiguous-idea', '--mode', 'without',
    '--stage', 'baseline', '--agent', 'fixture-host', '--model', 'fixture-subject', '--results', directory])
  assert.equal(result.status, 2, result.stdout)
  const record = result.body.data
  t.after(() => rm(record.fixture.path, { recursive: true, force: true }))
  const transcript = join(directory, 'transcript.txt')
  await writeFile(transcript, 'User: Offline access is unresolved.\nAgent: Which option do you want? I will wait for your decision.\n')
  return { record, transcript }
}

test('judge answers pass through eval score and retain the judge model and citations', async t => {
  const directory = await temporary(t)
  const config = await judgeConfig(directory)
  const { record, transcript } = await manual(t, directory)
  const result = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', transcript, '--results', directory])
  assert.equal(result.status, 0, result.stdout)
  const answers = result.body.data.answers
  const score = command('eval.mjs', ['score', '--run', record.id, '--answers', answers, '--transcript', transcript, '--results', directory])
  assert.equal(score.status, 0, score.stdout)
  assert.equal(score.body.data.caseResults[0].scoring, 'judge')
  assert.equal(score.body.data.caseResults[0].reviewer, 'judge:fixture-judge')
  assert.equal(score.body.data.caseResults[0].endLine, 2)
  assert.equal(JSON.parse(await readFile(join(directory, record.id, score.body.data.answers))).reviewer, 'judge:fixture-judge')
  assert.equal(score.body.data.isolation.verified, false)
  const repeated = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', transcript, '--results', directory])
  assert.equal(repeated.status, 2)
})

for (const mode of ['success', 'container-extra-mount']) {
  test(`default Sonnet judge verifies its container and removes the throwaway login: ${mode}`, async t => {
    const directory = await temporary(t)
    const bin = join(directory, 'bin')
    const loginSource = join(directory, 'login')
    await mkdir(bin)
    await mkdir(loginSource)
    await writeFile(join(loginSource, '.credentials.json'), 'fixture-login-only')
    await symlink(join(root, 'tests/inputs/docker.mjs'), join(bin, 'docker'))
    await copyFile(join(root, 'tests/inputs/fake-judge.mjs'), join(bin, 'claude'))
    await chmod(join(bin, 'claude'), 0o755)
    await writeFile(join(directory, 'adapter.json'), JSON.stringify({ args: [mode] }))
    const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`,
      CLAUDE_CONFIG_DIR: loginSource, TEST_DOCKER_STATE: directory }
    const { record, transcript } = await manual(t, directory)
    const result = command('eval.mjs', ['judge', '--run', record.id, '--transcript', transcript, '--results', directory], env)
    assert.equal(result.status, mode === 'success' ? 0 : 2, result.stdout)
    assert.ok(!result.stdout.includes('fixture-login-only'))
    const events = (await readFile(join(directory, 'docker-events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    assert.equal(events[0].operation, 'create')
    assert.equal(events.at(-1).operation, 'remove')
    const home = resolve(events[0].fixture, '../home')
    await assert.rejects(readFile(join(home, '.claude/.credentials.json')), { code: 'ENOENT' })
    assert.equal(await readFile(join(loginSource, '.credentials.json'), 'utf8'), 'fixture-login-only')
    assert.ok(!(await readdir(directory)).some(file => file.endsWith('.docker.json')))
    if (mode === 'success') {
      const answers = JSON.parse(await readFile(result.body.data.answers))
      assert.equal(answers.reviewer, 'judge:claude-sonnet-5-5')
      const evidence = JSON.parse(await readFile(join(directory, record.id, 'judge/evidence.json')))
      assert.equal(evidence.imageId, `sha256:${'a'.repeat(64)}`)
      assert.equal(evidence.recipeHash.length, 64)
    }
  })
}

for (const mode of ['wrong-run', 'missing-check', 'duplicate-check', 'bad-lines', 'wrong-model', 'string-verdict', 'failure']) {
  test(`judge rejects ${mode} without publishing answers or changing the run`, async t => {
    const directory = await temporary(t)
    const config = await judgeConfig(directory, mode)
    const { record, transcript } = await manual(t, directory)
    const before = await readFile(join(directory, record.id, 'run.json'), 'utf8')
    const result = command('eval.mjs', ['judge', '--run', record.id, '--judge', config, '--transcript', transcript, '--results', directory])
    assert.equal(result.status, 2, result.stdout)
    assert.equal(await readFile(join(directory, record.id, 'run.json'), 'utf8'), before)
    await assert.rejects(readFile(join(directory, record.id, 'judge/answers.json')), { code: 'ENOENT' })
    assert.ok(!result.stdout.includes('private-provider-credential'))
  })
}

async function corpus(directory, count = 124) {
  const runs = join(directory, 'runs')
  await mkdir(runs)
  for (let index = 1; index <= count; index++) {
    const id = `2026-10-12T00-00-00.000Z-00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    const folder = join(runs, id)
    await mkdir(folder)
    const check = { id: 'decision', caseId: 'AC-2', question: 'Does the agent ask about the unresolved decision?' }
    const answers = { schemaVersion: 1, runId: id, reviewer: 'Fixture reviewer',
      checks: [{ id: check.id, passed: index !== 1, startLine: 1, endLine: 2 }] }
    await writeFile(join(folder, 'transcript.txt'), 'User: This is unresolved.\nAgent: Which do you want?\n')
    await writeFile(join(folder, 'answers.json'), JSON.stringify(answers))
    await writeFile(join(folder, 'run.json'), JSON.stringify({ id, scenario: { id: 'fixture-scenario', checks: [check] },
      transcript: 'transcript.txt', answers: 'answers.json', caseResults: [{ ...check, ...answers.checks[0], scoring: 'human' }] }))
    if (index === 1) await writeFile(join(folder, 'score-correction.json'), JSON.stringify({ schemaVersion: 1,
      runId: id, correctedAt: '2026-10-12T00:00:00.000Z', corrector: 'Fixture corrector', reason: 'The agent asked the required question.',
      originalAnswers: 'answers.json', originalAnswersSha256: hashBytes(JSON.stringify(answers)),
      conversationSha256: hashBytes('User: This is unresolved.\nAgent: Which do you want?\n'),
      evidence: { startLine: 1, endLine: 2 }, checks: [{ ...answers.checks[0], passed: true }] }))
  }
  return runs
}

test('calibration planning validates all 124 retained runs without invoking the judge', async t => {
  const directory = await temporary(t)
  const config = await judgeConfig(directory, 'failure')
  const runs = await corpus(directory)
  const result = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--plan'])
  assert.equal(result.status, 0, result.stdout)
  assert.equal(result.body.data.expectedCalls, 124)
  assert.equal(result.body.data.checks, 124)
  assert.equal(result.body.data.corpus.length, 124)
})

for (const [name, citation, source, mode, selected, corrected] of [
  ['retained human citation takes priority', 123, 'other-source', 'without', 123],
  ['uncited comparison uses matching source and mode', null, 'fixture-source', 'with', 122],
  ['missing cited companion stays pending', 125, 'fixture-source', 'with', null],
  ['cited wrong scenario stays pending', 121, 'fixture-source', 'with', null],
  ['uncited different source stays pending', null, 'other-source', 'with', null],
  ['uncited different mode stays pending', null, 'fixture-source', 'without', null],
  ['append-only corrected citation takes priority', null, 'fixture-source', 'with', 123, true]
]) {
  test(`calibration comparison planning: ${name}`, async t => {
    const directory = await temporary(t)
    const config = await judgeConfig(directory, 'failure')
    const runs = await corpus(directory)
    const ids = (await readdir(runs)).sort()
    const target = JSON.parse(await readFile(join(runs, ids[123], 'run.json')))
    target.sourceRevision = 'fixture-source'
    target.mode = 'with'
    target.scenario.checks[0].question = 'Are recommendations project-specific? Compare with the existing-repo transcript.'
    await writeFile(join(runs, target.id, 'run.json'), JSON.stringify(target))
    const human = JSON.parse(await readFile(join(runs, target.id, 'answers.json')))
    if (citation) human.checks[0].companionRunId = `2026-10-12T00-00-00.000Z-00000000-0000-4000-8000-${String(citation).padStart(12, '0')}`
    await writeFile(join(runs, target.id, 'answers.json'), JSON.stringify(human))
    let expectedHuman = human
    if (corrected) {
      expectedHuman = { schemaVersion: 1, runId: target.id, correctedAt: '2026-10-12T00:00:00.000Z',
        corrector: 'Fixture corrector', reason: 'The comparison used a different companion and failed.',
        originalAnswers: 'answers.json', originalAnswersSha256: hashBytes(JSON.stringify(human)),
        conversationSha256: hashBytes('User: This is unresolved.\nAgent: Which do you want?\n'),
        evidence: { startLine: 1, endLine: 2 }, checks: [{ ...human.checks[0], passed: false, companionRunId: ids[122] }] }
      await writeFile(join(runs, target.id, 'score-correction.json'), JSON.stringify(expectedHuman))
    }
    for (const id of [ids[121], ids[122]]) {
      const companion = JSON.parse(await readFile(join(runs, id, 'run.json')))
      companion.sourceRevision = source
      companion.mode = mode
      companion.scenario.id = 'existing-repo'
      await writeFile(join(runs, id, 'run.json'), JSON.stringify(companion))
    }
    const before = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--plan'])
    assert.equal(before.status, selected ? 0 : 2, before.stdout)
    assert.equal(before.body.data.pending.length, selected ? 0 : 1)
    assert.equal(before.body.data.checks, selected ? 124 : 123)
    assert.equal(before.body.data.expectedCalls, selected ? 124 : 123)
    await writeFile(join(runs, ids[(selected ?? 122) - 1], 'transcript.txt'), 'User: Different request.\nAgent: Changed companion evidence.\n')
    const after = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--plan'])
    const binding = result => result.body.data.corpus.find(run => run.runId === target.id)
    assert.equal(binding(before).humanHash, hashBytes(canonicalJSON(expectedHuman)))
    assert.deepEqual(binding(before).companions.map(companion => companion.runId), selected ? [ids[selected - 1]] : [])
    if (selected) {
      assert.notEqual(binding(before).inputHash, binding(after).inputHash)
      assert.notEqual(binding(before).companionsHash, binding(after).companionsHash)
    } else {
      assert.equal(binding(before).inputHash, binding(after).inputHash)
      assert.equal(binding(before).companionsHash, binding(after).companionsHash)
    }
  })
}

test('calibration delivers the cited companion and blocks adoption for a missing comparison', async t => {
  const directory = await temporary(t)
  const capture = join(directory, 'capture')
  await mkdir(capture)
  const config = await judgeConfig(directory, 'capture', capture)
  const runs = await corpus(directory)
  const ids = (await readdir(runs)).sort()
  const companion = JSON.parse(await readFile(join(runs, ids[121], 'run.json')))
  companion.scenario.id = 'existing-repo'
  await writeFile(join(runs, companion.id, 'run.json'), JSON.stringify(companion))
  for (const [id, citation] of [[ids[122], companion.id], [ids[123], 'missing-run']]) {
    const record = JSON.parse(await readFile(join(runs, id, 'run.json')))
    record.scenario.checks[0].question = 'Are recommendations project-specific? Compare with the existing-repo transcript.'
    await writeFile(join(runs, id, 'run.json'), JSON.stringify(record))
    const human = JSON.parse(await readFile(join(runs, id, 'answers.json')))
    human.checks[0].companionRunId = citation
    await writeFile(join(runs, id, 'answers.json'), JSON.stringify(human))
  }
  const output = join(directory, 'calibration')
  const result = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--output', output])
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.body.data.status, 'blocked')
  assert.equal(result.body.data.completedRuns, 124)
  assert.equal(result.body.data.total, 123)
  assert.equal(result.body.data.agreement, 1)
  assert.deepEqual(result.body.data.pending, [{ runId: ids[123], checkId: 'decision', scenario: 'existing-repo' }])
  const input = JSON.parse(await readFile(join(capture, `${ids[122]}.json`)))
  assert.equal(input.companions[0].runId, companion.id)
  assert.equal(input.companions[0].transcript[1].text, 'Agent: Which do you want?')
  assert.equal(input.companions[0].status, undefined)
  assert.equal(input.companions[0].checks, undefined)
  const { reviewer, ...bound } = input
  assert.equal(result.body.data.runs.find(run => run.runId === ids[122]).inputHash, hashBytes(canonicalJSON(bound)))
  await assert.rejects(readFile(join(capture, `${ids[123]}.json`)), { code: 'ENOENT' })
  const pendingAnswers = JSON.parse(await readFile(join(output, `${ids[123]}.answers.json`)))
  assert.deepEqual(pendingAnswers.checks, [])
})

for (const [disagreements, status] of [[6, 0], [7, 1]]) {
  test(`calibration ${status ? 'fails' : 'passes'} at ${124 - disagreements}/124 verdict agreement and retains disagreements`, async t => {
    const directory = await temporary(t)
    const config = await judgeConfig(directory, `disagree-${disagreements}`)
    const runs = await corpus(directory)
    const output = join(directory, 'calibration')
    const originals = await Promise.all((await readdir(runs)).map(async id => hashBytes(await readFile(join(runs, id, 'run.json')))))
    const result = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--output', output])
    assert.equal(result.status, status, result.stdout)
    const report = JSON.parse(await readFile(join(output, 'report.json')))
    assert.equal(report.completedRuns, 124)
    assert.equal(report.total, 124)
    assert.equal(report.agreed, 124 - disagreements)
    assert.equal(report.agreement, (124 - disagreements) / 124)
    assert.equal(report.disagreements.length, disagreements)
    assert.deepEqual(report.disagreements[0].human, { passed: true, startLine: 1, endLine: 2 })
    assert.equal(report.disagreements[0].judge.passed, false)
    assert.deepEqual(await Promise.all((await readdir(runs)).map(async id => hashBytes(await readFile(join(runs, id, 'run.json'))))), originals)
    const repeated = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--output', output])
    assert.equal(repeated.status, 2)
  })
}

test('calibration refuses an incomplete corpus before making any calls', async t => {
  const directory = await temporary(t)
  const config = await judgeConfig(directory)
  const runs = await corpus(directory, 123)
  const result = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--output', join(directory, 'output')])
  assert.equal(result.status, 2)
  assert.match(result.stdout, /found 123/)
})

for (const [mode, completedRuns, agreed, agreement] of [
  ['failure', 0, 0, 0],
  ['fail-after-10', 10, 10, 1],
  ['disagree-2-fail-after-10', 10, 8, 0.8]
]) {
  test(`calibration preserves agreement and a blocked report after provider failure: ${mode}`, async t => {
    const directory = await temporary(t)
    const config = await judgeConfig(directory, mode)
    const runs = await corpus(directory)
    const output = join(directory, 'calibration')
    const result = command('eval-calibrate.mjs', ['--judge', config, '--runs', runs, '--output', output])
    assert.equal(result.status, 2, result.stdout)
    const bytes = await readFile(join(output, 'report.json'), 'utf8')
    const report = JSON.parse(bytes)
    assert.equal(report.completedRuns, completedRuns)
    assert.equal(report.total, completedRuns)
    assert.equal(report.agreed, agreed)
    assert.equal(report.agreement, agreement)
    assert.equal(report.status, 'blocked')
    assert.equal(report.disagreements.length, completedRuns - agreed)
    assert.deepEqual(result.body.data, report)
    assert.ok(!bytes.includes('private-provider-credential'))
  })
}
