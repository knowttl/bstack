import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { emptyRepo, git } from './discovery-fixture.mjs'

// Exercise the public release command against disposable synthetic evidence.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// The synthetic ledgers bind to the actual candidate without running any evaluation hosts.
const candidate = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
// Candidate-bound hard-break results are an explicit input to the gate.
const hardChecks = ['deterministic-suite', 'package-check', 'registry', 'installer', 'fixture-unchanged',
  'approval-before-write', 'isolation', 'explicit-invocation', 'implicit-invocation']

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function fixture(t, repository = root) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack release '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const definitions = JSON.parse(await readFile(join(root, 'tests/eval/scenarios/scenarios.json'), 'utf8')).scenarios
  const smoke = definitions.filter(item => item.tier === 'smoke')
  const report = { schemaVersion: 1, candidate, model: 'synthetic-model',
    checks: hardChecks.map(id => ({ id, passed: true })),
    agentProcesses: smoke.map(item => ({ scenario: item.id, runs: 5, failures: 0, infrastructureFailures: 0 })) }
  const rows = smoke.flatMap(item => item.checks.flatMap(check => ['without', 'with'].map(mode => ({
    date: '2026-10-12T00:00:00Z', candidate, tier: 'smoke', model: report.model,
    adapterHash: 'a'.repeat(64), fixtureHash: 'f'.repeat(64),
    criteriaHash: createHash('sha256').update(canonical(item.checks)).digest('hex'),
    scenario: item.id, mode, check: check.id, caseId: check.caseId, passes: mode === 'with' ? 5 : 0, runs: 5,
    runIds: Array.from({ length: 5 }, (_, index) => `${item.id}-${mode}-${index}`)
  }))))
  async function run(version = '0.1.1') {
    await writeFile(join(directory, 'ledger.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n')
    await writeFile(join(directory, 'checks.json'), JSON.stringify(report))
    const result = spawnSync(process.execPath, [join(repository, 'scripts/acceptance.mjs'), '--release', version,
      '--candidate', report.candidate, '--checks', join(directory, 'checks.json'), '--results', directory], { cwd: repository, encoding: 'utf8' })
    return { ...result, data: JSON.parse(result.stdout) }
  }
  function measure(passes, baseline, extra) {
    rows.find(row => row.scenario === 'ambiguous-idea' && row.mode === 'without').passes = baseline
    const row = rows.find(row => row.scenario === 'ambiguous-idea' && row.mode === 'with')
    row.passes = passes
    if (extra !== undefined) rows.push({ ...row, passes: extra, runIds: row.runIds.map(id => `${id}-confirm`) })
  }
  return { directory, definitions, rows, report, run, measure }
}

for (const [name, initial, baseline, extra, previous, expected, reason] of [
  ['pass', 3, 1, undefined, false, 'passed', null],
  ['baseline-passed check needs only threshold', 3, 5, undefined, false, 'passed', null],
  ['confirm then pass', 2, 1, 5, false, 'passed', null],
  ['confirmation threshold boundary', 2, 3, 4, false, 'passed', null],
  ['pooled margin near miss', 1, 2, 5, false, 'passed', 'below per-check margin'],
  ['margin failure', 3, 2, undefined, false, 'passed', 'below per-check margin'],
  ['first release seeds without regression', 1, 0, 0, false, 'passed', 'below k/N'],
  ['regression after confirmation', 2, 0, 3, true, 'failed', 'below k/N'],
  ['gating margin regression', 3, 2, undefined, true, 'failed', 'below per-check margin'],
  ['confirmation needed', 2, 0, undefined, false, 'blocked', null]
]) {
  test(`release gate ${name}`, async t => {
    const f = await fixture(t)
    if (previous) assert.equal((await f.run('0.1.1')).status, 0)
    if (previous) for (const row of f.rows.filter(row => row.mode === 'with')) row.runIds = row.runIds.map(id => `${id}-next`)
    f.measure(initial, baseline, extra)
    const result = await f.run(previous ? '0.1.2' : '0.1.1')
    assert.equal(result.data.status, expected, result.stdout)
    const output = result.data.data
    assert.equal(output.previous, previous ? '0.1.1' : null)
    if (reason) assert.ok([...output.knownIssues, ...output.blocking].some(row => row.check === 'decision' && row.reason === reason), result.stdout)
    if (expected === 'failed') assert.ok(output.blocking.some(row => row.class === 'regression'))
    if (expected === 'blocked') assert.deepEqual(output.confirmation, ['ambiguous-idea'])
    if (expected === 'passed' && !reason) assert.ok(!output.knownIssues.some(row => row.check === 'decision'))
    assert.deepEqual(JSON.parse(await readFile(join(f.directory, 'release', `${previous ? '0.1.2' : '0.1.1'}.json`), 'utf8')), output)
    assert.ok(output.knownIssues.some(row => row.runs === 0 && row.reason.includes('deferred')))
  })
}

