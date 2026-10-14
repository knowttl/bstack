import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Test the command in a disposable checkout, including paths with spaces and Unicode.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const registry = `export const commands = {
  alpha: { module: './commands/alpha.mjs', options: [], help: 'Report the shared schema.\\nUsage: {entry} alpha --json' },
  beta: { module: './commands/beta.mjs', options: [], help: 'Report beta.\\nUsage: {entry} beta --json' }
}
`
const skills = {
  one: { commands: ['alpha'], schemas: ['plan.json'], assets: [] },
  two: { commands: ['alpha', 'beta'], schemas: ['plan.json'], assets: ['pic.txt'] }
}

async function sandbox(t, files = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack skills é '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts/lib'), { recursive: true })
  for (const file of ['scripts/generate-skills.mjs', 'scripts/lib/bundle.mjs']) await cp(join(root, file), join(directory, file))
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  const runtime = {
    'scripts/commands.mjs': registry,
    'scripts/commands/alpha.mjs': "import { readFile } from 'node:fs/promises'\nexport async function run() { return { data: { schema: await readFile(new URL('../../schemas/plan.json', import.meta.url), 'utf8') } } }\n",
    'scripts/commands/beta.mjs': "export async function run() { return { data: { beta: true } } }\n",
    'schemas/plan.json': '{"title":"plan"}\n',
    'assets/pic.txt': 'picture\n',
    'skills.json': JSON.stringify(skills),
    ...files
  }
  for (const file of ['scripts/dispatch.mjs', 'scripts/lib/args.mjs', 'scripts/lib/result.mjs']) {
    await mkdir(dirname(join(directory, 'runtime', file)), { recursive: true })
    await cp(join(root, 'runtime', file), join(directory, 'runtime', file))
  }
  for (const [file, text] of Object.entries(runtime)) {
    await mkdir(dirname(join(directory, 'runtime', file)), { recursive: true })
    await writeFile(join(directory, 'runtime', file), text)
  }
  return directory
}

function generate(directory, ...args) {
  return spawnSync(process.execPath, [join(directory, 'scripts', 'generate-skills.mjs'), ...args], { encoding: 'utf8', cwd: tmpdir() })
}

function entry(directory, skill, ...args) {
  return spawnSync(process.execPath, [join(directory, 'skills', skill, 'scripts', `${skill}.mjs`), ...args], { encoding: 'utf8', cwd: tmpdir() })
}

test('a generated skill folder runs its commands from wherever it is installed', async t => {
  const directory = await sandbox(t)
  assert.equal(generate(directory).status, 0)
  const installed = join(directory, 'elsewhere')
  await mkdir(installed)
  await rename(join(directory, 'skills/two'), join(installed, 'two'))
  const result = spawnSync(process.execPath, [join(installed, 'two/scripts/two.mjs'), 'alpha', '--repo', directory, '--json'], { encoding: 'utf8', cwd: tmpdir() })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).data.schema, '{"title":"plan"}\n')
  assert.equal(await readFile(join(installed, 'two/assets/pic.txt'), 'utf8'), 'picture\n')
})

test('a skill ships only its own commands', async t => {
  const directory = await sandbox(t)
  assert.equal(generate(directory).status, 0)
  assert.equal(entry(directory, 'two', 'beta', '--repo', directory, '--json').status, 0)
  const missing = entry(directory, 'one', 'beta', '--repo', directory, '--json')
  assert.equal(missing.status, 3)
  assert.match(missing.stdout, /Unknown or not implemented yet: beta/)
})

test('help names the skill entry file', async t => {
  const directory = await sandbox(t)
  assert.equal(generate(directory).status, 0)
  assert.match(entry(directory, 'one', 'alpha', '--help').stdout, /Usage: one\.mjs alpha --json/)
  assert.match(entry(directory, 'two', '--help').stdout, /node skills\/two\/scripts\/two\.mjs <command>[\s\S]*alpha\n {2}beta/)
})

