import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { emptyRepo, git } from './discovery-fixture.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const full = ['CHECK ', 'TEST --capture .cache/full-suite.json']
const registry = JSON.parse(await readFile(join(root, 'tests/tasks.json'), 'utf8'))

async function put(repo, path, contents) {
  await mkdir(dirname(join(repo, path)), { recursive: true })
  await writeFile(join(repo, path), contents)
}

// The npm process is the gate's external boundary; realRunner exercises the maintained runner as well.
async function fixture(t, { remote = true, realRunner = false } = {}) {
  const { repo } = await emptyRepo(t)
  for (const path of ['scripts/gate-test.mjs', 'scripts/test.mjs', 'tests/tasks.json', 'tests/affected.json', 'runtime']) {
    await mkdir(dirname(join(repo, path)), { recursive: true })
    await cp(join(root, path), join(repo, path), { recursive: true })
  }
  await put(repo, 'record.mjs', "console.log(process.argv[2].toUpperCase(), process.argv.slice(3).join(' '))\n")
  await put(repo, 'package.json', JSON.stringify({ type: 'module', scripts: {
    check: 'node record.mjs check', test: realRunner ? 'node scripts/test.mjs' : 'node record.mjs test'
  } }))
  await put(repo, 'README.md', 'Usage\n')
  await put(repo, 'skills/architecture/SKILL.md', '# Architecture\n')
  await put(repo, 'runtime/scripts/commands/measure.mjs', 'console.log(2 + 2)\n')
  await put(repo, 'runtime/scripts/commands/contract.mjs', 'export const version = 1\n')
  await put(repo, 'runtime/scripts/commands/docs-check.mjs', "import { version } from './contract.mjs'\nconsole.log(version)\n")
  await mkdir(join(repo, 'tests/package-check'), { recursive: true })
  for (const path of new Set(Object.values(registry).flat())) {
    const name = path.split('/').at(-1).replace('.test.mjs', '')
    const command = { measure: ['measure', '4'], 'docs-check': ['docs-check', '1'] }[name]
    await put(repo, path, command ?
      `import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { execFileSync } from 'node:child_process'\ntest('${name} public result', () => assert.equal(execFileSync(process.execPath, ['runtime/scripts/commands/${command[0]}.mjs'], { encoding: 'utf8' }).trim(), '${command[1]}'))\n` :
      `import test from 'node:test'\ntest('${name} fixture', () => console.log('SUITE ${name}'))\n`)
  }
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base')
  if (remote) git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  return repo
}

function gate(repo) {
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return spawnSync(process.execPath, [join(repo, 'scripts/gate-test.mjs')], { cwd: tmpdir(), encoding: 'utf8', env, maxBuffer: 8 * 1024 * 1024 })
}

function records(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout.split('\n').filter(line => /^(CHECK|TEST)/.test(line))
}

for (const [path, reason] of [
  ['scripts/test.mjs', 'shared infrastructure'], ['scripts/gate-test.mjs', 'shared infrastructure'],
  ['tests/affected.json', 'shared infrastructure'], ['tests/tasks.json', 'shared infrastructure'],
  ['scripts/generate-skills.mjs', 'shared infrastructure'], ['scripts/lib/evaluation.mjs', 'shared infrastructure'],
  ['scripts/generate-checker.mjs', 'shared infrastructure'], ['scripts/lib/release-evidence.mjs', 'shared infrastructure'],
  ['tests/eval/scenarios/new.json', 'shared infrastructure'], ['tests/scripts/discovery-fixture.mjs', 'shared infrastructure'],
  ['runtime/scripts/lib/result.mjs', 'shared infrastructure'], ['runtime/skills.json', 'shared infrastructure'],
  ['runtime/schemas/findings.schema.json', 'shared infrastructure'],
  ['tests/fixtures/example/new.mjs', 'shared infrastructure'], ['package.json', 'shared infrastructure'],
  ['package-lock.json', 'shared infrastructure'], ['.no-mistakes.yaml', 'shared infrastructure'],
  ['install/package-lock.json', 'shared infrastructure'],
  ['unknown.txt', 'unmapped path'], ['skills/architecture/scripts/architecture.mjs', 'unmatched generated artifact'],
  ['skills/architecture/schemas/measure-exclusions.json', 'unmatched generated artifact']
]) {
  test(`${path} falls back to the full offline gate`, async t => {
    const repo = await fixture(t)
    const original = await readFile(join(repo, path), 'utf8').catch(() => '')
    // Keep changed configuration valid so selection, rather than parse failure, exercises fallback.
    await put(repo, path, original + '\n')
    const result = gate(repo)
    assert.deepEqual(records(result), full)
    assert.match(result.stdout, new RegExp(reason))
  })
}

test('an empty diff runs the full gate', async t => {
  const result = gate(await fixture(t))
  assert.deepEqual(records(result), full)
  assert.match(result.stdout, /empty diff/)
})

test('an unresolved base runs the full gate', async t => {
  const result = gate(await fixture(t, { remote: false }))
  assert.deepEqual(records(result), full)
  assert.match(result.stdout, /Base: unresolved/)
})