for (const id of hardChecks) {
  test(`release gate blocks hard break ${id}`, async t => {
    const f = await fixture(t)
    f.report.checks.find(row => row.id === id).passed = false
    const result = await f.run()
    assert.equal(result.status, 1, result.stdout)
    assert.ok(result.data.data.blocking.some(row => row.class === 'hard-break' && row.check === id))
  })
}

for (const [name, failures, infrastructureFailures, expected] of [
  ['one process failure', 1, 0, 0], ['two process failures', 2, 0, 1], ['infrastructure failures need replacement', 0, 2, 2]
]) {
  test(`release gate ${name}`, async t => {
    const f = await fixture(t)
    Object.assign(f.report.agentProcesses[0], { failures, infrastructureFailures })
    const result = await f.run()
    assert.equal(result.status, expected, result.stdout)
  })
}

for (const [name, select] of [
  ['fixture mutation', row => row.check === 'fixture-unchanged'],
  ['explicit invocation', row => row.caseId === 'AC-43'],
  ['implicit invocation', row => row.caseId === 'AC-42']
]) {
  test(`release gate treats ${name} as a hard break in first release`, async t => {
    const f = await fixture(t)
    f.rows.find(row => row.mode === 'with' && select(row)).passes = 4
    const result = await f.run()
    assert.equal(result.status, 1, result.stdout)
    assert.ok(result.data.data.blocking.some(row => row.class === 'hard-break'))
  })
}

for (const [name, mutate] of [
  ['missing smoke check', f => f.rows.splice(f.rows.findIndex(row => row.mode === 'with'), 1)],
  ['incomparable baseline', f => { f.rows.find(row => row.mode === 'without').fixtureHash = 'b'.repeat(64) }],
  ['wrong model', f => { f.report.model = 'other-model' }],
  ['stale hard-break report', f => { f.report.candidate = 'b'.repeat(40) }],
  ['missing hard-break check', f => f.report.checks.pop()],
  ['duplicate hard-break check', f => { f.report.checks[0] = f.report.checks[1] }],
  ['missing process outcome', f => f.report.agentProcesses.pop()],
  ['invalid count', f => { f.rows[0].passes = 6 }],
  ['fractional count', f => { f.rows[0].passes = 0.5 }],
  ['duplicate run', f => { f.rows[0].runIds[0] = f.rows[0].runIds[1] }],
  ['baseline and with-skill overlap', f => { f.rows.find(row => row.mode === 'without').runIds = [...f.rows.find(row => row.mode === 'with').runIds] }],
  ['overlapping confirmation', f => { f.measure(2, 0); f.rows.push({ ...f.rows.find(row => row.scenario === 'ambiguous-idea' && row.mode === 'with') }) }],
  ['inconsistent scenario runs', f => { f.rows.find(row => row.scenario === 'existing-repo' && row.mode === 'with').runIds[0] = 'other-run' }]
]) {
  test(`release gate rejects ${name}`, async t => {
    const f = await fixture(t)
    mutate(f)
    const result = await f.run()
    assert.equal(result.status, 2, result.stdout)
  })
}

test('full tier failures remain known issues', async t => {
  const f = await fixture(t)
  f.rows.push({ ...f.rows[0], tier: 'full', scenario: 'new-idea', check: 'interview', caseId: 'AC-1', passes: 0, mode: 'with' })
  const result = await f.run()
  assert.equal(result.status, 0, result.stdout)
  assert.ok(result.data.data.knownIssues.some(row => row.scenario === 'new-idea' && row.passes === 0 && row.runs === 5))
})

