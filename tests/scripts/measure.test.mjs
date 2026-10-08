import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { build, emptyRepo, git, run, snapshot } from './discovery-fixture.mjs'

function commitIndex(repo, message, date) {
  const result = spawnSync('git', ['-C', repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', message], {
    encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
  })
  assert.equal(result.status, 0, result.stderr)
  return git(repo, 'rev-parse', 'HEAD')
}

function commit(repo, message, date) {
  git(repo, 'add', '.')
  return commitIndex(repo, message, date)
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

for (const scenario of [
  { boundary: 'no', formatting: [], replacement: ['replacementRename', 'addition'], original: ['deletion', 'originalRename', 'seed'] },
  { boundary: 'addition', formatting: ['addition'], replacement: ['replacementRename'], original: ['deletion', 'originalRename', 'seed'] },
  { boundary: 'deletion', formatting: ['deletion'], replacement: ['replacementRename', 'addition'], original: ['originalRename', 'seed'] }
]) {
  test(`measure separates reused rename paths with ${scenario.boundary} formatting exclusion`, async t => {
    const { directory, repo } = await emptyRepo(t)
    await writeFile(join(repo, 'old.txt'), 'Original bytes\n')
    await writeFile(join(repo, 'peer.txt'), 'Peer\n')
    const seed = commit(repo, 'seed')
    git(repo, 'mv', 'old.txt', 'reused.txt')
    const originalRename = commit(repo, 'rename original')
    git(repo, 'rm', 'reused.txt')
    const deletion = commit(repo, 'delete original')
    await writeFile(join(repo, 'reused.txt'), 'Replacement bytes\n')
    const addition = commit(repo, 'add replacement')
    git(repo, 'mv', 'reused.txt', 'final.txt')
    const replacementRename = commit(repo, 'rename replacement')
    const commits = { seed, originalRename, deletion, addition, replacementRename }
    const policy = join(directory, 'exclusions.json')
    await writeFile(policy, JSON.stringify({ schemaVersion: 1, generatedPaths: [], formattingCommits: scenario.formatting.map(name => commits[name]) }))
    const result = run('measure', repo, process.env, ['--range', 'HEAD', '--exclusions', policy])
    assert.equal(result.exit, 0)
    assert.deepEqual(result.data.files.find(file => file.path === 'final.txt').commits, scenario.replacement.map(name => commits[name]))
    assert.deepEqual(result.data.files.find(file => file.path === 'reused.txt').commits, scenario.original.map(name => commits[name]))
    assert.deepEqual(result.data.renames.map(rename => rename.canonicalPath), ['final.txt', 'reused.txt'])
    assert.deepEqual(result.data.coChangePairs, [{ paths: ['peer.txt', 'reused.txt'], commits: [seed], changeCount: 1 }])
  })
}

test('measure separates a recreated rename source without a deletion commit', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, 'old.txt'), 'Original bytes\n')
  await writeFile(join(repo, 'peer.txt'), 'Peer\n')
  const seed = commit(repo, 'seed')
  git(repo, 'mv', 'old.txt', 'middle.txt')
  const originalRename = commit(repo, 'rename original')
  await writeFile(join(repo, 'old.txt'), 'Replacement bytes\n')
  const addition = commit(repo, 'add replacement')
  git(repo, 'mv', 'old.txt', 'final.txt')
  const replacementRename = commit(repo, 'rename replacement')
  const result = run('measure', repo, process.env, ['--range', 'HEAD'])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files.find(file => file.path === 'final.txt').commits, [replacementRename, addition])
  assert.deepEqual(result.data.files.find(file => file.path === 'middle.txt').commits, [originalRename, seed])
  assert.deepEqual(result.data.renames.map(rename => rename.canonicalPath), ['final.txt', 'middle.txt'])
  assert.deepEqual(result.data.coChangePairs, [{ paths: ['middle.txt', 'peer.txt'], commits: [seed], changeCount: 1 }])
})

for (const scenario of [
  { head: 'renamed', merge: 'modified', formatting: [], supporting: ['merged', 'modified', 'renamed', 'seed'], pairs: ['merged', 'modified', 'seed'] },
  { head: 'modified', merge: 'renamed', formatting: [], supporting: ['merged', 'modified', 'renamed', 'seed'], pairs: ['modified', 'seed'] },
  { head: 'renamed', merge: 'modified', formatting: ['renamed'], supporting: ['merged', 'modified', 'seed'], pairs: ['merged', 'modified', 'seed'] }
]) {
  test(`measure follows merged branch modifications with ${scenario.head} first and exclusions ${scenario.formatting}`, async t => {
    const { directory, repo } = await emptyRepo(t)
    await writeFile(join(repo, 'a.txt'), 'Original\n')
    await writeFile(join(repo, 'peer.txt'), 'Peer\n')
    const seed = commit(repo, 'seed', '2026-01-01T00:00:00Z')
    git(repo, 'checkout', '-qb', 'renamed')
    git(repo, 'mv', 'a.txt', 'b.txt')
    const renamed = commit(repo, 'rename on main', '2026-01-02T00:00:00Z')
    git(repo, 'checkout', '-qb', 'modified', seed)
    await appendFile(join(repo, 'a.txt'), 'Branch change\n')
    await appendFile(join(repo, 'peer.txt'), 'Branch change\n')
    const modified = commit(repo, 'modify on side', '2026-01-03T00:00:00Z')
    git(repo, 'checkout', '-q', scenario.head)
    git(repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'merge', '--no-ff', '-qm', 'merge side', scenario.merge)
    const merged = git(repo, 'rev-parse', 'HEAD')
    const commits = { seed, renamed, modified, merged }
    const policy = join(directory, 'exclusions.json')
    await writeFile(policy, JSON.stringify({ schemaVersion: 1, generatedPaths: [], formattingCommits: scenario.formatting.map(name => commits[name]) }))
    const result = run('measure', repo, process.env, ['--range', 'HEAD', '--exclusions', policy])
    assert.equal(result.exit, 0)
    assert.deepEqual(result.data.files.map(file => file.path), ['b.txt', 'peer.txt'])
    assert.deepEqual(new Set(result.data.files.find(file => file.path === 'b.txt').commits), new Set(scenario.supporting.map(name => commits[name])))
    assert.deepEqual(new Set(result.data.coChangePairs.find(pair => pair.paths.join(',') === 'b.txt,peer.txt').commits), new Set(scenario.pairs.map(name => commits[name])))
  })
}

