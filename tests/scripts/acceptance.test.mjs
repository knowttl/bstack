import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Commands run from the checkout while inputs remain in disposable directories.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function run(...args) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'acceptance.mjs'), ...args], { encoding: 'utf8' })
  return { ...result, data: JSON.parse(result.stdout) }
}

async function temporary(t) {
  const path = await mkdtemp(join(tmpdir(), 'bstack acceptance '))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

test('registry validates all 75 owned cases without passing planned procedures', () => {
  const result = run('--check-registry')
  assert.equal(result.status, 0)
  assert.deepEqual(result.data.data, { registered: 75, planned: 75, passed: 0 })
})

for (const [name, mutate] of [
  ['missing acceptance ID', data => data.cases.pop()],
  ['duplicate acceptance ID', data => { data.cases[1].id = data.cases[0].id }],
  ['unknown owner task', data => { data.cases[0].ownerTask = ['T99.1'] }],
  ['wrong existing owner task', data => { data.cases[54].ownerTask = ['T1.7'] }],
  ['missing shared owner', data => { data.cases[0].ownerTask = ['T2.9'] }],
  ['extra shared owner', data => { data.cases[0].ownerTask.push('T1.7') }],
  ['duplicate owner', data => { data.cases[0].ownerTask.push(data.cases[0].ownerTask[0]) }],
  ['invalid procedure status', data => { data.cases[0].procedure.status = 'passed' }],
  ['empty planned procedure', data => { data.cases[0].procedure.description = '' }],
  ['invalid criterion source', data => { data.cases[0].criterionSource = 'README.md' }],
  ['unknown registry field', data => { data.cases[0].extra = true }],
  ['missing completed evidence', data => { data.cases[0].procedure = { status: 'completed', path: 'tests/eval/scenarios/scenarios.json', name: 'new-idea', artifacts: ['missing.txt'] } }],
  ['unregistered completed test', data => { data.cases[40].procedure = { status: 'completed', path: 'missing.test.mjs', name: 'missing', artifacts: ['README.md'] } }]
]) {
  test(`registry blocks ${name}`, async t => {
    const directory = await temporary(t)
    const data = JSON.parse(await readFile(join(root, 'tests', 'acceptance', 'cases.json'), 'utf8'))
    mutate(data)
    const path = join(directory, 'cases.json')
    await writeFile(path, JSON.stringify(data))
    assert.equal(run('--check-registry', '--registry', path).status, 2)
  })
}

for (const evidenceType of ['agent', 'manual']) {
  for (const [caseId, name, expected] of [
    ['AC-1', 'ambiguous-idea', 2],
    ['AC-2', 'ambiguous-idea', 0],
    ['AC-9', 'new-idea', 0]
  ]) {
    test(`completed ${evidenceType} procedure ${expected ? 'blocks' : 'accepts'} ${name} for ${caseId}`, async t => {
      const directory = await temporary(t)
      const data = JSON.parse(await readFile(join(root, 'tests', 'acceptance', 'cases.json'), 'utf8'))
      const entry = data.cases.find(item => item.id === caseId)
      entry.evidenceType = evidenceType
      entry.procedure = { status: 'completed', path: 'tests/eval/scenarios/scenarios.json', name,
        artifacts: ['tests/eval/scenarios/scenarios.json'] }
      const path = join(directory, 'cases.json')
      await writeFile(path, JSON.stringify(data))
      const result = run('--check-registry', '--registry', path)
      assert.equal(result.status, expected, result.stdout)
      if (expected) assert.equal(result.data.problems[0].message, `Scenario ${name} does not check ${caseId}`)
      else assert.deepEqual(result.data.data, { registered: 75, planned: 74, passed: 0 })
    })
  }
}

test('duplicate final selections are blocked independently of run history', async t => {
  const directory = await temporary(t)
  const path = join(directory, 'selections.json')
  const selection = { caseId: 'AC-1', stage: 'final', revision: 'a'.repeat(40), runId: 'missing' }
  await writeFile(path, JSON.stringify({ schemaVersion: 1, selections: [selection, selection] }))
  const result = run('--selections', path, '--results', directory)
  assert.equal(result.status, 2)
  assert.match(result.data.problems[0].message, /Duplicate final selection/)
})

for (const name of ['valid skeleton passes from another working directory', 'unlisted-reference fails with reference-unlisted']) {
  test(`completed procedure definitions execute ${name} without scoring it`, async t => {
    const directory = await temporary(t)
    const data = JSON.parse(await readFile(join(root, 'tests', 'acceptance', 'cases.json'), 'utf8'))
    data.cases[40].procedure = { status: 'completed', path: 'tests/scripts/package-check.test.mjs',
      name, artifacts: ['tests/eval/results/tasks/T0.5.C5b.node24-check.txt'] }
    const path = join(directory, 'cases.json')
    await writeFile(path, JSON.stringify(data))
    const result = run('--check-registry', '--registry', path)
    assert.equal(result.status, 0, result.stdout)
    assert.deepEqual(result.data.data, { registered: 75, planned: 74, passed: 0 })
    data.cases[40].procedure.name = 'nonexistent test'
    await writeFile(path, JSON.stringify(data))
    assert.equal(run('--check-registry', '--registry', path).status, 2)
  })
}
