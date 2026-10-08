import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { hash } from '../../scripts/lib/test-evidence.mjs'

// Resolve package inputs from the suite location, not the shell working directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function sandbox(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack bootstrap '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'))
  await cp(join(root, 'scripts', 'test.mjs'), join(directory, 'scripts', 'test.mjs'))
  return directory
}

function run(directory, ...args) {
  // The child represents a fresh user invocation, outside the parent test runner.
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return spawnSync(process.execPath, [join(directory, 'scripts', 'test.mjs'), ...args], { encoding: 'utf8', env })
}

test('bootstrap manifest commands and root lockfile agree', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
  assert.equal(manifest.private, true)
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.engines.node, '>=24')
  assert.deepEqual(manifest.scripts, {
    check: 'node scripts/check-package.mjs',
    test: 'node scripts/test.mjs',
    eval: 'node scripts/eval.mjs'
  })
  assert.equal(lock.lockfileVersion, 3)
  assert.equal(lock.name, manifest.name)
  assert.equal(lock.version, manifest.version)
  assert.equal(lock.packages[''].name, manifest.name)
  assert.equal(lock.packages[''].version, manifest.version)
  assert.deepEqual(lock.packages[''].engines, manifest.engines)
  assert.deepEqual(lock.packages[''].devDependencies, manifest.devDependencies)
  for (const dependency of Object.keys(manifest.devDependencies)) {
    assert.ok(lock.packages[`node_modules/${dependency}`], dependency)
  }
  assert.equal(manifest.dependencies, undefined)
})

test('discovery sorts explicit suites and excludes fixture, dependency and evaluation tests', async t => {
  const directory = await sandbox(t)
  for (const folder of ['scripts', 'package-check', 'scripts/node_modules', 'eval/workspace', 'fixtures/excluded']) {
    await mkdir(join(directory, 'tests', folder), { recursive: true })
  }
  await writeFile(join(directory, 'tests', 'scripts', 'z.test.mjs'), "import test from 'node:test'\ntest('script suite executed', () => {})\n")
  await writeFile(join(directory, 'tests', 'package-check', 'a.test.mjs'), "import test from 'node:test'\ntest('package suite executed', () => {})\n")
  for (const folder of ['fixtures/excluded', 'scripts/node_modules', 'eval/workspace']) {
    await cp(join(root, 'tests', 'fixtures', 'excluded', 'failing.test.mjs'), join(directory, 'tests', folder, 'failing.test.mjs'))
  }
  const result = run(directory)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /Selected 2 suite\(s\): tests[\\/]package-check[\\/]a.test.mjs, tests[\\/]scripts[\\/]z.test.mjs/)
  assert.match(result.stdout, /# tests 2/)
  assert.match(result.stdout, /script suite executed/)
  assert.match(result.stdout, /package suite executed/)
})

test('task selection executes only registered suites and rejects unknown tasks', async t => {
  const directory = await sandbox(t)
  await mkdir(join(directory, 'tests', 'scripts'), { recursive: true })
  await writeFile(join(directory, 'tests', 'tasks.json'), JSON.stringify({ 'T0.1': ['tests/scripts/selected.test.mjs'] }))
  await writeFile(join(directory, 'tests', 'scripts', 'selected.test.mjs'), "import test from 'node:test'\ntest('registered suite executed', () => {})\n")
  await cp(join(root, 'tests', 'fixtures', 'excluded', 'failing.test.mjs'), join(directory, 'tests', 'scripts', 'other.test.mjs'))
  const selected = run(directory, '--task', 'T0.1')
  assert.equal(selected.status, 0, selected.stderr + selected.stdout)
  assert.match(selected.stdout, /registered suite executed/)
  const unknown = run(directory, '--task', 'T99')
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /Unknown task: T99/)
})

test('an empty selected suite fails', async t => {
  const directory = await sandbox(t)
  const result = run(directory)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /No test suites selected/)
})

async function evidenceSandbox(t, source = "import test from 'node:test'\ntest('recorded behaviour', () => {})\n") {
  const directory = await sandbox(t)
  await cp(join(root, 'scripts'), join(directory, 'scripts'), { recursive: true })
  await cp(join(root, 'skills', 'repo-audit', 'scripts', 'lib'), join(directory, 'skills', 'repo-audit', 'scripts', 'lib'), { recursive: true })
  await mkdir(join(directory, 'tests', 'scripts'), { recursive: true })
  await writeFile(join(directory, 'tests', 'scripts', 'selected.test.mjs'), source)
  await writeFile(join(directory, '.gitignore'), '.cache/\n')
  for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial'],
    ['update-ref', 'refs/remotes/origin/main', 'HEAD']]) {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  return directory
}

