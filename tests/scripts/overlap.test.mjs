import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { emptyRepo, run, snapshot } from './discovery-fixture.mjs'

async function plans(t, left, right) {
  const { directory, repo } = await emptyRepo(t)
  const files = [join(directory, 'left ü &.json'), join(directory, 'right ü &.json')]
  await writeFile(files[0], JSON.stringify({ schemaVersion: 1, id: 'left', writePaths: [], contracts: [], ...left }))
  await writeFile(files[1], JSON.stringify({ schemaVersion: 1, id: 'right', writePaths: [], contracts: [], ...right }))
  return { repo, files }
}

test('overlap reports seeded shared writes and shared contract files without target writes', async t => {
  const { repo, files } = await plans(t,
    { writePaths: ['src/shared.ts', 'src/left.ts'], contracts: [{ id: 'price', files: ['contracts/price.json'] }] },
    { writePaths: ['src/shared.ts', 'src/right.ts'], contracts: [{ id: 'total', files: ['contracts/price.json'] }] })
  const before = await snapshot(repo)
  const result = run('overlap', repo, process.env, ['--plans', ...files])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.sharedPaths, [{ left: 'src/shared.ts', right: 'src/shared.ts', examplePath: 'src/shared.ts' }])
  assert.deepEqual(result.data.sharedContracts, [{ leftId: 'price', rightId: 'total', sameId: false, files: [{ left: 'contracts/price.json', right: 'contracts/price.json', examplePath: 'contracts/price.json' }] }])
  assert.deepEqual(await snapshot(repo), before)
})

for (const [left, right, expected] of [
  ['src/**/*.ts', 'src/new.ts', 'src/new.ts'],
  ['src/**/*.ts', 'src/nested/new.ts', 'src/nested/new.ts'],
  ['src/*.ts', 'src/nested/new.ts', null],
  ['src/?.ts', 'src/😀.ts', 'src/😀.ts'],
  ['src/?.ts', 'src/ab.ts', null],
  ['src/a*.ts', 'src/*b.ts', 'src/ab.ts'],
  ['src/**/*.ts', 'src/**/new.*', 'src/new.ts'],
  ['src/**/*.ts', 'other/**/*.ts', null],
  ['src/Foo.ts', 'src/foo.ts', null],
  ['**/package-lock.json', 'package-lock.json', 'package-lock.json'],
  ['**/dist/**', 'dist/deep/file', 'dist/deep/file'],
  ['**/*', '.hidden', '.hidden'],
  ['src/*', 'src/notes ü &.txt', 'src/notes ü &.txt']
]) {
  test(`overlap declared glob ${left} against ${right}`, async t => {
    const { repo, files } = await plans(t, { writePaths: [left] }, { writePaths: [right] })
    const result = run('overlap', repo, process.env, ['--plans', ...files])
    assert.equal(result.exit, 0)
    assert.deepEqual(result.data.sharedPaths, expected === null ? [] : [{ left, right, examplePath: expected }])
  })
}

test('overlap retains a changing contract ID across disjoint files', async t => {
  const { repo, files } = await plans(t,
    { writePaths: ['a.ts'], contracts: [{ id: 'price', files: ['a.ts'] }] },
    { writePaths: ['b.ts'], contracts: [{ id: 'price', files: ['b.ts'] }] })
  const result = run('overlap', repo, process.env, ['--plans', ...files])
  assert.deepEqual(result.data.sharedPaths, [])
  assert.deepEqual(result.data.sharedContracts, [{ leftId: 'price', rightId: 'price', sameId: true, files: [] }])
})

for (const path of ['/absolute', 'C:/file', 'C:\\file', '../file', 'src/../file', './file', 'src//file', 'src/', 'src/[ab].ts', 'src/{a,b}.ts', '!src/file', 'src/a**.ts']) {
  test(`overlap rejects unsupported path ${path}`, async t => {
    const { repo, files } = await plans(t, { writePaths: [path] }, {})
    assert.equal(run('overlap', repo, process.env, ['--plans', ...files]).problems[0].code, 'invalid-glob')
  })
}

for (const [left, right, code] of [
  [{ extra: true }, {}, 'unknown-field'],
  [{ schemaVersion: 2 }, {}, 'invalid-const'],
  [{ writePaths: 'src/file' }, {}, 'invalid-type'],
  [{ id: 'same' }, { id: 'same' }, 'duplicate-id'],
  [{ contracts: [{ id: 'price', files: ['a'] }, { id: 'price', files: ['b'] }] }, {}, 'duplicate-id'],
  [{ contracts: [{ id: 'price', files: ['C:/file'] }] }, {}, 'invalid-glob']
]) {
  test(`overlap rejects invalid plan ${JSON.stringify(left)}`, async t => {
    const { repo, files } = await plans(t, left, right)
    assert.equal(run('overlap', repo, process.env, ['--plans', ...files]).problems[0].code, code)
  })
}

test('overlap requires exactly two readable plans', async t => {
  const { repo, files } = await plans(t, {}, {})
  assert.equal(run('overlap', repo).exit, 3)
  assert.equal(run('overlap', repo, process.env, ['--plans', files[0]]).exit, 3)
  assert.equal(run('overlap', repo, process.env, ['--plans', ...files, files[0]]).exit, 3)
  await writeFile(files[0], '{broken')
  assert.equal(run('overlap', repo, process.env, ['--plans', ...files]).problems[0].code, 'invalid-plan')
})

for (const platform of ['win32', 'darwin']) {
  test(`overlap preserves portable declared paths with injected ${platform}`, async t => {
    const { repo, files } = await plans(t, { writePaths: ['src/**/*.txt'] }, { writePaths: ['src/notes ü & 😀.txt'] })
    const result = run('overlap', repo, process.env, ['--plans', ...files], platform)
    assert.equal(result.exit, 0)
    assert.deepEqual(result.data.sharedPaths, [{ left: 'src/**/*.txt', right: 'src/notes ü & 😀.txt', examplePath: 'src/notes ü & 😀.txt' }])
  })
}