test('gating set requires eighty percent over the latest ten runs', async t => {
  const f = await fixture(t)
  f.measure(3, 0)
  assert.equal((await f.run('0.1.1')).status, 0)
  f.measure(4, 0)
  for (const row of f.rows.filter(row => row.mode === 'with')) row.runIds = row.runIds.map(id => `${id}-next`)
  const second = await f.run('0.1.2')
  assert.equal(second.status, 0, second.stdout)
  assert.ok(!second.data.data.gatingSet.includes('ambiguous-idea/decision'))
  f.measure(4, 0)
  for (const row of f.rows.filter(row => row.mode === 'with')) row.runIds = row.runIds.map(id => `${id}-next`)
  const third = await f.run('0.1.3')
  assert.equal(third.status, 0, third.stdout)
  assert.ok(third.data.data.gatingSet.includes('ambiguous-idea/decision'))
})

test('release gate measures the approved ten smoke scenarios', async t => {
  const f = await fixture(t)
  const result = await f.run()
  assert.equal(result.status, 0, result.stdout)
  assert.deepEqual([...new Set(result.data.data.checks.map(row => row.scenario))].sort(), [
    'ambiguous-idea', 'clear-goals', 'existing-repo', 'existing-repo-python', 'implicit-invocation',
    'maintenance', 'research-main-typescript', 'scope-and-prerequisites', 'selected-rule-relocation', 'verification-limitations'
  ])
})

test('gating history includes compatible ledger measurements between releases', async t => {
  const f = await fixture(t)
  assert.equal((await f.run('0.1.1')).status, 0)
  const current = f.rows.find(row => row.scenario === 'ambiguous-idea' && row.mode === 'with')
  f.measure(4, 0)
  current.runIds = current.runIds.map(id => `${id}-current`)
  f.rows.splice(f.rows.indexOf(current), 0, { ...current, candidate: 'c'.repeat(40), passes: 3,
    runIds: current.runIds.map(id => `${id}-intermediate`) })
  const result = await f.run('0.1.2')
  assert.equal(result.status, 0, result.stdout)
  assert.ok(!result.data.data.gatingSet.includes('ambiguous-idea/decision'))
})

for (const [name, path, expected] of [
  ['unaffected ancestor measurements', 'note.txt', 0],
  ['changed covered inputs need measurement', 'skills/repo-audit/new-guidance.md', 2],
  ['changed scenario requests need measurement', 'tests/eval/scenarios/scenarios.json', 2]
]) {
  test(`release gate carryover: ${name}`, async t => {
    const { repo } = await emptyRepo(t)
    for (const path of ['scripts', 'skills/repo-audit', 'tests/eval/scenarios', 'tests/fixtures', 'tests/acceptance/cases.json']) {
      await mkdir(resolve(repo, path, '..'), { recursive: true })
      await cp(join(root, path), join(repo, path), { recursive: true, filter: source => !source.split(/[\\/]/).includes('node_modules') })
    }
    await symlink(join(root, 'node_modules'), join(repo, 'node_modules'), 'dir')
    await writeFile(join(repo, '.git/info/exclude'), 'node_modules\n')
    git(repo, 'add', 'scripts', 'skills', 'tests')
    git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Release base')
    const ancestor = git(repo, 'rev-parse', 'HEAD').trim()
    if (path.endsWith('scenarios.json')) {
      const data = JSON.parse(await readFile(join(repo, path), 'utf8'))
      for (const item of data.scenarios) item.request += '\nChanged candidate input.'
      await writeFile(join(repo, path), JSON.stringify(data))
    } else await writeFile(join(repo, path), 'Changed candidate input.\n')
    git(repo, 'add', path)
    git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Candidate')
    const f = await fixture(t, repo)
    f.report.candidate = git(repo, 'rev-parse', 'HEAD').trim()
    for (const row of f.rows) row.candidate = ancestor
    const result = await f.run()
    assert.equal(result.status, expected, result.stdout)
    if (expected === 0) {
      assert.equal(result.data.data.carryover.length, 10)
      assert.ok(result.data.data.carryover.every(row => row.candidate === ancestor))
    } else assert.equal(result.data.data.pending.length, 10)
  })
}
