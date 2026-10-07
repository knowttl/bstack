import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Resolve package inputs from the suite location, not the shell working directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function sandbox(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack bootstrap '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'))
  await cp(join(root, 'scripts', 'test.mjs'), join(directory, 'scripts', 'test.mjs'))
  return directory
}

function run(directory, ...args) {
  // The child represents a fresh user invocation, outside the parent test runner.
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return spawnSync(process.execPath, [join(directory, 'scripts', 'test.mjs'), ...args], { encoding: 'utf8', env })
}

test('bootstrap manifest commands and root lockfile agree', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
  assert.equal(manifest.private, true)
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.engines.node, '>=24')
  assert.deepEqual(manifest.scripts, {
    check: 'node --test tests/scripts/bootstrap.test.mjs tests/scripts/skill-skeleton.test.mjs',
    test: 'node scripts/test.mjs',
    eval: 'node scripts/eval.mjs'
  })
  assert.equal(lock.lockfileVersion, 3)
  assert.equal(lock.name, manifest.name)
  assert.equal(lock.version, manifest.version)
  assert.equal(lock.packages[''].name, manifest.name)
  assert.equal(lock.packages[''].version, manifest.version)
  assert.deepEqual(lock.packages[''].engines, manifest.engines)
  assert.deepEqual(Object.keys(lock.packages), [''])
  assert.equal(manifest.dependencies, undefined)
  assert.equal(manifest.devDependencies, undefined)
})

test('discovery sorts explicit suites and excludes fixture, dependency and evaluation tests', async t => {
  const directory = await sandbox(t)
  for (const folder of ['scripts', 'package-check', 'scripts/node_modules', 'eval/workspace', 'fixtures/excluded']) {
    await mkdir(join(directory, 'tests', folder), { recursive: true })
  }
  await writeFile(join(directory, 'tests', 'scripts', 'z.test.mjs'), "import test from 'node:test'\ntest('script suite executed', () => {})\n")
  await writeFile(join(directory, 'tests', 'package-check', 'a.test.mjs'), "import test from 'node:test'\ntest('package suite executed', () => {})\n")
  for (const folder of ['fixtures/excluded', 'scripts/node_modules', 'eval/workspace']) {
    await cp(join(root, 'tests', 'fixtures', 'excluded', 'failing.test.mjs'), join(directory, 'tests', folder, 'failing.test.mjs'))
  }
  const result = run(directory)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /Selected 2 suite\(s\): tests[\\/]package-check[\\/]a.test.mjs, tests[\\/]scripts[\\/]z.test.mjs/)
  assert.match(result.stdout, /# tests 2/)
  assert.match(result.stdout, /script suite executed/)
  assert.match(result.stdout, /package suite executed/)
})

test('task selection executes only registered suites and rejects unknown tasks', async t => {
  const directory = await sandbox(t)
  await mkdir(join(directory, 'tests', 'scripts'), { recursive: true })
  await writeFile(join(directory, 'tests', 'tasks.json'), JSON.stringify({ 'T0.1': ['tests/scripts/selected.test.mjs'] }))
  await writeFile(join(directory, 'tests', 'scripts', 'selected.test.mjs'), "import test from 'node:test'\ntest('registered suite executed', () => {})\n")
  await cp(join(root, 'tests', 'fixtures', 'excluded', 'failing.test.mjs'), join(directory, 'tests', 'scripts', 'other.test.mjs'))
  const selected = run(directory, '--task', 'T0.1')
  assert.equal(selected.status, 0, selected.stderr + selected.stdout)
  assert.match(selected.stdout, /registered suite executed/)
  const unknown = run(directory, '--task', 'T99')
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /Unknown task: T99/)
})

test('an empty selected suite fails', async t => {
  const directory = await sandbox(t)
  const result = run(directory)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /No test suites selected/)
})
