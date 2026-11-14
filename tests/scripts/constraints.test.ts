import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { emptyRepo, git, run, snapshot } from './discovery-fixture.ts'

const checker = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/maintenance/scripts/bstack-check.mjs')
const contract = { schemaVersion: 1, documents: [], scopes: [], rules: [], generators: [], acceptanceSources: [],
  checks: [{ id: 'lint', command: { executable: 'node', args: ['--version'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['src/**'] }] }
const debt = (key: string) => ({ rule: 'private-import', path: 'src/app.mjs', key, reason: 'Predates the rule.', removalCondition: 'Import the public entry point.' })
const lintCheck = { id: 'lint', ruleId: 'private-import', proofDate: '2026-11-01' }
const boundary = { principle: 'hard-boundaries', rung: 'detect', retireWhen: 'The internals move out of the package.' }
const recorded = { class: 'app imports ledger internals', occurrences: ['commit 1a2b3c4', 'review comment 12'],
  constraint: { ...boundary, check: { ...lintCheck, baseline: 'debt/boundaries.json' } } }
const second = { class: 'handler builds raw SQL', occurrences: ['commit 5d6e7f8'] }

async function ledgerRepo(t: import('node:test').TestContext, ref = true) {
  const f = await emptyRepo(t)
  const write = async (path: string, value: object) => {
    await mkdir(dirname(join(f.repo, path)), { recursive: true })
    await writeFile(join(f.repo, path), JSON.stringify(value))
  }
  await write('.bstack/project.json', contract)
  await write('.bstack/constraints.json', { schemaVersion: 1, entries: [recorded] })
  await write('debt/boundaries.json', { schemaVersion: 1, entries: [debt('ledger._internal'), debt('ledger._store')] })
  git(f.repo, 'add', '.')
  git(f.repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'record the ledger')
  if (ref) git(f.repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  return { ...f, write }
}

function check(repo: string) {
  const result = spawnSync(process.execPath, [checker, '--repo', repo, '--docs-only', '--json'], { encoding: 'utf8' })
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

for (const { name, entries, baselines = {}, ref, expected } of [
  { name: 'accepts the recorded ledger', entries: [recorded], expected: [] },
  { name: 'accepts a baseline that shrank', entries: [recorded], baselines: { 'debt/boundaries.json': [debt('ledger._internal')] }, expected: [] },
  { name: 'rejects a baseline that grew', entries: [recorded], baselines: { 'debt/boundaries.json': [debt('ledger._internal'), debt('ledger._store'), debt('ledger._cache')] }, expected: ['constraint-baseline-grew'] },
  { name: 'rejects a recorded baseline when origin main is unavailable', entries: [recorded], ref: false, expected: ['prior-unavailable-fetch-the-ref'] },
  { name: 'rejects a baseline that does not exist', entries: [{ ...recorded, constraint: { ...boundary, check: { ...lintCheck, baseline: 'debt/absent.json' } } }], expected: ['constraint-baseline-missing'] },
  { name: 'accepts the first baseline of a new constraint', entries: [recorded, { class: 'core imports the web layer', occurrences: ['commit 9a8b7c6', 'commit 0f1e2d3'],
    constraint: { ...boundary, check: { ...lintCheck, ruleId: 'layer-direction', baseline: 'debt/layers.json' } } }],
    baselines: { 'debt/layers.json': [{ ...debt('web.routes'), rule: 'layer-direction' }] }, expected: [] },
  { name: 'keeps a class below the threshold with its single occurrence', entries: [recorded, second], expected: [] },
  { name: 'recognises the second occurrence of a recorded class', entries: [recorded, { ...second, occurrences: ['commit 5d6e7f8', 'run 01J finding f3'] }], expected: ['constraint-threshold-reached'] },
  { name: 'rejects a check the contract does not register', entries: [{ ...recorded, constraint: { ...boundary, check: { ...lintCheck, id: 'typecheck' } } }], expected: ['constraint-check-missing'] },
  { name: 'rejects a detect rung with no proven check', entries: [{ ...recorded, constraint: boundary }], expected: ['constraint-unproven'] },
  { name: 'accepts an encode rung with no check', entries: [{ ...recorded, constraint: { ...boundary, rung: 'encode' } }], expected: [] },
  { name: 'rejects a check with no proof date', entries: [{ ...recorded, constraint: { ...boundary, check: { id: 'lint', ruleId: 'private-import' } } }], expected: ['missing-field'] },
  { name: 'rejects a class recorded twice', entries: [recorded, { ...second, class: recorded.class }], expected: ['duplicate-constraint-class'] }
] satisfies { name: string; entries: object[]; baselines?: Record<string, object[]>; ref?: boolean; expected: string[] }[]) {
  test(`the installed checker ${name}`, async t => {
    const f = await ledgerRepo(t, ref)
    await f.write('.bstack/constraints.json', { schemaVersion: 1, entries })
    for (const [path, debts] of Object.entries(baselines)) await f.write(path, { schemaVersion: 1, entries: debts })
    const result = check(f.repo)
    assert.deepEqual(result.problems.map((problem: { code: string }) => problem.code), expected, JSON.stringify(result))
    assert.equal(result.exit, expected.length ? 1 : 0)
  })
}

test('scorecard reports the highest recorded rung per principle and whether a registered check proves it', async t => {
  const f = await ledgerRepo(t)
  await f.write('.bstack/constraints.json', { schemaVersion: 1, entries: [recorded, second,
    { class: 'order totals as bare numbers', occurrences: ['commit 2b3c4d5', 'commit 6e7f8a9'],
      constraint: { principle: 'illegal-states', rung: 'eliminate', retireWhen: 'Money is the only total type.', check: { ...lintCheck, id: 'typecheck', ruleId: 'TS2322' } } },
    { class: 'direct fetch outside the client wrapper', occurrences: ['commit 3c4d5e6', 'commit 7f8a9b0'],
      constraint: { principle: 'footgun-bans', rung: 'detect', retireWhen: 'The wrapper is the only export.', check: { ...lintCheck, ruleId: 'restricted-fetch' } } },
    { class: 'secrets pasted into fixtures', occurrences: ['commit 4d5e6f7', 'commit 8a9b0c1'],
      constraint: { principle: 'footgun-bans', rung: 'encode', retireWhen: 'A scanner replaces the instruction.' } },
    { class: 'unvalidated request bodies', occurrences: ['commit 5e6f7a8', 'commit 9b0c1d2'],
      constraint: { principle: 'early-rejection', rung: 'review', retireWhen: 'Every route parses its input.' } }] })
  const before = await snapshot(f.repo)
  const result = run('scorecard', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.principles.map((row: { principle: string; rung: string | null; proven: boolean }) => [row.principle, row.rung, row.proven]), [
    ['conventional-structure', null, false],
    ['hard-boundaries', 'detect', true],
    ['illegal-states', 'eliminate', false],
    ['footgun-bans', 'detect', true],
    ['early-rejection', 'review', false]
  ])
  assert.deepEqual(result.data.limitations, [])
  assert.ok(!JSON.stringify(result).includes(second.class))
  assert.deepEqual(await snapshot(f.repo), before)
})

test('scorecard passes with no rung and a limitation when the repo has no ledger', async t => {
  const f = await emptyRepo(t)
  const result = run('scorecard', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.ledger, null)
  assert.deepEqual(result.data.principles.map((row: { rung: string | null; proven: boolean }) => [row.rung, row.proven]), Array(5).fill([null, false]))
  assert.deepEqual(result.data.limitations, ['No constraint ledger at .bstack/constraints.json, so no rung is recorded.'])
})
