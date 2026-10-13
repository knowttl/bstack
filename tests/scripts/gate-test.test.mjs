import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const full = ['TEST --capture .cache/full-suite.json']
const markdownOnly = ['CHECK ', 'TEST --task T3.1']

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

// A disposable checkout whose npm scripts only report what the gate asked them to run.
async function gate(t, changes, { remote = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack gate é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'))
  await mkdir(join(directory, 'skills/repo-audit/scripts'), { recursive: true })
  await cp(join(root, 'scripts', 'gate-test.mjs'), join(directory, 'scripts', 'gate-test.mjs'))
  await cp(join(root, 'skills/repo-audit/scripts/lib'), join(directory, 'skills/repo-audit/scripts/lib'), { recursive: true })
  await writeFile(join(directory, 'record.mjs'), "console.log(process.argv[2].toUpperCase(), process.argv.slice(3).join(' '))\n")
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module', scripts: { check: 'node record.mjs check', test: 'node record.mjs test' } }))
  await writeFile(join(directory, 'README.md'), 'Usage\n')
  git(directory, 'init', '-q', '-b', 'main')
  git(directory, 'config', 'user.name', 'Fixture Author')
  git(directory, 'config', 'user.email', 'fixture@example.invalid')
  git(directory, 'add', '.')
  git(directory, 'commit', '-q', '-m', 'base')
  if (remote) git(directory, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  git(directory, 'switch', '-q', '-c', 'change')
  for (const [path, content] of Object.entries(changes)) {
    await mkdir(join(directory, path, '..'), { recursive: true })
    await writeFile(join(directory, path), content)
  }
  const result = spawnSync(process.execPath, [join(directory, 'scripts', 'gate-test.mjs')], { cwd: tmpdir(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout.split('\n').filter(line => /^(CHECK|TEST)/.test(line))
}

const cases = [
  ['a README edit', { 'README.md': 'Changed\n' }, markdownOnly],
  ['a new skill reference', { 'skills/repo-audit/references/new.md': '# New\n' }, markdownOnly],
  ['a document under docs', { 'docs/design.md': '# Design\n' }, markdownOnly],
  ['a non-Markdown file under a references folder', { 'skills/repo-audit/references/table.json': '{}\n' }, markdownOnly],
  ['a Markdown file outside the Markdown paths', { 'tests/fixtures/notes.md': '# Notes\n' }, full],
  ['a script', { 'scripts/test.mjs': '// changed\n', 'README.md': 'Changed\n' }, full],
  ['a schema beside Markdown', { 'skills/repo-audit/schemas/plan.json': '{}\n', 'docs/design.md': '# Design\n' }, full],
  ['package.json', { 'package.json': '{"type":"module","scripts":{"check":"node record.mjs check","test":"node record.mjs test"},"private":true}' }, full],
  ['the gate configuration', { '.no-mistakes.yaml': 'no_ci: true\n' }, full]
]

for (const [name, changes, expected] of cases) {
  test(`${name} selects ${expected === full ? 'the full suite' : 'the package check and task'}`, async t => {
    assert.deepEqual(await gate(t, changes), expected)
  })
}

test('an unknown base selects the full suite', async t => {
  assert.deepEqual(await gate(t, { 'README.md': 'Changed\n' }, { remote: false }), full)
})
