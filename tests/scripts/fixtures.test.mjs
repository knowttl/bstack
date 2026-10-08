import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// The builder and source byte contract are anchored to this checkout.
const sources = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures')

function build(t, name, env = process.env) {
  const result = spawnSync(process.execPath, [join(sources, 'build.mjs'), name], { encoding: 'utf8', env })
  assert.equal(result.status, 0, result.stderr)
  const fixtures = result.stdout.trim().split('\n').map(line => JSON.parse(line))
  for (const fixture of fixtures) t.after(() => rm(fixture.path, { recursive: true, force: true }))
  return fixtures
}

function git(path, ...args) {
  const result = spawnSync('git', args, { cwd: path, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

async function bytes(path) {
  const files = {}
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory()) files[entry.name] = await bytes(join(path, entry.name))
    else files[entry.name] = (await readFile(join(path, entry.name))).toString('base64')
  }
  return files
}

for (const name of ['new-idea', 'ambiguous-idea']) {
  test(`${name} builds a non-Git workspace containing only its brief`, async t => {
    const [fixture] = build(t, name)
    assert.equal(fixture.kind, 'idea')
    assert.deepEqual(await readdir(fixture.path), ['brief.md'])
    assert.deepEqual(await readFile(join(fixture.path, 'brief.md')), await readFile(join(sources, name, 'brief.md')))
  })
}

test('clear-goals replays deterministic history with local identity and signing disabled', async t => {
  const home = await mkdtemp(join(tmpdir(), 'bstack fixture é $; '))
  t.after(() => rm(home, { recursive: true, force: true }))
  const globalConfig = join(home, 'gitconfig')
  await writeFile(globalConfig, '[user]\n name = Outside Author\n email = outside@example.invalid\n[commit]\n gpgsign = true\n[core]\n autocrlf = true\n')
  const before = await readFile(globalConfig)
  const env = { ...process.env, TMPDIR: home, TMP: home, TEMP: home, GIT_CONFIG_GLOBAL: globalConfig }
  const [first] = build(t, 'clear-goals', env)
  const [second] = build(t, 'clear-goals', env)
  assert.notEqual(first.path, second.path)
  assert.equal(first.kind, 'repo')
  assert.equal(git(first.path, 'rev-parse', 'HEAD'), git(second.path, 'rev-parse', 'HEAD'))
  assert.equal(git(first.path, 'log', '--reverse', '--format=%s'), 'docs: approve project vision\ndocs: record design and vocabulary')
  assert.equal(git(first.path, 'ls-tree', '--name-only', 'HEAD~1'), 'VISION.md')
  assert.equal(git(first.path, 'log', '--format=%an <%ae>'), 'Fixture Author <fixture@example.invalid>\nFixture Author <fixture@example.invalid>')
  assert.equal(git(first.path, 'config', '--local', 'user.name'), 'Fixture Author')
  assert.equal(git(first.path, 'config', '--local', 'user.email'), 'fixture@example.invalid')
  assert.equal(git(first.path, 'config', '--local', 'commit.gpgsign'), 'false')
  assert.equal(git(first.path, 'status', '--porcelain'), '')
  assert.deepEqual(await readFile(globalConfig), before)
})

test('all fixtures run sanity checks and leave source bytes unchanged', async t => {
  const before = await bytes(sources)
  const fixtures = build(t, '--all')
  const registry = JSON.parse(await readFile(join(sources, 'fixtures.json'), 'utf8'))
  assert.deepEqual(fixtures.map(({ name, kind }) => ({ name, kind })),
    Object.entries(registry).map(([name, fixture]) => ({ name, kind: fixture.kind })))
  assert.deepEqual(await bytes(sources), before)
})

for (const name of ['dirty-work', 'refactor', 'contract-removal', 'shallow-history', 'installer-collision']) {
  test(`${name} reproduces its declared state with deterministic history`, t => {
    const [first] = build(t, name)
    const [second] = build(t, name)
    assert.equal(git(first.path, 'rev-parse', 'HEAD'), git(second.path, 'rev-parse', 'HEAD'))
    assert.equal(git(first.path, 'status', '--porcelain'), git(second.path, 'status', '--porcelain'))
  })
}

for (const name of ['ts-shop', 'py-ledger']) {
  test(`${name} reports missing native tools as blocked`, () => {
    const entry = join(sources, name, 'sanity.mjs')
    const args = ['--input-type=module', '-e', "import { fileURLToPath } from 'node:url'; const entry = process.argv[2]; process.execPath = process.argv[1]; process.argv = [process.execPath, fileURLToPath(entry), ...process.argv.slice(3)]; await import(entry)", join(sources, 'missing-node', 'node.exe'), pathToFileURL(entry).href, tmpdir()]
    const result = spawnSync(process.execPath, args,
      { encoding: 'utf8', env: { ...process.env, PATH: '', npm_execpath: '' } })
    assert.equal(result.status, 2)
    assert.match(result.stderr, /Blocked: install/)
  })
}

test('a changed fixture seed fails its sanity check', async t => {
  const [fixture] = build(t, 'ambiguous-idea')
  await writeFile(join(fixture.path, 'brief.md'), 'Use a browser app. No decisions remain.\n')
  const result = spawnSync(process.execPath, [join(sources, fixture.name, 'sanity.mjs'), fixture.path], { encoding: 'utf8' })
  assert.equal(result.status, 1)
})

test('unknown fixture selection returns usage without building', () => {
  const result = spawnSync(process.execPath, [join(sources, 'build.mjs'), 'missing'], { encoding: 'utf8' })
  assert.equal(result.status, 3)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Usage:/)
})
