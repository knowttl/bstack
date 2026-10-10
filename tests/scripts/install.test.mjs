import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir, devNull } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

// Every installer invocation selects a disposable snapshot and isolated home.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function command(executable, args, cwd, env) {
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 120000 })
  assert.equal(result.error, undefined, result.error?.message)
  return result
}

async function fixture(t, failRuntime = false) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack install ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const checkout = join(directory, 'source')
  const home = join(directory, 'home')
  const project = join(directory, 'project')
  for (const path of [checkout, home, project]) await mkdir(path)
  const { NODE_TEST_CONTEXT, ...inherited } = process.env
  const env = { ...inherited, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, 'cache'), LOCALAPPDATA: join(home, 'cache'),
    npm_config_cache: join(home, 'npm-cache'), npm_config_userconfig: join(home, 'npmrc'), npm_config_offline: 'true',
    GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
  for (const name of ['install', 'skills/repo-audit']) await cp(join(root, name), join(checkout, name), { recursive: true,
    filter: path => !path.split(/[\\/]/).includes('node_modules') })
  await mkdir(join(checkout, 'scripts'))
  await cp(join(root, 'scripts/check-package.mjs'), join(checkout, 'scripts/check-package.mjs'))
  await symlink(join(root, 'node_modules'), join(checkout, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const dependency = join(directory, 'dependency')
  await mkdir(join(dependency, 'dist'), { recursive: true })
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'lavish-axi', version: '0.1.78', type: 'module',
    ...(failRuntime ? { scripts: { install: 'node install.mjs' } } : {}) }))
  await writeFile(join(dependency, 'dist/cli.mjs'), "console.log('0.1.78')\n")
  if (failRuntime) await writeFile(join(dependency, 'install.mjs'), "import { spawnSync } from 'node:child_process'\nconst result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'missing-nested-command'], { stdio: 'inherit' })\nprocess.exit(result.status ?? 1)\n")
  const npm = (...args) => command('npm', args, dependency, env)
  const packed = npm('pack', '--json', '--ignore-scripts')
  assert.equal(packed.status, 0, packed.stderr)
  const tarball = join(dependency, JSON.parse(packed.stdout)[0].filename)
  const source = join(checkout, 'skills/repo-audit')
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
  await rm(join(source, 'package-lock.json'))
  const lockResult = command('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', tarball], source, env)
  assert.equal(lockResult.status, 0, lockResult.stdout + lockResult.stderr)
  const lock = JSON.parse(await readFile(join(source, 'package-lock.json'), 'utf8'))
  lock.packages[''].dependencies = manifest.dependencies
  await writeFile(join(source, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(source, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n')
  await writeFile(join(checkout, '.gitignore'), 'node_modules/\n')
  const git = (...args) => {
    const result = command('git', args, checkout, env)
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init', '--initial-branch=main', '--template=')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'core.autocrlf', 'false')
  git('add', '.')
  git('commit', '-m', 'fixture release snapshot')
  const run = (...args) => {
    const result = command(process.execPath, [join(checkout, 'install/install.mjs'), ...args, '--json'], project, env)
    return { ...result, value: JSON.parse(result.stdout) }
  }
  return { directory, checkout, source, home, project, env, git, run }
}

async function inventory(directory) {
  const entries = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    entries.push([entry.name, entry.isDirectory() ? await inventory(path) : createHash('sha256').update(await readFile(path)).digest('hex')])
  }
  return entries
}

for (const scope of ['user', 'project']) {
  test(`copy install validates the complete package and exact ownership in isolated ${scope} scope`, async t => {
    const f = await fixture(t)
    const selected = scope === 'user' ? f.home : f.project
    const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : []), '--host', 'all']
    const sourceBefore = await inventory(f.source)
    const result = f.run(...args)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.value.data.sourceVersion, /^development:[0-9a-f]{40}$/)
    for (const host of ['claude', 'agents']) {
      const parent = join(selected, `.${host}/skills`)
      const destination = join(parent, 'repo-audit')
      const checked = command(process.execPath, [join(root, 'scripts/check-package.mjs'), '--skill', destination], f.project, f.env)
      assert.equal(checked.status, 0, checked.stdout + checked.stderr)
      const record = JSON.parse(await readFile(join(parent, '.bstack-install.json'), 'utf8'))
      assert.equal(record.mode, 'copy')
      assert.equal(record.destination, destination)
      assert.equal(record.sourceVersion, result.value.data.sourceVersion)
      const owned = result.value.data.changes.filter(change => change.action === 'copy' && change.path.startsWith(destination + sep))
      assert.equal(Object.keys(record.files).length, owned.length)
      for (const [path, hash] of Object.entries(record.files)) {
        assert.equal(hash, createHash('sha256').update(await readFile(join(destination, path))).digest('hex'))
        assert.equal(path.split('/').includes('node_modules'), false)
      }
      assert.deepEqual(record.runtime, { path: join(destination, 'node_modules'), created: true, version: '0.1.78' })
      assert.deepEqual((await readdir(parent)).sort(), ['.bstack-install.json', 'repo-audit'])
    }
    assert.deepEqual(await inventory(f.source), sourceBefore)
    const before = await inventory(selected)
    const repeated = f.run(...args)
    assert.equal(repeated.status, 0, repeated.stdout)
    assert.deepEqual(repeated.value.data.changes, [])
    assert.deepEqual(repeated.value.data.destinations.map(entry => entry.action), ['no-op', 'no-op'])
    assert.deepEqual(await inventory(selected), before)
    const otherRoot = await readdir(scope === 'user' ? f.project : f.home)
    assert.equal(otherRoot.includes('.agents') || otherRoot.includes('.claude'), false)
  })
}