for (const state of ['committed', 'staged', 'unstaged', 'untracked', 'renamed', 'deleted', 'staged then restored']) {
  test(`${state} paths participate in selection`, async t => {
    const repo = await fixture(t)
    const path = 'skills/architecture/SKILL.md'
    if (state === 'deleted') await rm(join(repo, path))
    else if (state === 'renamed') {
      await mkdir(join(repo, 'skills/architecture/references'), { recursive: true })
      await rename(join(repo, path), join(repo, 'skills/architecture/references/renamed.md'))
    }
    else await put(repo, state === 'untracked' ? 'skills/architecture/references/new.md' : path, '# Changed\n')
    if (['committed', 'staged', 'renamed', 'staged then restored'].includes(state)) git(repo, 'add', '.')
    if (state === 'staged then restored') await put(repo, path, '# Architecture\n')
    if (state === 'committed') git(repo, '-c', 'user.name=Fixture Author', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'change')
    const result = gate(repo)
    assert.deepEqual(records(result), ['CHECK ', 'TEST --task T3.1 --task architecture'])
    assert.match(result.stdout, /Base: [a-f0-9]{40}/)
    assert.match(result.stdout, /Paths: .*skills\/architecture\//)
    if (state === 'renamed') {
      assert.match(result.stdout, /Paths: .*references\/renamed.md/)
      assert.match(result.stdout, /Paths: .*SKILL.md/)
    }
  })
}

test('a generated bundle follows its authored command and does not add unrelated installer tests', async t => {
  const repo = await fixture(t)
  await put(repo, 'runtime/scripts/commands/measure.mjs', 'console.log(4)\n')
  await put(repo, 'skills/architecture/scripts/architecture.mjs', '// generated consequence\n')
  assert.deepEqual(records(gate(repo)), ['CHECK ', 'TEST --task T2.4 --task T3.1 --task architecture'])
})

test('a generated reference follows its authored shared reference', async t => {
  const repo = await fixture(t)
  await put(repo, 'runtime/references/mechanics.md', '# Mechanics\n')
  await put(repo, 'skills/how/references/mechanics.md', '# Mechanics\n')
  assert.deepEqual(records(gate(repo)), ['CHECK ', 'TEST --task T2.14 --task T3.1'])
})

test('an owned schema selects its protocol users', async t => {
  const repo = await fixture(t)
  await put(repo, 'runtime/schemas/measure-exclusions.json', '{}\n')
  await put(repo, 'skills/architecture/schemas/measure-exclusions.json', '{}\n')
  assert.deepEqual(records(gate(repo)), ['CHECK ', 'TEST --task T2.4 --task T3.1 --task architecture'])
})

test('installer task aliases form one runner invocation', async t => {
  const repo = await fixture(t)
  await put(repo, 'install/install.mjs', '// change\n')
  const result = gate(repo)
  assert.deepEqual(records(result), ['CHECK ', 'TEST --task C25a --task C25b --task C25c --task T0.4 --task T0.5 --task T1.2 --task T3.1'])
})

test('a missing registered task forces full validation', async t => {
  const repo = await fixture(t)
  const tasks = { ...registry }
  delete tasks.architecture
  await put(repo, 'tests/tasks.json', JSON.stringify(tasks))
  const result = gate(repo)
  assert.deepEqual(records(result), full)
  assert.match(result.stdout, /incomplete task map: architecture/)
})

test('a missing dependency declaration forces full validation', async t => {
  const repo = await fixture(t)
  await put(repo, 'runtime/scripts/commands/measure.mjs', "import './overlap.mjs'\n")
  const result = gate(repo)
  assert.deepEqual(records(result), full)
  assert.match(result.stdout, /undeclared dependency: overlap -> measure/)
})

test('an unregistered discovered suite forces full validation', async t => {
  const repo = await fixture(t)
  await put(repo, 'tests/scripts/new.test.mjs', '// new suite\n')
  const result = gate(repo)
  assert.deepEqual(records(result), full)
  assert.match(result.stdout, /unregistered suite/)
})

test('selected module proof has a clean control and propagates an independently seeded failure', async t => {
  const repo = await fixture(t, { realRunner: true })
  await put(repo, 'runtime/scripts/commands/measure.mjs', 'console.log(4)\n')
  const clean = gate(repo)
  assert.equal(clean.status, 0, clean.stdout + clean.stderr)
  assert.match(clean.stdout, /measure public result/)
  assert.match(clean.stdout, /# tests 5\n/)
  await put(repo, 'runtime/scripts/commands/measure.mjs', 'console.log(5)\n')
  const broken = gate(repo)
  assert.equal(broken.status, 1, broken.stdout + broken.stderr)
  assert.match(broken.stdout, /not ok .*measure public result/)
})

test('a changed protocol selects the dependent public-command test and propagates its failure', async t => {
  const repo = await fixture(t, { realRunner: true })
  await put(repo, 'runtime/scripts/commands/contract.mjs', 'export const version = 1 // compatible\n')
  const clean = gate(repo)
  assert.equal(clean.status, 0, clean.stdout + clean.stderr)
  assert.match(clean.stdout, /docs-check public result/)
  await put(repo, 'runtime/scripts/commands/contract.mjs', 'export const version = 2\n')
  const broken = gate(repo)
  assert.equal(broken.status, 1, broken.stdout + broken.stderr)
  assert.match(broken.stdout, /Modules: .*docs-check/)
  assert.match(broken.stdout, /not ok .*docs-check public result/)
})

test('a failed package check prevents test execution', async t => {
  const repo = await fixture(t)
  await put(repo, 'package.json', JSON.stringify({ type: 'module', scripts: {
    check: 'node -e "process.exit(7)"', test: 'node record.mjs test'
  } }))
  const result = gate(repo)
  assert.equal(result.status, 7)
  assert.doesNotMatch(result.stdout, /^TEST/m)
})
