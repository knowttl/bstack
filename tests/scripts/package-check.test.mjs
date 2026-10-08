import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  ['host-metadata', 'host-metadata']
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
