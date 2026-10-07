import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Test the command in a disposable checkout, including paths with spaces and Unicode.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function sandbox(t, files = ['nested/SKILL.md']) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack upstream é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'remote', 'nested'), { recursive: true })
  await cp(join(root, 'upstream', 'fetch.mjs'), join(directory, 'fetch.mjs'))
  await cp(join(root, 'tests', 'fixtures', 'upstream', 'fetch-local.mjs'), join(directory, 'fetch-local.mjs'))
  await writeFile(join(directory, 'sources.json'), JSON.stringify([{
    name: 'fixture', repoUrl: 'https://github.com/fixture/source', commit: 'a'.repeat(40), files
  }]))
  await writeFile(join(directory, 'remote', 'nested', 'SKILL.md'), Buffer.from('pinned\r\nbytes é\n'))
  return directory
}

function run(directory, ...args) {
  return spawnSync(process.execPath, ['--import', join(directory, 'fetch-local.mjs'), join(directory, 'fetch.mjs'), ...args], {
    encoding: 'utf8', cwd: tmpdir()
  })
}

test('fetch copies exact pinned bytes and check verifies them without writing', async t => {
  const directory = await sandbox(t)
  const fetched = run(directory)
  assert.equal(fetched.status, 0, fetched.stderr)
  const path = join(directory, 'fixture', 'nested', 'SKILL.md')
  assert.deepEqual(await readFile(path), await readFile(join(directory, 'remote', 'nested', 'SKILL.md')))
  const before = await stat(path)
  const checked = run(directory, '--check')
  assert.equal(checked.status, 0, checked.stderr)
  assert.match(checked.stdout, /Checked 1 files from 1 pinned sources/)
  assert.equal((await stat(path)).mtimeMs, before.mtimeMs)
})

for (const args of [[], ['--check']]) {
  test(`${args.length ? 'check' : 'fetch'} refuses a listed file absent at its pin`, async t => {
    const directory = await sandbox(t, ['nested/SKILL.md', 'missing.md'])
    const existing = join(directory, 'fixture', 'nested', 'SKILL.md')
    await mkdir(dirname(existing), { recursive: true })
    await writeFile(existing, await readFile(join(directory, 'remote', 'nested', 'SKILL.md')))
    const before = await stat(existing)
    const result = run(directory, ...args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /missing\.md absent or unavailable at a{40} \(HTTP 404\)/)
    assert.equal((await stat(existing)).mtimeMs, before.mtimeMs)
    await assert.rejects(stat(join(directory, 'fixture', 'missing.md')), { code: 'ENOENT' })
  })
}

test('check refuses an absent local copy without repairing it', async t => {
  const directory = await sandbox(t)
  const result = run(directory, '--check')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing local copy/)
  await assert.rejects(stat(join(directory, 'fixture')), { code: 'ENOENT' })
})

test('check refuses modified local bytes and preserves them', async t => {
  const directory = await sandbox(t)
  assert.equal(run(directory).status, 0)
  const path = join(directory, 'fixture', 'nested', 'SKILL.md')
  await writeFile(path, 'local edit')
  const result = run(directory, '--check')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /differs from a{40}/)
  assert.equal(await readFile(path, 'utf8'), 'local edit')
})

test('fetch rejects traversal before copying files', async t => {
  const directory = await sandbox(t, ['../outside.md'])
  const result = run(directory)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Invalid or duplicate file/)
  await assert.rejects(stat(join(directory, 'fixture')), { code: 'ENOENT' })
})
