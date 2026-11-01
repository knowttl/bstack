import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Test the command in a disposable checkout, including paths with spaces and Unicode.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const readme = '# Demo\n\n<!-- skills-table:start -->\n<!-- skills-table:end -->\n\nFooter\n'

function skill(name: string, description = `Do ${name}.`) {
  return `---\nname: ${name}\ndescription: ${description}\ndisable-model-invocation: true\n---\n\n## Scope\n`
}

async function sandbox(t: import('node:test').TestContext, { text = readme, skills = { beta: skill('beta'), alpha: skill('alpha', 'Do alpha | or beta.') } }: {text?: string; skills?: Record<string, string>} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack readme é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'), { recursive: true })
  await cp(join(root, 'scripts/generate-readme.ts'), join(directory, 'scripts/generate-readme.ts'))
  await writeFile(join(directory, 'README.md'), text)
  for (const [name, document] of Object.entries(skills)) {
    await mkdir(join(directory, 'skills', name), { recursive: true })
    await writeFile(join(directory, 'skills', name, 'SKILL.md'), document)
  }
  return directory
}

function generate(directory: string, ...args: readonly string[]) {
  return spawnSync(process.execPath, [join(directory, 'scripts', 'generate-readme.ts'), ...args], { encoding: 'utf8', cwd: tmpdir() })
}

test('generation lists every skill folder alphabetically between the markers and keeps the rest', async t => {
  const directory = await sandbox(t)
  assert.equal(generate(directory).status, 0)
  assert.equal(await readFile(join(directory, 'README.md'), 'utf8'), [
    '# Demo', '', '<!-- skills-table:start -->', '| Skill | What it does |', '|---|---|',
    '| [`alpha`](skills/alpha/SKILL.md) | Do alpha \\| or beta. |', '| [`beta`](skills/beta/SKILL.md) | Do beta. |',
    '<!-- skills-table:end -->', '', 'Footer', ''].join('\n'))
})

test('check passes on a generated README and writes nothing when it is stale', async t => {
  const directory = await sandbox(t)
  const stale = generate(directory, '--check')
  assert.equal(stale.status, 1)
  assert.match(stale.stderr, /skills table is stale/)
  assert.equal(await readFile(join(directory, 'README.md'), 'utf8'), readme)
  assert.equal(generate(directory).status, 0)
  assert.equal(generate(directory, '--check').status, 0)
})

for (const [name, mutate] of [
  ['an added skill', (directory: string) => mkdir(join(directory, 'skills/gamma')).then(() => writeFile(join(directory, 'skills/gamma/SKILL.md'), skill('gamma')))],
  ['a changed description', (directory: string) => writeFile(join(directory, 'skills/beta/SKILL.md'), skill('beta', 'Something else.'))],
  ['a removed skill', (directory: string) => rm(join(directory, 'skills/beta'), { recursive: true })],
  ['a hand edit to the table', async (directory: string) => writeFile(join(directory, 'README.md'), (await readFile(join(directory, 'README.md'), 'utf8')).replace('Do beta.', 'Edited.'))]
] satisfies [unknown, unknown][]) {
  test(`check fails for ${name} and a regeneration repairs it`, async t => {
    const directory = await sandbox(t)
    assert.equal(generate(directory).status, 0)
    await mutate(directory)
    assert.equal(generate(directory, '--check').status, 1)
    assert.equal(generate(directory).status, 0)
    assert.equal(generate(directory, '--check').status, 0)
  })
}

for (const [name, options, message] of [
  ['a README without markers', { text: '# Demo\n' }, /must contain <!-- skills-table:start -->/],
  ['markers in the wrong order', { text: '<!-- skills-table:end -->\n<!-- skills-table:start -->\n' }, /must contain <!-- skills-table:start -->/],
  ['a skill whose name differs from its folder', { skills: { alpha: skill('other') } }, /skills\/alpha\/SKILL\.md must declare name: alpha/],
  ['a skill without a description', { skills: { alpha: '---\nname: alpha\n---\n' } }, /skills\/alpha\/SKILL\.md must declare name: alpha/]
] satisfies [unknown, unknown, unknown][]) {
  test(`generation refuses ${name} without changing the README`, async t => {
    const directory = await sandbox(t, options)
    const before = await readFile(join(directory, 'README.md'), 'utf8')
    const result = generate(directory)
    assert.equal(result.status, 1)
    assert.match(result.stderr, message)
    assert.equal(await readFile(join(directory, 'README.md'), 'utf8'), before)
  })
}

test('an unknown argument is a usage error', async t => {
  const result = generate(await sandbox(t), '--write')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Usage: node scripts\/generate-readme\.ts \[--check\]/)
})

test('the committed README skills table matches the skills folder', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'generate-readme.ts'), '--check'], { encoding: 'utf8', cwd: tmpdir() })
  assert.equal(result.status, 0, result.stderr)
})
