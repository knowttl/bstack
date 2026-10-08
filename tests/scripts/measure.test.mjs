import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build, emptyRepo, git, run, snapshot } from './discovery-fixture.mjs'

function commit(repo, message) {
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', message)
  return git(repo, 'rev-parse', 'HEAD')
}

test('ts-shop mixed responsibilities and coupled cluster have supporting signal commits', async t => {
  const repo = build(t, 'ts-shop')
  const base = git(repo, 'rev-parse', 'HEAD')
  await appendFile(join(repo, 'packages/web/ui.ts'), '\n// Pricing change\n')
  await appendFile(join(repo, 'packages/core/a.ts'), '\n// Coupled change\n')
  await appendFile(join(repo, 'packages/core/b.ts'), '\n// Coupled change\n')
  const first = commit(repo, 'feat: update pricing and coupled rules')
  await appendFile(join(repo, 'packages/core/a.ts'), '\n// Second change\n')
  await appendFile(join(repo, 'packages/core/b.ts'), '\n// Second change\n')
  const second = commit(repo, 'feat: update coupled rules')
  const result = run('measure', repo, process.env, ['--range', `${base}..HEAD`])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files.find(file => file.path === 'packages/web/ui.ts').commits, [first])
  assert.deepEqual(result.data.coChangePairs.find(pair => pair.paths.join(',') === 'packages/core/a.ts,packages/core/b.ts'), {
    paths: ['packages/core/a.ts', 'packages/core/b.ts'], commits: [second, first], changeCount: 2
  })
  assert.deepEqual(result.data.range, { requested: `${base}..HEAD`, base, head: second, resolved: `${base}..${second}` })
  assert.ok(result.data.exclusions.files.some(file => file.path === 'package-lock.json' && file.reason === 'lockfile'))
})

test('py-ledger cohesive module and startup remain signals without a violation classification', t => {
  const repo = build(t, 'py-ledger')
  const head = git(repo, 'rev-parse', 'HEAD')
  const result = run('measure', repo, process.env, ['--range', 'HEAD'])
  assert.equal(result.exit, 0)
  assert.deepEqual(Object.keys(result.data.files.find(file => file.path === 'startup.py')).sort(), ['bytes', 'changeCount', 'commits', 'path'])
  assert.deepEqual(result.data.files.find(file => file.path === 'ledger/book.py').commits, [head])
  assert.ok(result.data.files.find(file => file.path === 'startup.py').bytes > 0)
  assert.deepEqual(result.data.exclusions.files, [{ path: 'uv.lock', reason: 'lockfile', pattern: '**/uv.lock' }])
  assert.equal(result.status, 'passed')
})

