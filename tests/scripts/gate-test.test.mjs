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
async function gate(t, changes, { remote = true, realRunner = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack gate é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'))
  await mkdir(join(directory, 'runtime/scripts'), { recursive: true })
  await cp(join(root, 'scripts', 'gate-test.mjs'), join(directory, 'scripts', 'gate-test.mjs'))
  await cp(join(root, 'runtime/scripts/lib'), join(directory, 'runtime/scripts/lib'), { recursive: true })
  await writeFile(join(directory, 'record.mjs'), "console.log(process.argv[2].toUpperCase(), process.argv.slice(3).join(' '))\n")
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module', scripts: { check: 'node record.mjs check', test: 'node record.mjs test' } }))
  await writeFile(join(directory, 'README.md'), 'Usage\n')
  if (realRunner) {
    await cp(join(root, 'scripts/test.mjs'), join(directory, 'scripts/test.mjs'))
    await mkdir(join(directory, 'tests/scripts'), { recursive: true })
    await cp(join(root, 'tests/tasks.json'), join(directory, 'tests/tasks.json'))
    for (const name of ['package-check', 'skill-skeleton', 'eval', 'eval-judge', 'eval-impact', 'release-gate', 'acceptance']) {
      await writeFile(join(directory, 'tests/scripts', `${name}.test.mjs`),
        `import test from 'node:test'\ntest('${name}', () => console.log('SUITE ${name}'))\n`)
    }
    await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module', scripts: { check: 'node record.mjs check', test: 'node scripts/test.mjs' } }))
  }
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
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const result = spawnSync(process.execPath, [join(directory, 'scripts', 'gate-test.mjs')], { cwd: tmpdir(), encoding: 'utf8', env })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout.split('\n').filter(line => /^(CHECK|TEST|# SUITE)/.test(line))
}

const cases = [
  ['a README edit', { 'README.md': 'Changed\n' }, markdownOnly],
  ['a new skill reference', { 'skills/repo-audit/references/new.md': '# New\n' }, markdownOnly],
  ['a document under docs', { 'docs/design.md': '# Design\n' }, markdownOnly],
  ['a skill Markdown file', { 'skills/repo-audit/SKILL.md': '# Skill\n' }, markdownOnly],
  ['a non-Markdown file under a references folder', { 'skills/repo-audit/references/table.json': '{}\n' }, full],
  ['package.json under references', { 'skills/repo-audit/references/package.json': '{}\n' }, full],
  ['a non-Markdown document', { 'docs/table.json': '{}\n' }, full],
  ['a script under references', { 'skills/repo-audit/references/helper.mjs': '// changed\n' }, full],
  ['a non-Markdown skill file', { 'skills/repo-audit/table.json': '{}\n' }, full],
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

test('a Markdown gate executes the documentation and evaluation suites once', async t => {
  const output = await gate(t, { 'README.md': 'Changed\n' }, { realRunner: true })
  assert.deepEqual(output.sort(), ['CHECK ', '# SUITE package-check', '# SUITE skill-skeleton', '# SUITE eval',
    '# SUITE eval-judge', '# SUITE eval-impact', '# SUITE release-gate', '# SUITE acceptance'].sort())
})
