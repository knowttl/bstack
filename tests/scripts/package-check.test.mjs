import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Execute the public checker from any test working directory.
const checker = fileURLToPath(new URL('../../scripts/check-package.mjs', import.meta.url))
// Seed folders are data, never test-discovery roots.
const fixtures = fileURLToPath(new URL('../package-check/', import.meta.url))

function run(...args) {
  return spawnSync(process.execPath, [checker, ...args], { encoding: 'utf8', cwd: tmpdir() })
}

test('valid skeleton passes from another working directory', () => {
  assert.equal(run().status, 0)
  const result = run('--skill', join(fixtures, 'valid'))
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /check-package: passed/)
})

for (const [folder, code] of [
  ['missing-path', 'local-path-missing'],
  ['unlisted-reference', 'reference-unlisted'],
  ['nested-reference', 'reference-nested'],
  ['oversized-skill', 'skill-too-long'],
  ['long-reference', 'reference-toc'],
  ['host-metadata', 'host-metadata'],
  ['undeclared-import', 'script-import'],
  ['unexplained-constant', 'constant-comment'],
  ['unfinished-step', 'step-done'],
  ['language-policy', 'language-policy']
]) {
  test(`${folder} fails with ${code}`, () => {
    const result = run('--skill', join(fixtures, folder))
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, new RegExp(`^${code}:`, 'm'))
  })
}

async function sandbox(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack package ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await cp(join(fixtures, 'valid'), directory, { recursive: true })
  return directory
}

test('every independent problem is reported together', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'other.md'), '[Missing](absent.md)\n')
  await writeFile(join(directory, 'agents', 'openai.yaml'), 'policy:\n  allow_implicit_invocation: true\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  for (const code of ['reference-unlisted', 'local-path-missing', 'host-metadata']) assert.match(result.stdout, new RegExp(`^${code}:`, 'm'))
})

test('line limits include their boundary and exclude frontmatter', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'SKILL.md'), '---\r\ndisable-model-invocation: true\r\n---\r\n## Load when\r\n| When | Open |\r\n|---|---|\r\n| Needed | `references/guide.md` |\r\n' + 'Text.\r\n'.repeat(496))
  await writeFile(join(directory, 'references', 'guide.md'), '# Guide\n' + 'Text.\n'.repeat(99))
  assert.equal(run('--skill', directory).status, 0)
})

test('contents heading at line twenty permits a long reference', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'guide.md'), 'Text.\n'.repeat(19) + '## Table of contents\n' + 'Text.\n'.repeat(81))
  assert.equal(run('--skill', directory).status, 0)
  await writeFile(join(directory, 'references', 'guide.md'), 'Text.\n'.repeat(20) + '## Table of contents\n' + 'Text.\n'.repeat(80))
  assert.match(run('--skill', directory).stdout, /reference-toc:/)
})

test('local paths in source and nested resources resolve from their file', async t => {
  const directory = await sandbox(t)
  await mkdir(join(directory, 'scripts'))
  await writeFile(join(directory, 'scripts', 'example.mjs'), "import './absent.mjs'\n")
  assert.match(run('--skill', directory).stdout, /local-path-missing:.*absent.mjs/)
  await writeFile(join(directory, 'scripts', 'absent.mjs'), '// Exists.\n')
  await writeFile(join(directory, 'references', 'guide.md'), '[Policy](../agents/openai.yaml)\n[Web](https://example.invalid/no-file)\n[Section](#here)\n')
  assert.equal(run('--skill', directory).status, 0)
})

for (const [syntax, destination] of [
  ['inline link', '[Target](absent.md:12)'],
  ['image', '![Target](absent.md:12:3)'],
  ['reference definition', '[Target]: absent.md:12?view=source#here'],
  ['angle destination', '[Target](<absent.md:12:3#here>)'],
  ['encoded destination', '[Target](absent.md:%31%32%3A3)'],
  ['quoted resource', '`./absent.md:12`']
]) {
  test(`${syntax} location suffix preserves missing and nested reference checks`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'references', 'guide.md'), destination + '\n')
    const result = run('--skill', directory)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, /local-path-missing:.*references\/guide\.md:.*absent\.md/)
    assert.match(result.stdout, /reference-nested:.*references\/guide\.md:.*absent\.md/)
  })
}

test('location suffix accepts existing resources and excludes URLs', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'guide.md'), '[Policy](../agents/openai.yaml:12:3?view=source#here)\n[Web](https://example.invalid/no-file:12)\n[Mail](mailto:user@example.invalid)\n[Numeric URI](tel:123)\n[Network](//example.invalid/no-file:12)\n[Section](#here:12)\n')
  assert.equal(run('--skill', directory).status, 0)
})

test('unlisted reference diagnostics identify each source file', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'one.md'), 'First reference.\n')
  await writeFile(join(directory, 'references', 'two.md'), 'Second reference.\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /^reference-unlisted: references\/one\.md:/m)
  assert.match(result.stdout, /^reference-unlisted: references\/two\.md:/m)
})