test('check passes after generation and writes nothing', async t => {
  const directory = await sandbox(t)
  assert.equal(generate(directory, '--check').status, 1)
  assert.equal(await readdir(join(directory, 'skills')).catch(error => error.code), 'ENOENT')
  assert.equal(generate(directory).status, 0)
  const checked = generate(directory, '--check')
  assert.equal(checked.status, 0, checked.stderr)
  assert.match(checked.stdout, /Checked 5 files in 2 skills/)
})

for (const [name, mutate, message] of [
  ['edited entry file', directory => writeFile(join(directory, 'skills/one/scripts/one.mjs'), 'local edit'), /skills\/one\/scripts\/one\.mjs is stale/],
  ['removed schema copy', directory => rm(join(directory, 'skills/two/schemas/plan.json')), /skills\/two\/schemas\/plan\.json is missing/],
  ['edited asset copy', directory => writeFile(join(directory, 'skills/two/assets/pic.txt'), 'local edit'), /skills\/two\/assets\/pic\.txt is stale/],
  ['leftover schema', directory => writeFile(join(directory, 'skills/one/schemas/old.json'), '{}'), /skills\/one\/schemas\/old\.json is not listed for one/],
  ['leftover asset', directory => writeFile(join(directory, 'skills/two/assets/old.txt'), 'old'), /skills\/two\/assets\/old\.txt is not listed for two/]
]) {
  test(`check fails for ${name} and a regeneration repairs it`, async t => {
    const directory = await sandbox(t)
    assert.equal(generate(directory).status, 0)
    await mutate(directory)
    const result = generate(directory, '--check')
    assert.equal(result.status, 1)
    assert.match(result.stderr, message)
    assert.equal(generate(directory).status, 0)
    assert.equal(generate(directory, '--check').status, 0)
  })
}

test('editing one command makes only the skills that ship it stale', async t => {
  const directory = await sandbox(t)
  assert.equal(generate(directory).status, 0)
  await writeFile(join(directory, 'runtime/scripts/commands/beta.mjs'), 'export async function run() { return { data: { beta: false } } }\n')
  const result = generate(directory, '--check')
  assert.match(result.stderr, /skills\/two\/scripts\/two\.mjs is stale/)
  assert.doesNotMatch(result.stderr, /skills\/one\//)
})

for (const [name, files, message] of [
  ['a command the registry lacks', { 'skills.json': JSON.stringify({ one: { ...skills.one, commands: ['gamma'] } }) }, /one lists commands missing from runtime\/scripts\/commands\.mjs: gamma/],
  ['a schema runtime lacks', { 'skills.json': JSON.stringify({ one: { ...skills.one, schemas: ['gone.json'] } }) }, /one lists schemas\/gone\.json, which is missing from runtime\/schemas/],
  ['an import outside runtime', { 'scripts/commands/beta.mjs': "import * as yaml from 'yaml'\nexport async function run() { return { data: { exports: Object.keys(yaml).length } } }\n" }, /two bundles files outside runtime\/: .*yaml/],
  ['a resource URL in another shape', { 'scripts/commands/beta.mjs': "export async function run() { return { data: { here: import.meta.url } } }\n" }, /runtime\/scripts\/commands\/beta\.mjs must use import\.meta only as new URL/]
]) {
  for (const args of [[], ['--check']]) {
    test(`${args.length ? 'check' : 'generation'} refuses ${name} before writing`, async t => {
      const directory = await sandbox(t, files)
      const result = generate(directory, ...args)
      assert.equal(result.status, 1)
      assert.match(result.stderr, message)
      assert.equal(await readdir(join(directory, 'skills')).catch(error => error.code), 'ENOENT')
    })
  }
}

test('committed skill files match the shared runtime source', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'generate-skills.mjs'), '--check'], { encoding: 'utf8', cwd: tmpdir() })
  assert.equal(result.status, 0, result.stderr)
})
