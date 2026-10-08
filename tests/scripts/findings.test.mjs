import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { emptyRepo, git, snapshot } from './discovery-fixture.mjs'

// Public commands run from outside the checkout and target.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// No private validator or report helper is used by these tests.
const entry = join(root, 'skills', 'repo-audit', 'scripts', 'repo-audit.mjs')

function run(context, action = 'validate', json = true, target = '--repo') {
  const result = spawnSync(process.execPath, [entry, 'findings', action, target, context.repo, '--findings', context.file, ...(json ? ['--json'] : [])],
    { encoding: 'utf8', cwd: context.directory, env: { ...process.env, XDG_CACHE_HOME: context.cache, LOCALAPPDATA: context.cache } })
  assert.equal(result.stderr, '')
  return json ? { exit: result.status, ...JSON.parse(result.stdout) } : result
}

async function save(context) {
  await writeFile(context.file, JSON.stringify(context.findings))
}

async function setup(t, stage = 'audit') {
  const context = await emptyRepo(t)
  context.file = join(context.directory, 'findings ü &.json')
  context.cache = join(context.directory, 'cache')
  await mkdir(context.cache)
  await mkdir(join(context.repo, 'src'))
  await writeFile(join(context.repo, 'README.md'), 'Price rules belong to the pricing module.\n')
  await writeFile(join(context.repo, 'src', 'price.mjs'), 'export const price = 42\n')
  context.findings = JSON.parse(await readFile(join(root, 'tests', 'inputs', `findings-${stage}.json`), 'utf8'))
  context.findings.target.root = context.repo
  await save(context)
  return context
}

async function evidence(context) {
  const result = run(context)
  assert.equal(result.exit, 0)
  const artifact = join(context.directory, 'journey ü &.txt')
  await writeFile(artifact, 'Observed quote: 42\n')
  context.findings.execution = context.findings.requiredOutcomes.map((outcome, index) => ({
    id: `E-${index}`, outcome, status: 'passed', fingerprint: result.data.fingerprint,
    artifact, artifactHash: createHash('sha256').update('Observed quote: 42\n').digest('hex'), method: `Run approved ${outcome} procedure`
  }))
  await save(context)
}

for (const [name, mutate, code] of [
  ['missing principle', f => delete f.findings[0].principle, 'missing-field'],
  ['blank principle', f => f.findings[0].principle = '  ', 'invalid-pattern'],
  ['unknown status', f => f.findings[0].status = 'accepted', 'invalid-enum'],
  ['unknown field', f => f.score = 100, 'unknown-field'],
  ['duplicate finding', f => f.findings.push(f.findings[0]), 'duplicate-id'],
  ['duplicate source', f => f.sources.push(f.sources[0]), 'duplicate-id'],
  ['missing source ID', f => delete f.sources[0].id, 'missing-field'],
  ['unknown source', f => f.findings[0].sourceIds = ['absent'], 'unknown-source'],
  ['unknown intent', f => f.sources[0].intent = 'assumed', 'invalid-enum'],
  ['selection mismatch', f => f.selectedFindingIds = [], 'selection-mismatch'],
  ['unknown selection', f => f.selectedFindingIds = ['F-002'], 'selection-mismatch'],
  ['duplicate selection', f => f.selectedFindingIds.push('F-001'), 'duplicate-item'],
  ['duplicate required outcome', f => f.requiredOutcomes.push('journey'), 'duplicate-item'],
  ['target mismatch', f => f.target.root = '/different', 'target-mismatch'],
  ['scope mismatch', f => f.findings[0].scope = ['outside.mjs'], 'scope-mismatch'],
  ['missing location', f => { f.findings[0].files = []; f.findings[0].command = null }, 'missing-location'],
  ['missing stage requirement', f => f.requiredOutcomes = ['units'], 'missing-stage-outcome']
]) {
  test(`findings validate rejects ${name} without target writes`, async t => {
    const context = await setup(t)
    mutate(context.findings)
    await save(context)
    const before = await snapshot(context.repo)
    const result = run(context)
    assert.equal(result.exit, 1)
    assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result))
    assert.deepEqual(await snapshot(context.repo), before)
  })
}

test('render separates source intent, selected debt and new principles in scratch', async t => {
  const context = await setup(t)
  context.findings.findings[0].newPrinciple = true
  await save(context)
  const before = await snapshot(context.repo)
  const result = run(context, 'render')
  assert.equal(result.exit, 0)
  assert.ok(result.data.path.startsWith(context.cache))
  const report = await readFile(result.data.path, 'utf8')
  for (const text of ['Documented intent', 'Observed behaviour', 'Inferred intent', 'Observed debt', 'proposed new principle', 'Selected findings', 'F-001']) assert.ok(report.includes(text), text)
  assert.equal(report.match(/^Result:/gm).length, 1)
  assert.equal(Object.hasOwn(result.data, 'score'), false)
  assert.deepEqual(await snapshot(context.repo), before)
  const plain = run(context, 'render', false)
  assert.equal(plain.status, 0)
  assert.ok(plain.stdout.includes(context.cache))
})

for (const stage of ['audit', 'foundation']) {
  test(`${stage} requires current evidence before ready`, async t => {
    const context = await setup(t, stage)
    context.findings.findings[0].resolved = true
    await save(context)
    assert.equal(run(context, 'render').data.result, 'verification blocked')
    await evidence(context)
    assert.equal(run(context, 'render').data.result, 'ready for the stated next change')
    await writeFile(join(context.repo, 'src', 'price.mjs'), 'export const price = 43\n')
    assert.equal(run(context, 'render').data.result, 'verification blocked')
  })
}