test('measure preserves both retained rename descendants without pairing one historical path', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, 'a.txt'), 'Original\n')
  const seed = commit(repo, 'seed')
  git(repo, 'checkout', '-qb', 'left')
  git(repo, 'mv', 'a.txt', 'b.txt')
  const left = commit(repo, 'rename left')
  git(repo, 'checkout', '-qb', 'right', seed)
  git(repo, 'mv', 'a.txt', 'c.txt')
  const right = commit(repo, 'rename right')
  git(repo, 'checkout', '-q', 'left')
  const merge = spawnSync('git', ['-C', repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'merge', '--no-ff', '--no-commit', 'right'], { encoding: 'utf8' })
  assert.equal(merge.status, 1)
  const merged = commit(repo, 'retain both names')
  const result = run('measure', repo, process.env, ['--range', 'HEAD'])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files.map(file => file.path), ['b.txt', 'c.txt'])
  assert.deepEqual(new Set(result.data.files.find(file => file.path === 'b.txt').commits), new Set([left, seed]))
  assert.deepEqual(new Set(result.data.files.find(file => file.path === 'c.txt').commits), new Set([merged, right, seed]))
  assert.deepEqual(result.data.coChangePairs, [])
})

test('measure excludes gitlinks removed before the selected head', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, 'peer.txt'), 'Peer\n')
  const seed = commit(repo, 'seed')
  git(repo, 'update-index', '--add', '--cacheinfo', `160000,${seed},dependency`)
  const added = commitIndex(repo, 'add gitlink')
  git(repo, 'update-index', '--cacheinfo', `160000,${added},dependency`)
  await appendFile(join(repo, 'peer.txt'), 'Changed\n')
  git(repo, 'add', 'peer.txt')
  const updated = commitIndex(repo, 'update gitlink and peer')
  git(repo, 'rm', '--cached', 'dependency')
  commitIndex(repo, 'remove gitlink')
  const result = run('measure', repo, process.env, ['--range', 'HEAD'])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files.map(file => file.path), ['peer.txt'])
  assert.deepEqual(result.data.files[0].commits, [updated, seed])
  assert.deepEqual(result.data.coChangePairs, [])
  assert.deepEqual(result.data.exclusions.files, [{ path: 'dependency', reason: 'non-blob' }])
})

test('measure excludes gitlink type changes without losing separate blob lifetimes', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, 'dependency'), 'Original blob\n')
  await writeFile(join(repo, 'peer.txt'), 'Peer\n')
  const seed = commit(repo, 'seed blobs')
  git(repo, 'update-index', '--cacheinfo', `160000,${seed},dependency`)
  commitIndex(repo, 'replace blob with gitlink')
  git(repo, 'rm', '--cached', 'dependency')
  await writeFile(join(repo, 'dependency'), 'Replacement blob\n')
  commit(repo, 'replace gitlink with blob')
  git(repo, 'mv', 'dependency', 'final.txt')
  const renamed = commit(repo, 'rename replacement blob')
  const result = run('measure', repo, process.env, ['--range', 'HEAD'])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files.find(file => file.path === 'final.txt').commits, [renamed])
  assert.deepEqual(result.data.files.find(file => file.path === 'dependency').commits, [seed])
  assert.deepEqual(result.data.coChangePairs, [{ paths: ['dependency', 'peer.txt'], commits: [seed], changeCount: 1 }])
  assert.deepEqual(result.data.exclusions.files, [{ path: 'dependency', reason: 'non-blob' }])
})

test('measure reads head inventory and history larger than one MiB', async t => {
  const { repo } = await emptyRepo(t)
  await mkdir(join(repo, 'dist'))
  await Promise.all(Array.from({ length: 4400 }, (_, index) => writeFile(join(repo, 'dist', `${String(index).padStart(4, '0')}-${'x'.repeat(230)}.txt`), 'Generated\n')))
  commit(repo, 'generated inventory')
  const result = run('measure', repo, process.env, ['--range', 'HEAD'])
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.files, [])
  assert.deepEqual(result.data.coChangePairs, [])
  assert.equal(result.data.exclusions.files.length, 4400)
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
