import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { emptyRepo, run, snapshot } from './discovery-fixture.mjs'

const entry = { rule: 'private-import', path: 'src/price.mjs', key: 'storage', reason: 'Keep existing debt visible until the selected cleanup.', removalCondition: 'Use the public pricing interface.' }
const violation = { rule: entry.rule, path: entry.path, key: entry.key }

async function setup(t, entries = [entry], violations = [violation]) {
  const f = await emptyRepo(t)
  await mkdir(join(f.repo, 'src'))
  await writeFile(join(f.repo, 'src/price.mjs'), '')
  await writeFile(join(f.repo, 'README.md'), '')
  f.baseline = { schemaVersion: 1, entries }
  f.violations = violations
  f.file = join(f.directory, 'violations.json')
  f.invoke = async (extra = []) => {
    await writeFile(join(f.repo, 'baseline.json'), JSON.stringify(f.baseline))
    await writeFile(f.file, JSON.stringify(f.violations))
    return run('baseline check', f.repo, process.env, ['--baseline', 'baseline.json', '--violations', f.file, ...extra])
  }
  return f
}

test('existing debt remains visible and checking leaves the target unchanged', async t => {
  const f = await setup(t)
  await f.invoke()
  const before = await snapshot(f.repo)
  const result = await f.invoke()
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.debt, [entry])
  assert.deepEqual(await snapshot(f.repo), before)
  const plain = spawnSync(process.execPath, [new URL('../../skills/repo-audit/scripts/repo-audit.mjs', import.meta.url).pathname,
    'baseline', 'check', '--repo', f.repo, '--baseline', 'baseline.json', '--violations', f.file], { encoding: 'utf8' })
  assert.equal(plain.status, 0)
  assert.match(plain.stdout, /debt: private-import src\/price.mjs storage/)
  assert.ok(plain.stdout.includes(entry.reason))
  assert.ok(plain.stdout.includes(entry.removalCondition))
})

for (const refresh of [false, true]) {
  test(`new debt fails ${refresh ? 'refresh without a finding' : 'checking'} without altering the baseline`, async t => {
    const f = await setup(t, [], [violation])
    const result = await f.invoke(refresh ? ['--refresh'] : [])
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'new-debt')
    assert.deepEqual(JSON.parse(await readFile(join(f.repo, 'baseline.json'), 'utf8')), f.baseline)
  })
}

test('a fixed entry fails checking and refresh removes only the fixed entry', async t => {
  const other = { ...entry, key: 'other' }
  const f = await setup(t, [entry, other], [violation])
  assert.equal((await f.invoke()).problems[0].code, 'stale-debt')
  const result = await f.invoke(['--refresh'])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.removedDebt, [other])
  assert.deepEqual(JSON.parse(await readFile(join(f.repo, 'baseline.json'), 'utf8')).entries, [entry])
})

async function authorize(f) {
  const findings = JSON.parse(await readFile(new URL('../inputs/findings-audit.json', import.meta.url), 'utf8'))
  findings.target.root = f.repo
  findings.findings = [findings.findings[0]]
  findings.findings[0].status = 'selected'
  findings.findings[0].category = 'debt'
  findings.findings[0].resolved = false
  findings.selectedFindingIds = [findings.findings[0].id]
  const path = join(f.directory, 'findings.json')
  const entryPath = join(f.directory, 'entry.json')
  const save = async () => {
    await writeFile(path, JSON.stringify(findings))
    await writeFile(entryPath, JSON.stringify(entry))
  }
  await save()
  return { findings, save, args: ['--refresh', '--finding', findings.findings[0].id, '--findings', path, '--entry', entryPath] }
}

test('a selected debt finding authorizes one matching new entry', async t => {
  const f = await setup(t, [], [violation])
  const a = await authorize(f)
  const result = await f.invoke(a.args)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(JSON.parse(await readFile(join(f.repo, 'baseline.json'), 'utf8')).entries, [entry])
})

for (const [name, mutate] of [
  ['unselected finding', f => { f.findings[0].status = 'proposed'; f.selectedFindingIds = [] }],
  ['resolved finding', f => { f.findings[0].resolved = true }],
  ['different scope', f => { f.findings[0].scope = ['README.md'] }],
  ['different target', f => { f.target.root += '-other' }],
  ['decision finding', f => { f.findings[0].category = 'decision' }]
]) {
  test(`${name} cannot authorize growth`, async t => {
    const f = await setup(t, [], [violation])
    const a = await authorize(f)
    mutate(a.findings)
    await a.save()
    const result = await f.invoke(a.args)
    assert.notEqual(result.exit, 0)
    assert.deepEqual(JSON.parse(await readFile(join(f.repo, 'baseline.json'), 'utf8')).entries, [])
  })
}

test('authorization for one entry cannot refresh unrelated new debt', async t => {
  const f = await setup(t, [], [violation, { ...violation, key: 'other' }])
  const a = await authorize(f)
  const result = await f.invoke(a.args)
  assert.equal(result.exit, 1)
  assert.deepEqual(JSON.parse(await readFile(join(f.repo, 'baseline.json'), 'utf8')).entries, [])
})

test('a selected finding cannot add an entry without a matching current violation', async t => {
  const f = await setup(t, [], [])
  const a = await authorize(f)
  const result = await f.invoke(a.args)
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'unauthorized-baseline-entry')
})

for (const [name, entries] of [
  ['duplicate identity', [entry, { ...entry, reason: 'Another reason.' }]],
  ['missing reason', [{ rule: entry.rule, path: entry.path, key: entry.key, removalCondition: entry.removalCondition }]],
  ['blank removal condition', [{ ...entry, removalCondition: ' ' }]],
  ['directory scope', [{ ...entry, path: 'src' }]]
]) {
  test(`${name} is rejected`, async t => {
    const f = await setup(t, entries)
    assert.notEqual((await f.invoke()).exit, 0)
  })
}
