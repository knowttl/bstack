import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { build, git, snapshot } from './discovery-fixture.mjs'

// The skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = join(root, 'skills/plan/scripts/plan.mjs')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

async function planCheck(t, flag, target, plan) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack plan ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const file = join(directory, 'plan.json')
  await writeFile(file, JSON.stringify(plan))
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, 'plan', 'check', flag, target, '--plan', file, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

// A citation names the first line holding the text and binds the exact bytes read.
const citation = (bytes, path, needle, state = { kind: 'sha256', value: sha256(bytes) }) =>
  ({ location: `${path}:${bytes.toString('utf8').split('\n').findIndex(line => line.includes(needle)) + 1}`, state })

const unit = (id, title, dependsOn, design, evidence) => ({ id, title, core: true, dependsOn, design: [design], boundary: 'pantry storage', doneWhen: [`${title} works for the user`], evidence })

async function pantryPlan(t) {
  const target = build(t, 'design-only-idea')
  const bytes = await readFile(join(target, 'design.md'))
  const plan = { schemaVersion: 1, title: 'Pantry list plan', units: [
    unit('U1', 'Record a pantry item', [], citation(bytes, 'design.md', '### S1'), [{ kind: 'check', ref: 'add-item unit test' },
      { kind: 'check', ref: 'add-item timing check', nonFunctionalTarget: 'Adding an item takes under 200 ms with 500 items stored' }]),
    unit('U2', 'Build the shopping list', ['U1'], citation(bytes, 'design.md', '### S2'), [{ kind: 'kit-feature', ref: 'shopping-list' }]),
    unit('U3', 'Clear bought items', ['U2'], citation(bytes, 'design.md', '### S3'), [{ kind: 'check', ref: 'clear-list unit test' }])
  ] }
  return { target, bytes, plan }
}

test('the plan skill ships only the commands its procedure runs', () => {
  const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()).sort(), ['apply', 'cite-check', 'plan check', 'state show'])
})

test('a valid plan for a design-only idea lists its units dependencies first and writes nothing', async t => {
  const { target, plan } = await pantryPlan(t)
  plan.units.reverse()
  const before = await snapshot(target)
  const result = await planCheck(t, '--workspace', target, plan)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data, { units: 3, citationsChecked: 3, order: ['U1', 'U2', 'U3'] })
  assert.deepEqual(await snapshot(target), before)
})

for (const [name, mutate, codes, message] of [
  ['a unit with no evidence', plan => { plan.units[1].evidence = [] }, ['unit-no-evidence']],
  ['a dependency cycle', plan => { plan.units[0].dependsOn = ['U3'] }, ['dependency-cycle'], /U1 -> U3 -> U2 -> U1/],
  ['a unit that depends on itself', plan => { plan.units[1].dependsOn = ['U2'] }, ['dependency-cycle'], /U2 -> U2/],
  ['a dependency on a unit the plan lacks', plan => { plan.units[1].dependsOn = ['U9'] }, ['unknown-dependency']],
  ['a unit with no design citation', plan => { plan.units[0].design = [] }, ['min-items']],
  ['a duplicate unit ID', plan => { plan.units[1].id = 'U1' }, ['duplicate-id']],
  ['a citation line beyond the design', plan => { plan.units[0].design[0].location = 'design.md:999' }, ['citation-line-out-of-range']],
  ['a citation of a missing file', plan => { plan.units[0].design[0].location = 'missing.md:1' }, ['citation-file-unavailable']]
]) {
  test(`plan check rejects ${name}`, async t => {
    const { target, plan } = await pantryPlan(t)
    mutate(plan)
    const result = await planCheck(t, '--workspace', target, plan)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.deepEqual(result.problems.map(problem => problem.code), codes)
    if (message) assert.match(result.problems[0].message, message)
  })
}

test('plan check rejects a design citation after the design changes', async t => {
  const { target, plan } = await pantryPlan(t)
  await appendFile(join(target, 'design.md'), '- N3: Export finishes in under 1 second.\n')
  const result = await planCheck(t, '--workspace', target, plan)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.deepEqual(result.problems.map(problem => problem.code), ['stale-citation', 'stale-citation', 'stale-citation'])
})

test('plan check accepts revision-bound citations of an existing repo and rejects them once the design changes', async t => {
  const target = build(t, 'plan-existing-repo')
  const revision = { kind: 'revision', value: git(target, 'rev-parse', 'HEAD') }
  const design = await readFile(join(target, 'docs/export-design.md'))
  const plan = { schemaVersion: 1, title: 'Export plan', units: [
    unit('U1', 'Export saved articles', [], citation(design, 'docs/export-design.md', '### S1', revision), [{ kind: 'check', ref: 'export round-trip test' }]),
    unit('U2', 'Import a backup file', ['U1'], citation(await readFile(join(target, 'DESIGN.md')), 'DESIGN.md', 'The queue owns', revision), [{ kind: 'check', ref: 'import refusal test' }])
  ] }
  const accepted = await planCheck(t, '--repo', target, plan)
  assert.equal(accepted.exit, 0, JSON.stringify(accepted))
  assert.deepEqual(accepted.data, { units: 2, citationsChecked: 2, order: ['U1', 'U2'] })
  await appendFile(join(target, 'docs/export-design.md'), '- N2: Import takes under 1 second.\n')
  const rejected = await planCheck(t, '--repo', target, plan)
  assert.equal(rejected.exit, 1, JSON.stringify(rejected))
  assert.deepEqual(rejected.problems.map(problem => problem.code), ['stale-citation'])
})

test('plan check without a plan is a usage error', () => {
  const result = spawnSync(process.execPath, [entry, 'plan', 'check', '--workspace', tmpdir(), '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 3)
  assert.equal(JSON.parse(result.stdout).problems[0].code, 'missing-plan')
})