test('measure joins chained renames, excludes declared formatting and generated paths, and stays read-only', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFile(join(repo, 'old ü & 😀.txt'), 'Stable bytes\n')
  await writeFile(join(repo, 'peer.txt'), 'Peer\n')
  const seed = commit(repo, 'seed')
  git(repo, 'mv', 'old ü & 😀.txt', 'middle ü & 😀.txt')
  const first = commit(repo, 'rename')
  git(repo, 'mv', 'middle ü & 😀.txt', 'new ü & 😀.txt')
  const second = commit(repo, 'rename again')
  await appendFile(join(repo, 'peer.txt'), '\n')
  await appendFile(join(repo, 'new ü & 😀.txt'), '\n')
  const formatting = commit(repo, 'style: broad formatting')
  await mkdir(join(repo, 'dist'))
  await writeFile(join(repo, 'dist/output.txt'), 'Generated\n')
  await writeFile(join(repo, 'generated ü 😀.txt'), 'Generated\n')
  await writeFile(join(repo, 'package-lock.json'), '{}\n')
  commit(repo, 'build: outputs')
  const policy = join(directory, 'exclusions ü &.json')
  await writeFile(policy, JSON.stringify({ schemaVersion: 1, generatedPaths: ['generated *.txt'], formattingCommits: [formatting] }))
  await writeFile(join(repo, 'new ü & 😀.txt'), 'Uncommitted bytes should not change measurements\n')
  const before = await snapshot(repo)
  const result = run('measure', repo, process.env, ['--range', 'HEAD', '--exclusions', policy])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files.find(file => file.path === 'new ü & 😀.txt'), { path: 'new ü & 😀.txt', bytes: 14, commits: [second, first, seed], changeCount: 3 })
  assert.deepEqual(result.data.files.find(file => file.path === 'peer.txt').commits, [seed])
  assert.equal(result.data.files.length, 2)
  assert.deepEqual(result.data.coChangePairs, [{ paths: ['new ü & 😀.txt', 'peer.txt'], commits: [seed], changeCount: 1 }])
  assert.deepEqual(result.data.exclusions.formattingCommits, [formatting])
  assert.deepEqual(result.data.exclusions.files.map(file => file.path), ['dist/output.txt', 'generated ü 😀.txt', 'package-lock.json'])
  assert.equal(result.data.renames.length, 2)
  assert.deepEqual(run('measure', repo, process.env, ['--range', 'HEAD', '--exclusions', policy]).data, result.data)
  assert.deepEqual(await snapshot(repo), before)
})

test('measure honours empty ranges, missing history, and deleted paths', async t => {
  const { repo } = await emptyRepo(t)
  assert.equal(run('measure', repo, process.env, ['--range', 'HEAD']).exit, 2)
  await writeFile(join(repo, 'removed.txt'), 'Gone\n')
  const seed = commit(repo, 'seed')
  git(repo, 'rm', 'removed.txt')
  const deletion = commit(repo, 'delete')
  assert.deepEqual(run('measure', repo, process.env, ['--range', `${seed}..HEAD`]).data.files, [{ path: 'removed.txt', bytes: null, commits: [deletion], changeCount: 1 }])
  const empty = run('measure', repo, process.env, ['--range', 'HEAD..HEAD'])
  assert.equal(empty.exit, 0)
  assert.deepEqual(empty.data.coChangePairs, [])
  assert.deepEqual(empty.data.files, [])
})

for (const range of ['', '--all', 'HEAD...HEAD', '..HEAD', 'HEAD..']) {
  test(`measure rejects missing or unsupported range ${JSON.stringify(range)}`, async t => {
    const { repo } = await emptyRepo(t)
    assert.equal(run('measure', repo, process.env, range ? ['--range', range] : []).exit, 3)
  })
}

test('measure rejects unknown exclusion fields and out-of-range formatting commits', async t => {
  const repo = build(t, 'py-ledger')
  const policy = join(repo, 'policy.json')
  await writeFile(policy, JSON.stringify({ schemaVersion: 1, generatedPaths: [], formattingCommits: [], typo: [] }))
  assert.equal(run('measure', repo, process.env, ['--range', 'HEAD', '--exclusions', policy]).problems[0].code, 'unknown-field')
  await writeFile(policy, JSON.stringify({ schemaVersion: 1, generatedPaths: [], formattingCommits: ['HEAD'] }))
  assert.equal(run('measure', repo, process.env, ['--range', 'HEAD..HEAD', '--exclusions', policy]).problems[0].code, 'exclusion-outside-range')
})

for (const platform of ['win32', 'darwin']) {
  test(`measure preserves literal Git paths with injected ${platform}`, async t => {
    const { repo } = await emptyRepo(t)
    await writeFile(join(repo, 'literal ü & [notes]; 😀.txt'), 'Bytes\n')
    const head = commit(repo, 'seed')
    const result = run('measure', repo, process.env, ['--range', 'HEAD'], platform)
    assert.equal(result.exit, 0)
    assert.deepEqual(result.data.files, [{ path: 'literal ü & [notes]; 😀.txt', bytes: 6, commits: [head], changeCount: 1 }])
  })
}