test('dry run lists every authored copy and runtime action without changing homes, project or source', async t => {
  const f = await fixture(t, true)
  const before = await Promise.all([inventory(f.home), inventory(f.project), inventory(f.source)])
  const result = f.run('--scope', 'user', '--host', 'all', '--dry-run')
  assert.equal(result.status, 0, result.stdout)
  assert.equal(result.value.data.preview, true)
  assert.equal(result.value.data.changes.filter(change => change.action === 'runtime-install').length, 2)
  assert.equal(result.value.data.changes.filter(change => change.action === 'ownership').length, 2)
  assert.ok(result.value.data.changes.some(change => change.path.endsWith('/SKILL.md')))
  assert.deepEqual(await Promise.all([inventory(f.home), inventory(f.project), inventory(f.source)]), before)
})

test('all-host install preserves the existing installer collision fixture before any staging', async t => {
  const f = await fixture(t)
  await cp(join(root, 'tests/fixtures/installer-collision/home'), f.home, { recursive: true })
  const before = await inventory(f.home)
  const result = f.run('--scope', 'user', '--host', 'all')
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'unowned-collision')
  assert.deepEqual(await inventory(f.home), before)
})

for (const broken of ['missing-resource', 'outside-resource', 'unpinned-runtime', 'lock-mismatch']) {
  test(`source preflight rejects ${broken} without destination mutations`, async t => {
    const f = await fixture(t)
    if (broken === 'missing-resource') await rm(join(f.source, 'references/vision.md'))
    if (broken === 'outside-resource') {
      await writeFile(join(f.checkout, 'outside.md'), 'Outside package\n')
      await writeFile(join(f.source, 'extra.md'), '[Outside](../../outside.md)\n')
    }
    if (broken === 'unpinned-runtime') {
      const manifest = JSON.parse(await readFile(join(f.source, 'package.json'), 'utf8'))
      manifest.dependencies['lavish-axi'] = '^0.1.78'
      await writeFile(join(f.source, 'package.json'), JSON.stringify(manifest))
    }
    if (broken === 'lock-mismatch') {
      const lock = JSON.parse(await readFile(join(f.source, 'package-lock.json'), 'utf8'))
      lock.packages['node_modules/lavish-axi'].version = '0.1.77'
      await writeFile(join(f.source, 'package-lock.json'), JSON.stringify(lock))
    }
    const before = await inventory(f.home)
    const result = f.run('--scope', 'user', '--host', 'agents', '--dry-run')
    assert.equal(result.status, 1, result.stdout)
    assert.equal(result.value.problems.some(problem => problem.code === (broken === 'missing-resource' ? 'local-path-missing' : broken === 'outside-resource' ? 'package-closure' : 'runtime-lock')), true)
    assert.deepEqual(await inventory(f.home), before)
  })
}