test('dependency and cache contents are excluded', async t => {
  const directory = await sandbox(t)
  for (const folder of ['node_modules', '.cache', 'scratch']) {
    await mkdir(join(directory, folder))
    await writeFile(join(directory, folder, 'bad.md'), '[Missing](absent.md)\n')
  }
  assert.equal(run('--skill', directory).status, 0)
})

test('help and invalid arguments have explicit exits', () => {
  assert.equal(run('--help').status, 0)
  for (const args of [['--skill'], ['--unknown'], ['--skill', fixtures, '--skill', fixtures]]) {
    const result = run(...args)
    assert.equal(result.status, 3)
    assert.match(result.stdout, /invalid-arguments:/)
  }
  const missing = run('--skill', join(fixtures, 'absent'))
  assert.equal(missing.status, 1)
  assert.match(missing.stdout, /package-unreadable:/)
})

test('imports accept built-ins, local files and declared runtime package subpaths', async t => {
  const directory = await sandbox(t)
  await mkdir(join(directory, 'scripts'))
  await writeFile(join(directory, 'package.json'), JSON.stringify({ dependencies: { '@scope/runtime': '1.0.0' }, optionalDependencies: { optional: '1.0.0' } }))
  await writeFile(join(directory, 'scripts', 'local.mjs'), 'export default 1\n')
  await writeFile(join(directory, 'scripts', 'example.mjs'), "import 'fs'\nimport 'node:test'\nimport './local.mjs'\nexport { default } from '@scope/runtime/subpath'\nawait import('optional/subpath')\n")
  assert.equal(run('--skill', directory).status, 0)
})

for (const source of ["import 'undeclared'", "export * from 'undeclared'", "await import('undeclared')", "require('undeclared')", "import 'node:not-a-builtin'", "import 'dev-only'"]) {
  test(`import policy refuses ${source}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'package.json'), JSON.stringify({ devDependencies: { 'dev-only': '1.0.0' } }))
    await writeFile(join(directory, 'example.mjs'), source + '\n')
    const result = run('--skill', directory)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /script-import: example.mjs:.*line 1/)
  })
}

test('strings, comments, regexes and nested constants do not impersonate script policy', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'example.mjs'), "// Explain the text fixture.\nconst text = `import 'undeclared'; const fake = 1`\n/* import 'undeclared'; const fake = 1 */\n// Explain the regular expression.\nconst pattern = /const fake = 1/\nfunction example() { const nested = 1; return nested }\n")
  assert.equal(run('--skill', directory).status, 0)
})

test('computed dispatch imports remain outside the literal import control', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'example.mjs'), 'await import(selectedCommand)\n')
  assert.equal(run('--skill', directory).status, 0)
})

for (const [source, expected] of [
  ['// Reason.\nexport const { first, second } = values\n', 0],
  ['/* Reason. */\r\nconst first = 1, second = 2\r\n', 0],
  ['/* Multi-line\nreason. */\nconst first = 1\n', 0],
  ['// Too far away.\n\nconst first = 1\n', 1],
  ['export const first = 1 // Too late.\n', 1],
  ['if (true) { const nested = 1 }\n', 0]
]) {
  test(`constant comment boundary ${JSON.stringify(source)}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'example.mjs'), source)
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout)
    if (expected) assert.match(result.stdout, /constant-comment:/)
  })
}

test('invalid script and manifest refuse unverified imports while other problems collect', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'package.json'), '{')
  await writeFile(join(directory, 'example.mjs'), 'const =\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /script-syntax:/)
  assert.match(result.stdout, /package-manifest:/)
})

for (const [section, expected] of [
  ['### Step 1: Inspect\n\nDone when: inspected.\n', 0],
  ['### Step 1: Inspect\n\n```text\nDone when: example only.\n```\n', 1],
  ['### Step 1: Inspect\n\n#### Details\n\nDone when: too late.\n', 1],
  ['```text\n### Step 1: Example\n```\n', 0],
  ['### Step 1: Inspect\n\nDone when: inspected.\n\n### Step 2: Apply\n', 1]
]) {
  test(`step completion boundary ${JSON.stringify(section)}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'SKILL.md'), await readFile(join(fixtures, 'valid', 'SKILL.md'), 'utf8') + '\n' + section)
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout)
    if (expected) assert.match(result.stdout, /step-done:/)
  })
}

for (const [file, text, expected] of [
  ['references/guide.md', '- ESLint\n- Ruff\n', 1],
  ['package.json', '{"dependencies":{"eslint-config-project":"1.0.0"}}\n', 1],
  ['.ruff.toml', '', 1],
  ['references/guide.md', 'Research project tooling. A truffle is unrelated.\n', 0]
]) {
  test(`language policy boundary ${file} ${JSON.stringify(text)}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, file), text)
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout)
    if (expected) assert.match(result.stdout, /language-policy:/)
  })
}