for (const [name, mutate, expected] of [
  ['failed journey despite passing units', f => { f.execution.find(e => e.outcome === 'journey').status = 'failed' }, 'verification blocked'],
  ['skipped journey', f => { f.execution.find(e => e.outcome === 'journey').status = 'skipped' }, 'verification blocked'],
  ['blocked journey', f => { f.execution.find(e => e.outcome === 'journey').status = 'blocked' }, 'verification blocked'],
  ['missing journey', f => { f.execution = f.execution.filter(e => e.outcome !== 'journey') }, 'verification blocked'],
  ['unresolved decision', f => { f.findings[0].category = 'decision'; f.findings[0].blocksNextChange = false }, 'decisions needed'],
  ['unresolved blocking debt', () => {}, 'decisions needed'],
  ['deferred nonblocking debt', f => { f.findings[0].blocksNextChange = false }, 'ready for the stated next change'],
  ['unselected new principle', f => { f.findings[0].newPrinciple = true; f.findings[0].status = 'proposed'; f.selectedFindingIds = []; f.findings[0].blocksNextChange = false }, 'decisions needed']
]) {
  test(`readiness handles ${name}`, async t => {
    const context = await setup(t)
    context.findings.requiredOutcomes.push('units')
    await save(context)
    await evidence(context)
    mutate(context.findings)
    await save(context)
    await evidence(context)
    mutate(context.findings)
    await save(context)
    assert.equal(run(context, 'render').data.result, expected)
  })
}

test('changed intent or selection invalidates otherwise passed evidence', async t => {
  const context = await setup(t)
  context.findings.findings[0].resolved = true
  await save(context)
  await evidence(context)
  context.findings.nextChange = 'Add tax calculation'
  await save(context)
  assert.equal(run(context).data.result, 'verification blocked')
  await evidence(context)
  context.findings.findings[0].status = 'rejected'
  context.findings.selectedFindingIds = []
  await save(context)
  assert.equal(run(context).data.result, 'verification blocked')
})

test('artifact deletion and changed bytes block readiness', async t => {
  const context = await setup(t)
  context.findings.findings[0].resolved = true
  await save(context)
  await evidence(context)
  await writeFile(context.findings.execution[0].artifact, 'Different outcome\n')
  assert.equal(run(context).data.result, 'verification blocked')
  context.findings.execution[0].artifact = join(context.directory, 'missing.txt')
  await save(context)
  assert.equal(run(context).data.result, 'verification blocked')
})

test('Git revision changes block readiness even with unchanged scoped bytes', async t => {
  const context = await setup(t)
  context.findings.findings[0].resolved = true
  await save(context)
  await evidence(context)
  git(context.repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'initial')
  assert.equal(run(context).data.result, 'verification blocked')
  context.findings.target.revision = git(context.repo, 'rev-parse', 'HEAD')
  await save(context)
  await evidence(context)
  assert.equal(run(context).data.result, 'ready for the stated next change')
})

test('foundation workspace renders without Git and refuses scratch inside target', async t => {
  const context = await setup(t, 'foundation')
  context.findings.target.mode = 'workspace'
  await save(context)
  assert.equal(run(context, 'render', true, '--workspace').data.result, 'verification blocked')
  context.cache = context.repo
  assert.equal(run(context, 'render', true, '--workspace').problems[0].code, 'scratch-inside-target')
})

test('findings rejects malformed input and missing option', async t => {
  const context = await setup(t)
  await writeFile(context.file, '{broken')
  assert.equal(run(context).problems[0].code, 'invalid-findings')
  const result = spawnSync(process.execPath, [entry, 'findings', 'validate', '--repo', context.repo, '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 3)
  assert.equal(JSON.parse(result.stdout).problems[0].code, 'missing-findings')
})

for (const action of ['validate', 'render']) {
  test(`findings ${action} rejects escaped duplicate members without target writes`, async t => {
    const context = await setup(t)
    const input = await readFile(context.file, 'utf8')
    await writeFile(context.file, input.replace('"nextChange":', '"next\\u0043hange":"discarded","nextChange":'))
    const before = await snapshot(context.repo)
    const result = run(context, action)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'duplicate-key')
    assert.deepEqual(await snapshot(context.repo), before)
  })
}

for (const [path, code] of [
  ['src', 'invalid-scope'], ['src/*.md', 'invalid-scope'], ['src/?.md', 'invalid-scope'],
  ['src/[ab].md', 'invalid-scope'], ['src/{a,b}.md', 'invalid-scope'], ['README.md/child', 'unresolved-path']
]) {
  test(`findings rejects unedited ${JSON.stringify(path)} scope without target writes`, async t => {
    const context = await setup(t)
    context.findings.reviewedScope.push(path)
    await save(context)
    const before = await snapshot(context.repo)
    const result = run(context)
    assert.notEqual(result.exit, 0)
    assert.equal(result.problems[0].code, code)
    assert.deepEqual(await snapshot(context.repo), before)
  })
}

test('findings accepts concrete planned absent files in reviewed scope', async t => {
  const context = await setup(t)
  context.findings.reviewedScope.push('future/new.md')
  await save(context)
  assert.equal(run(context).exit, 0)
})