function attach(directory, runPath = '.cache/run.json') {
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return spawnSync(process.execPath, [join(directory, 'scripts', 'task-evidence.mjs'), runPath, 'speed'],
    { cwd: directory, encoding: 'utf8', env })
}

test('ordinary full-suite invocation retains attachable evidence in a Git checkout', async t => {
  const directory = await evidenceSandbox(t)
  assert.equal(run(directory).status, 0)
  assert.equal(attach(directory, '.cache/full-suite.json').status, 0)
})

test('ordinary tests execute without a base and invalidate older capture', async t => {
  const directory = await evidenceSandbox(t)
  assert.equal(run(directory).status, 0)
  const removed = spawnSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: directory })
  assert.equal(removed.status, 0)
  const result = run(directory)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /recorded behaviour/)
  assert.match(result.stdout, /# tests 1/)
  assert.equal(attach(directory, '.cache/full-suite.json').status, 1)
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 1)
})

test('Windows evidence environment launches the npm JavaScript entry point', async t => {
  const directory = await sandbox(t)
  const cli = join(directory, 'npm-cli.js')
  await writeFile(cli, "console.log('11.13.0')\n")
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { environment } from ${JSON.stringify(join(root, 'scripts/lib/test-evidence.mjs'))};
    Object.defineProperty(process, 'platform', { value: 'win32' });
    console.log(JSON.stringify(await environment()));`],
  { encoding: 'utf8', env: { ...process.env, npm_execpath: cli } })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).tools.npm, '11.13.0')
})

test('attachment preserves inventory paths and captured artifact hashes', async t => {
  const directory = await evidenceSandbox(t)
  await cp(join(root, 'tests/fixtures/installer-collision'), join(directory, 'tests/fixtures/installer-collision'), { recursive: true })
  const staged = spawnSync('git', ['add', '.'], { cwd: directory })
  assert.equal(staged.status, 0)
  const committed = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], { cwd: directory })
  assert.equal(committed.status, 0)
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
  assert.equal(attach(directory).status, 0)
  const capture = JSON.parse(await readFile(join(directory, '.cache/run.json'), 'utf8'))
  const record = JSON.parse(await readFile(join(directory, 'tests/eval/results/tasks/speed.json'), 'utf8'))
  assert.deepEqual(record.validation.inputs, capture.inputs)
  assert.equal(hash(JSON.stringify(record.validation.inputs.files)), record.validation.inputs.sha256)
  assert.equal(hash(await readFile(join(directory, record.commands[0].outputArtifact))), record.validation.outputSha256)
  assert.equal(hash(await readFile(join(directory, record.validation.eventsArtifact))), record.validation.eventsSha256)
})

test('ordinary tests still execute dirty source but its evidence cannot attach', async t => {
  const directory = await evidenceSandbox(t)
  await writeFile(join(directory, 'tests/scripts/selected.test.mjs'), "import test from 'node:test'\ntest('dirty behaviour', () => {})\n")
  const result = run(directory)
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.match(result.stdout, /dirty behaviour/)
  assert.equal(attach(directory, '.cache/full-suite.json').status, 1)
})

test('full-run evidence attaches identities and output without executing tests again', async t => {
  const directory = await evidenceSandbox(t,
    "import test from 'node:test'\nimport { appendFileSync } from 'node:fs'\ntest('recorded behaviour', () => appendFileSync('.cache/executions', 'run\\n'))\n")
  const result = run(directory, '--capture', '.cache/run.json')
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.equal(attach(directory).status, 0)
  const record = JSON.parse(await readFile(join(directory, 'tests/eval/results/tasks/speed.json'), 'utf8'))
  assert.equal(record.validation.counts.tests, 1)
  assert.deepEqual(record.validation.suites, ['tests/scripts/selected.test.mjs'])
  const identities = await readFile(join(directory, record.validation.eventsArtifact), 'utf8')
  assert.match(identities, /recorded behaviour/)
  assert.ok(!identities.includes(directory))
  spawnSync('git', ['add', 'tests/eval/results/tasks'], { cwd: directory })
  const commit = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'evidence'], { cwd: directory })
  assert.equal(commit.status, 0)
  assert.equal(attach(directory).status, 0)
  assert.equal(await readFile(join(directory, '.cache/executions'), 'utf8'), 'run\n')
})

for (const change of ['source', 'new input', 'deleted input', 'base', 'output', 'identities', 'environment']) {
  test(`full-run evidence rejects changed ${change}`, async t => {
    const directory = await evidenceSandbox(t)
    assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
    if (change === 'source') await writeFile(join(directory, 'tests/scripts/selected.test.mjs'), '// changed\n')
    if (change === 'new input') await writeFile(join(directory, 'new.mjs'), '// new\n')
    if (change === 'deleted input') await rm(join(directory, 'tests/scripts/selected.test.mjs'))
    if (change === 'base') {
      spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'new base'], { cwd: directory })
      spawnSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: directory })
    }
    if (change === 'output') await writeFile(join(directory, '.cache/run.json.tap'), 'invented pass\n')
    if (change === 'identities') await writeFile(join(directory, '.cache/run.json.events'), '{}\n')
    if (change === 'environment') {
      const path = join(directory, '.cache/run.json')
      const record = JSON.parse(await readFile(path, 'utf8'))
      record.environment.node = 'v0.0.0'
      await writeFile(path, JSON.stringify(record))
    }
    assert.equal(attach(directory).status, 1)
  })
}

test('failed full-suite evidence cannot attach a passing record', async t => {
  const directory = await evidenceSandbox(t, "import test from 'node:test'\ntest('failure', () => { throw Error('expected') })\n")
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 1)
  assert.equal(attach(directory).status, 1)
})

for (const option of ['skip', 'todo']) {
  test(`full-suite evidence with ${option} cannot attach a passing record`, async t => {
    const directory = await evidenceSandbox(t, `import test from 'node:test'\ntest('unfinished', { ${option}: true }, () => {})\n`)
    assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
    assert.equal(attach(directory).status, 1)
  })
}

test('capture rejects uncommitted source and invalidates an older successful capture', async t => {
  const directory = await evidenceSandbox(t)
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
  await writeFile(join(directory, 'tests/scripts/selected.test.mjs'), '// changed\n')
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 1)
  assert.equal(attach(directory).status, 1)
})

for (const [state, restoreArgs] of [['unstaged', ['--worktree']], ['staged', ['--staged', '--worktree']]]) {
  test(`attachment rejects ${state} restoration of tested source over an untested HEAD`, async t => {
    const directory = await evidenceSandbox(t)
    const path = join(directory, 'tests/scripts/selected.test.mjs')
    assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
    const capture = JSON.parse(await readFile(join(directory, '.cache/run.json'), 'utf8'))
    await writeFile(path, "import test from 'node:test'\ntest('untested behaviour', () => {})\n")
    assert.equal(spawnSync('git', ['add', '.'], { cwd: directory }).status, 0)
    assert.equal(spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'untested source'], { cwd: directory }).status, 0)
    assert.equal(spawnSync('git', ['restore', `--source=${capture.sourceRevision}`, ...restoreArgs, 'tests/scripts/selected.test.mjs'], { cwd: directory }).status, 0)
    const result = attach(directory)
    assert.equal(result.status, 1, result.stderr + result.stdout)
    assert.match(result.stderr, /Commit source inputs before attaching evidence/)
  })
}

test('attachment rejects untracked restoration of a file deleted from HEAD', async t => {
  const directory = await evidenceSandbox(t)
  const path = join(directory, 'tests/scripts/selected.test.mjs')
  const tested = await readFile(path, 'utf8')
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
  assert.equal(spawnSync('git', ['rm', 'tests/scripts/selected.test.mjs'], { cwd: directory }).status, 0)
  assert.equal(spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'delete tested source'], { cwd: directory }).status, 0)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, tested)
  const result = attach(directory)
  assert.equal(result.status, 1, result.stderr + result.stdout)
  assert.match(result.stderr, /Commit source inputs before attaching evidence/)
})

test('capture rejects source changes made during test execution', async t => {
  const directory = await evidenceSandbox(t,
    "import test from 'node:test'\nimport { writeFileSync } from 'node:fs'\ntest('mutates authored input', () => writeFileSync('new.mjs', '// changed\\n'))\n")
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 1)
  assert.equal(attach(directory).status, 1)
})

test('refreshing full-suite evidence preserves task acceptance and blocked limitations', async t => {
  const directory = await evidenceSandbox(t)
  assert.equal(run(directory, '--capture', '.cache/run.json').status, 0)
  assert.equal(attach(directory).status, 0)
  const path = join(directory, 'tests/eval/results/tasks/speed.json')
  const record = JSON.parse(await readFile(path, 'utf8'))
  record.status = 'blocked'
  record.cases = [{ id: 'AC-1', kind: 'manual', procedure: 'approval', status: 'blocked', artifact: null,
    reason: 'not run', nextPrerequisite: 'author review' }]
  record.limitations = ['Manual approval remains blocked.']
  await writeFile(path, JSON.stringify(record))
  assert.equal(attach(directory).status, 0)
  const updated = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(updated.status, 'blocked')
  assert.deepEqual(updated.cases, record.cases)
  assert.ok(updated.limitations.includes(record.limitations[0]))
})
