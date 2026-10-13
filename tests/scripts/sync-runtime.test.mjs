import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Test the command in a disposable checkout, including paths with spaces and Unicode.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// These are the skills the command declares as runtime copy targets.
const copies = ['skills/repo-audit', 'skills/verification']

async function sandbox(t, files = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack runtime é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'))
  await cp(join(root, 'scripts', 'sync-runtime.mjs'), join(directory, 'scripts', 'sync-runtime.mjs'))
  const runtime = {
    'scripts/lib/paths.mjs': 'export const name = "paths"\n',
    'scripts/commands/rule-proof.mjs': "import { name } from '../lib/paths.mjs'\nexport const schema = new URL('../../schemas/plan.json', import.meta.url)\nexport { name }\n",
    'schemas/plan.json': '{}\n',
    ...files
  }
  for (const [file, text] of Object.entries(runtime)) {
    await mkdir(dirname(join(directory, 'runtime', file)), { recursive: true })
    await writeFile(join(directory, 'runtime', file), text)
  }
  return directory
}

function run(directory, ...args) {
  return spawnSync(process.execPath, [join(directory, 'scripts', 'sync-runtime.mjs'), ...args], { encoding: 'utf8', cwd: tmpdir() })
}

test('check passes after sync copies the runtime into every skill', async t => {
  const directory = await sandbox(t)
  assert.equal(run(directory, '--check').status, 1)
  const synced = run(directory)
  assert.equal(synced.status, 0, synced.stderr)
  for (const skill of copies) {
    assert.equal(await readFile(join(directory, skill, 'scripts', 'lib', 'paths.mjs'), 'utf8'), 'export const name = "paths"\n')
  }
  const checked = run(directory, '--check')
  assert.equal(checked.status, 0, checked.stderr)
  assert.match(checked.stdout, /Checked 3 runtime files in 2 skills/)
})

for (const [name, mutate, message] of [
  ['edited', directory => writeFile(directory, 'local edit'), /skills\/verification\/scripts\/lib\/paths\.mjs is stale/],
  ['removed', directory => rm(directory), /skills\/verification\/scripts\/lib\/paths\.mjs is missing/]
]) {
  test(`check fails when a copy is ${name} and leaves it unrepaired`, async t => {
    const directory = await sandbox(t)
    assert.equal(run(directory).status, 0)
    const copy = join(directory, 'skills', 'verification', 'scripts', 'lib', 'paths.mjs')
    await mutate(copy)
    const result = run(directory, '--check')
    assert.equal(result.status, 1)
    assert.match(result.stderr, message)
    assert.equal(await readFile(copy, 'utf8').catch(error => error.code), name === 'edited' ? 'local edit' : 'ENOENT')
  })
}

test('sync refuses a runtime script that imports outside the shared source', async t => {
  const directory = await sandbox(t, { 'scripts/commands/probe.mjs': "import { fileBytes } from '../lib/protected-write.mjs'\n" })
  const result = run(directory)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /runtime\/scripts\/commands\/probe\.mjs imports \.\.\/lib\/protected-write\.mjs outside the shared runtime/)
  assert.equal(await readFile(join(directory, 'skills', 'repo-audit', 'scripts', 'lib', 'paths.mjs'), 'utf8').catch(error => error.code), 'ENOENT')
})

test('committed skill copies match the shared runtime source', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'sync-runtime.mjs'), '--check'], { encoding: 'utf8', cwd: tmpdir() })
  assert.equal(result.status, 0, result.stderr)
})
