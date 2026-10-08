import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { build, emptyRepo, run, snapshot } from './discovery-fixture.mjs'

test('py-ledger CONTRIBUTING is the standards source without requiring CODING_STANDARDS', t => {
  const repo = build(t, 'py-ledger')
  const result = run('inventory', repo)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.problems, [])
  assert.equal(result.data.files.find(file => file.path === 'CONTRIBUTING.md').kind, 'standards')
  assert.ok(!result.data.absent.includes('standards'))
  assert.ok(result.data.absent.includes('vision'))
})

test('ts-shop import-only CLAUDE stub produces a version-limited merge candidate', t => {
  const repo = build(t, 'ts-shop')
  const result = run('inventory', repo)
  assert.equal(result.exit, 0)
  const candidate = result.data.candidates.find(candidate => candidate.path === 'CLAUDE.md')
  assert.equal(candidate.code, 'merge-claude-instructions')
  assert.equal(candidate.destination, 'AGENTS.md')
  assert.equal(candidate.requiresEquivalentContent, true)
  assert.match(candidate.versionLimit, /v2\.1\.277/)
  assert.match(candidate.versionLimit, /v2\.1\.281/)
  assert.match(candidate.versionLimit, /plugin disabled/)
})

test('inventory preserves root, nested, local and outside-repo instruction scopes without writes', async t => {
  const { directory, repo } = await emptyRepo(t)
  await mkdir(join(repo, 'packages', 'web'), { recursive: true })
  await mkdir(join(repo, '.claude'))
  for (const [path, content] of [['AGENTS.md', 'Root instructions\n'], ['CLAUDE.md', '@AGENTS.md\n'], ['.claude/CLAUDE.md', '@../AGENTS.md\n'], ['packages/web/CLAUDE.md', 'Distinct web guidance\n'], ['CLAUDE.local.md', 'Local guidance\n']]) await writeFile(join(repo, path), content)
  await writeFile(join(directory, 'CLAUDE.md'), 'Outside guidance\n')
  const before = await snapshot(directory)
  const result = run('inventory', repo)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.candidates.map(candidate => candidate.path), ['.claude/CLAUDE.md', 'CLAUDE.md'])
  assert.deepEqual(result.data.files.find(file => file.path === 'packages/web/CLAUDE.md'), {
    path: 'packages/web/CLAUDE.md', hash: createHash('sha256').update('Distinct web guidance\n').digest('hex'), kind: 'instructions',
    directory: 'packages/web', scope: 'packages/web', insideRepo: true, scoped: true, local: false
  })
  assert.ok(result.data.shadowing.some(file => file.path === 'CLAUDE.local.md' && file.insideRepo && !file.modifiable))
  assert.ok(result.data.shadowing.some(file => file.path === join(directory, 'CLAUDE.md') && !file.insideRepo && !file.modifiable))
  assert.deepEqual(await snapshot(directory), before)
})

test('inventory discovers equivalent names and exact-byte hashes and tolerates absent documents', async t => {
  const { repo } = await emptyRepo(t)
  await mkdir(join(repo, 'docs', 'adrs'), { recursive: true })
  const documents = [['docs/product-requirements.md', 'vision'], ['docs/architecture.rst', 'design'], ['docs/domain_vocabulary.txt', 'glossary'], ['docs/context-map.md', 'context-map'], ['docs/review-standards.md', 'standards'], ['docs/adrs/001-choice.md', 'decisions'], ['docs/known-debt.md', 'audit'], ['README.md', 'context']]
  for (const [path] of documents) await writeFile(join(repo, path), `Source: ${path}\r\n`)
  const result = run('inventory', repo)
  assert.equal(result.exit, 0)
  for (const [path, kind] of documents) assert.deepEqual(result.data.files.find(file => file.path === path), { path, kind, hash: createHash('sha256').update(await readFile(join(repo, path))).digest('hex') })
  assert.deepEqual(result.data.absent, ['instructions'])
  assert.deepEqual(result.data.candidates, [])
})

test('a local-only instruction is a shadowing report without a merge candidate', async t => {
  const { repo } = await emptyRepo(t)
  await writeFile(join(repo, 'CLAUDE.local.md'), 'Local-only rules\n')
  const result = run('inventory', repo)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.candidates, [])
  assert.ok(result.data.shadowing.some(file => file.path === 'CLAUDE.local.md' && file.modifiable === false))
})

test('equivalent nested instructions consolidate within their own scope', async t => {
  const { repo } = await emptyRepo(t)
  await mkdir(join(repo, 'web', '.claude'), { recursive: true })
  await writeFile(join(repo, 'web', 'AGENTS.md'), 'Web-specific rules\n')
  await writeFile(join(repo, 'web', '.claude', 'CLAUDE.md'), '@../AGENTS.md\n')
  const result = run('inventory', repo)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.candidates.map(({ path, destination, scope }) => ({ path, destination, scope })), [{ path: 'web/.claude/CLAUDE.md', destination: 'web/AGENTS.md', scope: 'web' }])
})
