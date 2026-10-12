import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir, symlink, copyFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { hashBytes } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

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

async function judgeConfig(directory, mode = 'pass') {
  const path = join(directory, 'judge.json')
  await writeFile(path, JSON.stringify({ schemaVersion: 1, model: 'fixture-judge', host: 'process', executable: process.execPath,
    args: [join(root, 'tests/inputs/fake-judge.mjs'), '{model}', mode], versionArgs: ['--version'],
    timeoutMs: 5000, outputLimitBytes: 65536 }))
  return path
}

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
