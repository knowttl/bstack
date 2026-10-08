import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build, emptyRepo, git, run, snapshot } from './discovery-fixture.mjs'

test('inspect fingerprints a dirty fixture unchanged including Git index bytes', async t => {
  const repo = build(t, 'dirty-work')
  const before = await snapshot(repo)
  const result = run('inspect', repo)
  assert.equal(result.exit, 0)
  assert.equal(result.data.root, repo)
  assert.equal(result.data.revision, git(repo, 'rev-parse', 'HEAD'))
  assert.ok(result.data.changes.length > 0)
  assert.deepEqual(result.data.prerequisites.map(tool => tool.tool), ['git', 'node'])
  assert.ok(result.data.prerequisites.every(tool => tool.found && tool.version))
  assert.deepEqual(await snapshot(repo), before)
})

test('inspect with git hidden from PATH is blocked with the exact named limitation', async t => {
  const { repo } = await emptyRepo(t)
  const result = run('inspect', repo, { ...process.env, PATH: '' })
  assert.equal(result.exit, 2)
  assert.equal(result.status, 'blocked')
  assert.deepEqual(result.problems, [{ code: 'git-unavailable', message: 'Git could not resolve the target repo.', fix: 'Install Git and select a non-bare Git working tree.', path: repo }])
})

test('inspect reports no commits and literal staged rename and untracked paths', async t => {
  const { repo } = await emptyRepo(t)
  assert.equal(run('inspect', repo).data.revision, 'no commits')
  await writeFile(join(repo, 'old ü & file.txt'), 'Tracked\n')
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'seed')
  git(repo, 'mv', 'old ü & file.txt', 'new ü & file.txt')
  await writeFile(join(repo, 'untracked ü & [notes];.txt'), 'Untracked\n')
  const result = run('inspect', repo)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.changes, [{ status: 'R ', path: 'new ü & file.txt', originalPath: 'old ü & file.txt' }, { status: '??', path: 'untracked ü & [notes];.txt' }])
  git(repo, 'checkout', '--orphan', 'unborn')
  assert.equal(run('inspect', repo).data.revision, 'no commits')
})

test('inspect reads nested manifests and reports missing detected prerequisites', async t => {
  const { repo } = await emptyRepo(t)
  await mkdir(join(repo, 'packages', 'web'), { recursive: true })
  await writeFile(join(repo, 'packages', 'web', 'package.json'), '{"packageManager":"npm@11.13.0"}')
  const result = run('inspect', repo)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.manifests.map(file => file.path), ['packages/web/package.json'])
  assert.ok(result.data.manifests.every(file => /^[a-f0-9]{64}$/.test(file.hash)))
  assert.deepEqual(result.data.prerequisites.map(tool => tool.tool), ['git', 'node', 'npm'])
  // Preserve Git while hiding every other PATH tool for a deterministic missing-tool check.
  const gitPath = git(repo, '--exec-path')
  await writeFile(join(repo, 'uv.lock'), 'version = 1\n')
  const missing = run('inspect', repo, { ...process.env, PATH: gitPath, npm_execpath: '' })
  assert.equal(missing.exit, 2)
  assert.deepEqual(missing.data.manifests.map(file => file.path), ['packages/web/package.json', 'uv.lock'])
  assert.deepEqual(missing.data.prerequisites.map(tool => tool.tool), ['git', 'node', 'npm', 'uv'])
  assert.ok(missing.problems.some(problem => problem.code === 'prerequisite-unavailable' && problem.tool === 'uv'))
})

test('inspect blocks unreadable commit history rather than claiming no commits', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, '.git', 'refs', 'heads', git(repo, 'symbolic-ref', '--short', 'HEAD')), `${'a'.repeat(40)}\n`)
  const result = run('inspect', repo)
  assert.equal(result.exit, 2)
  assert.ok(result.problems.some(problem => problem.code === 'history-unreadable'))
  assert.notEqual(result.data.revision, 'no commits')
})

test('inspect reports malformed manifests as a named limitation', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, 'package.json'), '{')
  const result = run('inspect', repo)
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'manifest-unreadable')
})