test('nested npm failure retains a recoverable stage and journal without activating or claiming ownership', async t => {
  const f = await fixture(t, true)
  const before = await inventory(f.source)
  const result = f.run('--scope', 'project', '--project', f.project, '--host', 'agents')
  assert.equal(result.status, 1, result.stdout)
  assert.equal(result.value.problems[0].code, 'runtime-install-failed')
  const parent = join(f.project, '.agents/skills')
  const journalPath = join(parent, '.bstack-install-journal.json')
  const journal = JSON.parse(await readFile(journalPath, 'utf8'))
  assert.equal(journal.state, 'staging')
  assert.equal(journal.runtimeResult.exitCode, 1)
  assert.match(journal.runtimeResult.stderr, /missing-nested-command/)
  assert.equal(await readFile(join(journal.stage, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
  assert.deepEqual((await readdir(parent)).sort(), ['.bstack-install-journal.json', journal.stage.split(/[\\/]/).at(-1)].sort())
  assert.deepEqual(await inventory(f.source), before)
  const retryBefore = await inventory(f.project)
  const retry = f.run('--scope', 'project', '--project', f.project, '--host', 'agents')
  assert.equal(retry.status, 2)
  assert.equal(retry.value.problems[0].code, 'pending-recovery')
  assert.deepEqual(await inventory(f.project), retryBefore)
})

test('edited installations and later lifecycle modes block without changing content', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.project, '.agents/skills/repo-audit/SKILL.md'), '# User edits\n')
  const before = await inventory(f.project)
  assert.equal(f.run(...args).value.problems[0].code, 'update-pending')
  for (const mode of ['--uninstall', '--link']) assert.equal(f.run(...args, mode).value.problems[0].code, 'unsupported-lifecycle')
  assert.deepEqual(await inventory(f.project), before)
})

test('exact local snapshot tags are reported while dirty source is labelled development', async t => {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'user', '--host', 'agents', '--dry-run']
  assert.equal(f.run(...args).value.data.sourceVersion, 'v0.0.1')
  await writeFile(join(f.source, 'extra.md'), '# Development\n')
  assert.match(f.run(...args).value.data.sourceVersion, /^development:[0-9a-f]{40}:dirty$/)
})

test('invalid inputs fail before prerequisite or destination work', async t => {
  const f = await fixture(t)
  const before = await inventory(f.home)
  for (const args of [[], ['--scope', 'user'], ['--scope', 'project', '--host', 'agents'], ['--scope', 'user', '--host', 'pi'],
    ['--scope', 'user', '--project', f.project, '--host', 'agents'], ['--scope', 'user', '--host', 'agents', '--dr-run'],
    ['--scope', 'user', '--host', 'agents', '--host', 'claude']]) {
    assert.equal(f.run(...args).status, 3)
  }
  assert.deepEqual(await inventory(f.home), before)
})

test('missing checker dependencies return a structured prerequisite without mutations', async t => {
  const f = await fixture(t)
  await rm(join(f.checkout, 'node_modules'))
  const before = await inventory(f.home)
  const result = f.run('--scope', 'user', '--host', 'agents', '--dry-run')
  assert.equal(result.status, 2, result.stdout + result.stderr)
  assert.equal(result.value.problems[0].code, 'missing-checker-prerequisite')
  assert.match(result.value.problems[0].fix, /npm ci/)
  assert.deepEqual(await inventory(f.home), before)
})

test('missing system tools block before creating installation state', async t => {
  const f = await fixture(t)
  f.env.PATH = ''
  const before = await inventory(f.home)
  const result = f.run('--scope', 'user', '--host', 'agents')
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'missing-prerequisite')
  assert.match(result.value.problems[0].message, /git/)
  assert.deepEqual(await inventory(f.home), before)
})
