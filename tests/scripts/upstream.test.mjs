import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { emptyRepo, git } from './discovery-fixture.mjs'

// Test the command in a disposable checkout, including paths with spaces and Unicode.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function sandbox(t, files = ['nested/SKILL.md']) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack upstream é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'remote', 'nested'), { recursive: true })
  await cp(join(root, 'upstream', 'fetch.mjs'), join(directory, 'fetch.mjs'))
  await cp(join(root, 'tests', 'fixtures', 'upstream', 'fetch-local.mjs'), join(directory, 'fetch-local.mjs'))
  await writeFile(join(directory, 'sources.json'), JSON.stringify([{
    name: 'fixture', repoUrl: 'https://github.com/fixture/source', commit: 'a'.repeat(40), files,
    sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update('pinned\r\nbytes é\n').digest('hex')]))
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
  const manifest = join(directory, 'sources.json')
  const sources = JSON.parse(await readFile(manifest, 'utf8'))
  delete sources[0].sha256
  await writeFile(manifest, JSON.stringify(sources))
  const fetched = run(directory)
  assert.equal(fetched.status, 0, fetched.stderr)
  const path = join(directory, 'fixture', 'nested', 'SKILL.md')
  assert.deepEqual(await readFile(path), await readFile(join(directory, 'remote', 'nested', 'SKILL.md')))
  const [source] = JSON.parse(await readFile(join(directory, 'sources.json'), 'utf8'))
  assert.deepEqual(source.sha256, { 'nested/SKILL.md': createHash('sha256').update(await readFile(path)).digest('hex') })
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

test('committed upstream copies exactly match the offline hash manifest', async () => {
  const sources = JSON.parse(await readFile(join(root, 'upstream', 'sources.json'), 'utf8'))
  const expected = []
  for (const source of sources) {
    assert.deepEqual(Object.keys(source.sha256).sort(), [...source.files].sort(), `${source.name}: hash coverage`)
    for (const file of source.files) {
      const path = posix.join('upstream', source.name, file)
      expected.push(path)
      assert.equal(createHash('sha256').update(await readFile(join(root, ...path.split('/')))).digest('hex'),
        source.sha256[file], `${path}: pinned bytes changed`)
    }
  }
  const tracked = spawnSync('git', ['ls-files', '-z', '--', 'upstream'], { cwd: root, encoding: 'utf8' })
  assert.equal(tracked.status, 0, tracked.stderr)
  const copies = tracked.stdout.split('\0').filter(path => path && !['upstream/fetch.mjs', 'upstream/sources.json'].includes(path))
  assert.deepEqual(copies.sort(), expected.sort(), 'every committed upstream copy must have exactly one manifest entry')
})

function runOfflineInventory(repo) {
  // A fresh test invocation must not inherit the parent runner's context.
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return spawnSync(process.execPath, ['--test', '--test-name-pattern=committed upstream copies',
    join('tests', 'scripts', 'upstream.test.mjs')], { cwd: repo, encoding: 'utf8', env })
}

async function offlineSandbox(t) {
  const { repo } = await emptyRepo(t)
  await cp(join(root, 'upstream'), join(repo, 'upstream'), { recursive: true })
  await mkdir(join(repo, 'tests', 'scripts'), { recursive: true })
  for (const file of ['upstream.test.mjs', 'discovery-fixture.mjs', 'fixture-seed.mjs']) {
    await cp(join(root, 'tests', 'scripts', file), join(repo, 'tests', 'scripts', file))
  }
  git(repo, 'add', 'upstream')
  const baseline = runOfflineInventory(repo)
  assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr)
  return repo
}

test('offline inventory rejects a modified byte in a pinned copy', async t => {
  const repo = await offlineSandbox(t)
  const [source] = JSON.parse(await readFile(join(repo, 'upstream', 'sources.json'), 'utf8'))
  const path = join(repo, 'upstream', source.name, source.files[0])
  const bytes = await readFile(path)
  bytes[0] ^= 1
  await writeFile(path, bytes)
  const result = runOfflineInventory(repo)
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stdout + result.stderr, /pinned bytes changed/)
})

test('offline inventory rejects an unlisted tracked upstream copy', async t => {
  const repo = await offlineSandbox(t)
  await writeFile(join(repo, 'upstream', 'extra.md'), 'unlisted copy\n')
  git(repo, 'add', join('upstream', 'extra.md'))
  const result = runOfflineInventory(repo)
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stdout + result.stderr, /every committed upstream copy must have exactly one manifest entry/)
})

test('check refuses a hash that differs from the pinned bytes without rewriting it', async t => {
  const directory = await sandbox(t)
  assert.equal(run(directory).status, 0)
  const manifest = join(directory, 'sources.json')
  const sources = JSON.parse(await readFile(manifest, 'utf8'))
  sources[0].sha256['nested/SKILL.md'] = '0'.repeat(64)
  const bytes = JSON.stringify(sources)
  await writeFile(manifest, bytes)
  const result = run(directory, '--check')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /hash differs from a{40}/)
  assert.equal(await readFile(manifest, 'utf8'), bytes)
})

for (const [name, sha256] of [
  ['missing map', undefined],
  ['missing hash', {}],
  ['extra hash', { 'nested/SKILL.md': '0'.repeat(64), 'extra.md': '0'.repeat(64) }],
  ['malformed hash', { 'nested/SKILL.md': 'invalid' }]
]) {
  test(`check refuses ${name} without rewriting the manifest`, async t => {
    const directory = await sandbox(t)
    const manifest = join(directory, 'sources.json')
    const sources = JSON.parse(await readFile(manifest, 'utf8'))
    sources[0].sha256 = sha256
    const bytes = JSON.stringify(sources)
    await writeFile(manifest, bytes)
    const result = run(directory, '--check')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /require one SHA-256 hash for each listed file/)
    assert.equal(await readFile(manifest, 'utf8'), bytes)
  })
}
