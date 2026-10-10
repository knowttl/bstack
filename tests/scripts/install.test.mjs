import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir, devNull } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { selectCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

// Every installer invocation selects a disposable snapshot and isolated home.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const npmCommand = await selectCommand('npm', [])

function command(executable, args, cwd, env) {
  if (executable === 'npm') {
    executable = npmCommand.executable
    args = [...npmCommand.args, ...args]
  }
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
  if (failRuntime) await writeFile(join(dependency, 'install.mjs'), "import { spawnSync } from 'node:child_process'\nif (process.env.BSTACK_FIXTURE_RUNTIME_FAIL === '0') process.exit(0)\nconst result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'missing-nested-command'], { stdio: 'inherit' })\nprocess.exit(result.status ?? 1)\n")
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
    return { ...result, value: result.stdout ? JSON.parse(result.stdout) : null }
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
      const runtimeStat = await lstat(join(destination, 'node_modules'), { bigint: true })
      assert.deepEqual(record.runtime, { path: join(destination, 'node_modules'), created: true, version: '0.1.78',
        identity: { dev: String(runtimeStat.dev), ino: String(runtimeStat.ino), birthtimeNs: String(runtimeStat.birthtimeNs) } })
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

for (const scope of ['user', 'project']) {
  for (const host of ['claude', 'agents']) {
    test(`all-host install deduplicates ${scope} destinations aliased to ${host}`, async t => {
      const f = await fixture(t)
      const selected = scope === 'user' ? f.home : f.project
      const parent = join(selected, `.${host}/skills`)
      const alias = host === 'claude' ? 'agents' : 'claude'
      await mkdir(parent, { recursive: true })
      await mkdir(join(selected, `.${alias}`))
      await symlink(parent, join(selected, `.${alias}/skills`), process.platform === 'win32' ? 'junction' : 'dir')
      const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : []), '--host', 'all']
      const preview = f.run(...args, '--dry-run')
      assert.equal(preview.status, 0, preview.stdout + preview.stderr)
      assert.equal(preview.value.data.destinations.length, 1)
      assert.equal(preview.value.data.changes.filter(change => change.action === 'runtime-install').length, 1)
      assert.deepEqual(await readdir(parent), [])
      const installed = f.run(...args)
      assert.equal(installed.status, 0, installed.stdout + installed.stderr)
      assert.equal(installed.value.data.destinations.length, 1)
      assert.deepEqual((await readdir(parent)).sort(), ['.bstack-install.json', 'repo-audit'])
      const repeated = f.run(...args)
      assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr)
      assert.deepEqual(repeated.value.data.changes, [])
      assert.deepEqual(repeated.value.data.destinations.map(entry => entry.action), ['no-op'])
    })
  }
}

for (const location of ['checkout', 'nested', 'aliased', 'distinct aliases']) {
  for (const tagged of [false, true]) {
    test(`repeat installs preserve ${tagged ? 'tagged' : 'development'} source version at ${location}`, async t => {
      const f = await fixture(t)
      const project = location === 'nested' ? join(f.checkout, 'project ü &') : f.checkout
      await mkdir(project, { recursive: true })
      if (location === 'aliased' || location === 'distinct aliases') {
        const parent = join(project, 'installed skills ü &')
        await mkdir(parent)
        for (const host of ['claude', 'agents']) {
          const target = location === 'aliased' ? parent : join(parent, host)
          await mkdir(target, { recursive: true })
          await mkdir(join(project, `.${host}`))
          await symlink(target, join(project, `.${host}/skills`), process.platform === 'win32' ? 'junction' : 'dir')
        }
        f.git('add', '.')
        f.git('commit', '-m', 'record fixture host aliases')
      }
      if (tagged) f.git('tag', 'v0.0.1')
      const args = ['--scope', 'project', '--project', project, '--host', 'all']
      const installed = f.run(...args)
      assert.equal(installed.status, 0, installed.stdout + installed.stderr)
      const expectedVersion = tagged ? 'v0.0.1' : `development:${f.git('rev-parse', 'HEAD')}`
      assert.equal(installed.value.data.sourceVersion, expectedVersion)
      for (const host of ['claude', 'agents', 'all']) {
        for (const preview of [false, true]) {
          const repeated = f.run('--scope', 'project', '--project', project, '--host', host, ...(preview ? ['--dry-run'] : []))
          assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr)
          assert.equal(repeated.value.data.sourceVersion, expectedVersion)
          assert.deepEqual(repeated.value.data.changes, [])
        }
      }
      await writeFile(join(project, '.agents/skills/unrelated.md'), '# User file\n')
      const dirty = f.run(...args, '--dry-run')
      assert.equal(dirty.status, 0, dirty.stdout + dirty.stderr)
      assert.match(dirty.value.data.sourceVersion, /^development:[0-9a-f]{40}:dirty$/)
      assert.equal(await readFile(join(project, '.agents/skills/unrelated.md'), 'utf8'), '# User file\n')
    })
  }
}

for (const scope of ['user', 'project']) {
  test(`repeat ${scope} install preserves unrelated content including symlinks`, async t => {
    const f = await fixture(t)
    const selected = scope === 'user' ? f.home : f.project
    const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : []), '--host', 'all']
    assert.equal(f.run(...args).status, 0)
    const document = join(f.project, 'notes.md')
    await writeFile(document, '# Project notes\n')
    for (const host of ['claude', 'agents']) {
      const destination = join(selected, `.${host}/skills/repo-audit`)
      await symlink(document, join(destination, 'notes.md'), 'file')
      await symlink(join(destination, 'absent.md'), join(destination, 'broken.md'), 'file')
      await mkdir(join(destination, 'unrelated'))
      await symlink(f.project, join(destination, 'unrelated/project'), process.platform === 'win32' ? 'junction' : 'dir')
      await writeFile(join(destination, 'unrelated/data.txt'), 'User data\n')
    }
    for (const preview of [false, true]) {
      const repeated = f.run(...args, ...(preview ? ['--dry-run'] : []))
      assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr)
      assert.deepEqual(repeated.value.data.changes, [])
      for (const host of ['claude', 'agents']) {
        const destination = join(selected, `.${host}/skills/repo-audit`)
        assert.equal(await readlink(join(destination, 'notes.md')), document)
        assert.equal((await lstat(join(destination, 'broken.md'))).isSymbolicLink(), true)
        assert.equal((await lstat(join(destination, 'unrelated/project'))).isSymbolicLink(), true)
        assert.equal(await readFile(join(destination, 'unrelated/data.txt'), 'utf8'), 'User data\n')
      }
      assert.equal(await readFile(document, 'utf8'), '# Project notes\n')
    }
  })
}

for (const change of ['missing', 'directory', 'symlink']) {
  test(`repeat install rejects an owned file replaced with ${change}`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    assert.equal(f.run(...args).status, 0)
    const installed = join(f.project, '.agents/skills/repo-audit/SKILL.md')
    await rm(installed)
    if (change === 'directory') await mkdir(installed)
    if (change === 'symlink') await symlink(join(f.source, 'SKILL.md'), installed, 'file')
    for (const preview of [false, true]) {
      const result = f.run(...args, ...(preview ? ['--dry-run'] : []))
      assert.equal(result.status, preview ? 0 : 2, result.stdout + result.stderr)
    }
  })
}

test('tracked source changes remain dirty inside installation paths', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.checkout, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  f.git('add', '.agents')
  f.git('commit', '-m', 'record fixture installation')
  await writeFile(join(f.checkout, '.agents/skills/repo-audit/extra.md'), '# Tracked source\n')
  f.git('add', '.agents/skills/repo-audit/extra.md')
  const preview = f.run('--scope', 'user', '--host', 'agents', '--dry-run')
  assert.equal(preview.status, 0, preview.stdout + preview.stderr)
  assert.match(preview.value.data.sourceVersion, /^development:[0-9a-f]{40}:dirty$/)
})

test('installed package validation rejects a removed runtime launcher', async t => {
  const f = await fixture(t)
  const installed = f.run('--scope', 'project', '--project', f.project, '--host', 'agents')
  assert.equal(installed.status, 0, installed.stdout + installed.stderr)
  const destination = join(f.project, '.agents/skills/repo-audit')
  await rm(join(destination, 'node_modules/lavish-axi/dist/cli.mjs'))
  const checked = command(process.execPath, [join(root, 'scripts/check-package.mjs'), '--skill', destination], f.project, f.env)
  assert.equal(checked.status, 1, checked.stdout + checked.stderr)
  assert.match(checked.stdout, /local-path-missing:.*node_modules\/lavish-axi\/dist\/cli\.mjs/)
})

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

for (const broken of ['missing-resource', 'outside-resource', 'unpinned-runtime', 'lock-mismatch', 'symlink-source']) {
  test(`source preflight rejects ${broken} without destination mutations`, async t => {
    const f = await fixture(t)
    if (broken === 'missing-resource') await rm(join(f.source, 'references/vision.md'))
    if (broken === 'outside-resource') {
      await writeFile(join(f.checkout, 'outside.md'), 'Outside package\n')
      await writeFile(join(f.source, 'extra.md'), '[Outside](../../outside.md)\n')
    }
    if (broken === 'symlink-source') {
      await writeFile(join(f.project, 'note.md'), '# Project note\n')
      await symlink(join(f.project, 'note.md'), join(f.source, 'note.md'), 'file')
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
    assert.equal(result.status, broken === 'symlink-source' ? 2 : 1, result.stdout)
    assert.equal(result.value.problems.some(problem => problem.code === (broken === 'missing-resource' ? 'local-path-missing' : broken === 'outside-resource' ? 'package-closure' : broken === 'symlink-source' ? 'unsupported-source-entry' : 'runtime-lock')), true)
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
  const retry = f.run('--scope', 'project', '--project', f.project, '--host', 'agents')
  assert.equal(retry.status, 1)
  assert.equal(retry.value.problems[0].code, 'runtime-install-failed')
  assert.equal((await readdir(parent)).includes('repo-audit'), false)
})

test('edited installations preserve conflicts and refuse copy to link conversion', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.project, '.agents/skills/repo-audit/SKILL.md'), '# User edits\n')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.data.installations[0].sourceVersion, 'mixed')
  assert.equal(await readFile(join(f.project, '.agents/skills/repo-audit/SKILL.md'), 'utf8'), '# User edits\n')
  assert.equal(f.run(...args, '--link').value.problems[0].code, 'unowned-collision')
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

test('unavailable checker dependency returns a structured prerequisite without mutations', async t => {
  const f = await fixture(t)
  await rm(join(f.checkout, 'node_modules'))
  // Prevent an enclosing checkout from satisfying the missing dependency.
  await mkdir(join(f.checkout, 'node_modules/acorn'), { recursive: true })
  await writeFile(join(f.checkout, 'node_modules/acorn/package.json'), JSON.stringify({ name: 'acorn', exports: './absent.mjs' }))
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

async function lifecycle(t, scope = 'project') {
  const f = await fixture(t)
  for (const path of ['current.md', 'edited.md', 'retired.md', 'edited-retired.md']) await writeFile(join(f.source, path), 'Version one\n')
  f.git('add', '.')
  f.git('commit', '-m', 'first release files')
  f.git('tag', 'v0.0.1')
  const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : []), '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  const parent = join(scope === 'user' ? f.home : f.project, '.agents/skills')
  const destination = join(parent, 'repo-audit')
  const ownership = join(parent, '.bstack-install.json')
  const journal = join(parent, '.bstack-install-journal.json')
  for (const path of ['current.md', 'edited.md']) await writeFile(join(f.source, path), 'Version two\n')
  for (const path of ['retired.md', 'edited-retired.md']) await rm(join(f.source, path))
  await writeFile(join(f.source, 'added.md'), 'New package file\n')
  f.git('add', '.')
  f.git('commit', '-m', 'second release files')
  f.git('tag', 'v0.0.2')
  return { ...f, args, parent, destination, ownership, journal }
}

async function legacyInstallation(t, host = 'agents') {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  f.git('update-index', '--assume-unchanged', 'install/install.mjs')
  const installer = command('git', ['show', '98b9ab1d8de5f9a238dde2383295c2c04450d852:install/install.mjs'], root, f.env)
  assert.equal(installer.status, 0, installer.stderr)
  await writeFile(join(f.checkout, 'install/install.mjs'), installer.stdout)
  const args = ['--scope', 'project', '--project', f.project, '--host', host]
  assert.equal(f.run(...args).status, 0)
  await cp(join(root, 'install/install.mjs'), join(f.checkout, 'install/install.mjs'))
  const parent = join(f.project, '.agents/skills')
  const destination = join(parent, 'repo-audit')
  const ownership = join(parent, '.bstack-install.json')
  assert.equal(JSON.parse(await readFile(ownership, 'utf8')).runtime.identity, undefined)
  return { ...f, args, parent, destination, ownership }
}

async function upgradeRuntime(f) {
  const dependency = join(f.directory, 'dependency')
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'lavish-axi', version: '0.1.79', type: 'module' }))
  await writeFile(join(dependency, 'dist/cli.mjs'), "console.log('0.1.79')\n")
  const packed = command('npm', ['pack', '--json', '--ignore-scripts'], dependency, f.env)
  assert.equal(packed.status, 0, packed.stderr)
  const tarball = join(dependency, JSON.parse(packed.stdout)[0].filename)
  const manifest = JSON.parse(await readFile(join(f.source, 'package.json'), 'utf8'))
  manifest.dependencies['lavish-axi'] = '0.1.79'
  await rm(join(f.source, 'package-lock.json'))
  const locked = command('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', tarball], f.source, f.env)
  assert.equal(locked.status, 0, locked.stdout + locked.stderr)
  const lock = JSON.parse(await readFile(join(f.source, 'package-lock.json'), 'utf8'))
  lock.packages[''].dependencies = manifest.dependencies
  await writeFile(join(f.source, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(f.source, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n')
  f.git('add', '.')
  f.git('commit', '-m', 'runtime upgrade')
  f.git('tag', 'v0.0.2')
}

for (const scope of ['user', 'project']) {
  test(`clean ${scope} update removes obsolete ownership and clean uninstall removes only installer content`, async t => {
    const f = await lifecycle(t, scope)
    const outside = join(f.project, 'outside.txt')
    await writeFile(outside, 'Unrelated target\n')
    await symlink(outside, join(f.destination, 'notes-link'), 'file')
    await mkdir(join(f.destination, 'scratch'))
    await mkdir(join(f.destination, 'empty-unowned'))
    await writeFile(join(f.destination, 'scratch/notes.txt'), 'Unowned notes\n')
    const before = await inventory(scope === 'user' ? f.home : f.project)
    const preview = f.run(...f.args, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.ok(preview.value.data.changes.some(change => change.action === 'remove' && change.path.endsWith('retired.md')))
    assert.deepEqual(await inventory(scope === 'user' ? f.home : f.project), before)
    const updated = f.run(...f.args)
    assert.equal(updated.status, 0, updated.stdout)
    assert.equal(await readFile(join(f.destination, 'current.md'), 'utf8'), 'Version two\n')
    assert.equal((await readdir(f.destination)).includes('retired.md'), false)
    const record = JSON.parse(await readFile(f.ownership, 'utf8'))
    assert.equal(record.sourceVersion, 'v0.0.2')
    assert.equal(Object.hasOwn(record.files, 'retired.md'), false)
    assert.deepEqual(f.run(...f.args).value.data.changes, [])
    const removed = f.run(...f.args, '--uninstall')
    assert.equal(removed.status, 0, removed.stdout)
    assert.deepEqual(removed.value.data.installations[0].retained, ['empty-unowned/', 'notes-link', 'scratch/notes.txt'])
    assert.equal(await readFile(outside, 'utf8'), 'Unrelated target\n')
    assert.equal(await readFile(join(f.destination, 'scratch/notes.txt'), 'utf8'), 'Unowned notes\n')
    assert.equal((await readdir(f.parent)).includes('.bstack-install.json'), false)
    // Unowned retained content is never silently adopted on a later install.
    assert.equal(f.run(...f.args).value.problems[0].code, 'unowned-collision')
  })
}

test('noninteractive update reports actual mixed versions, preserves edits and unowned collisions, then accepts specific decisions with backups', async t => {
  const f = await lifecycle(t)
  for (const path of ['edited.md', 'edited-retired.md', 'added.md']) await writeFile(join(f.destination, path), 'User content\n')
  const previewBefore = await inventory(f.project)
  const preview = f.run(...f.args, '--dry-run')
  assert.equal(preview.status, 0)
  assert.equal(preview.value.data.destinations[0].conflicts.length, 3)
  assert.deepEqual(await inventory(f.project), previewBefore)
  const partial = f.run(...f.args)
  assert.equal(partial.status, 2, partial.stdout)
  const report = partial.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.fileVersions['current.md'], 'v0.0.2')
  assert.equal(report.fileVersions['edited.md'], 'v0.0.1')
  const record = JSON.parse(await readFile(f.ownership, 'utf8'))
  assert.equal(record.sourceVersion, 'mixed')
  assert.equal(Object.hasOwn(record.files, 'added.md'), false)
  assert.equal(record.files['edited.md'], createHash('sha256').update('Version one\n').digest('hex'))
  assert.equal(report.files['edited.md'], createHash('sha256').update('User content\n').digest('hex'))
  assert.equal(await readFile(join(f.destination, 'current.md'), 'utf8'), 'Version two\n')
  assert.equal((await readdir(f.destination)).includes('retired.md'), false)
  for (const conflict of report.conflicts) {
    assert.match(conflict.diff, /-User content/)
    assert.equal(await readFile(join(f.destination, conflict.path), 'utf8'), 'User content\n')
  }
  const decisions = report.conflicts.flatMap(conflict => ['--replace', conflict.decision.slice('--replace '.length)])
  const replaced = f.run(...f.args, ...decisions)
  assert.equal(replaced.status, 0, replaced.stdout)
  assert.equal(replaced.value.data.installations[0].sourceVersion, 'v0.0.2')
  const backup = replaced.value.data.installations[0].backup
  assert.equal((await readdir(backup)).length, 3)
  for (const path of await readdir(backup)) assert.equal(await readFile(join(backup, path), 'utf8'), 'User content\n')
  assert.equal(await readFile(join(f.destination, 'edited.md'), 'utf8'), 'Version two\n')
  assert.equal(await readFile(join(f.destination, 'added.md'), 'utf8'), 'New package file\n')
  assert.equal((await readdir(f.destination)).includes('edited-retired.md'), false)
})

test('stale replacement decisions preserve later edits before any staging', async t => {
  const f = await lifecycle(t)
  await writeFile(join(f.destination, 'edited.md'), 'First edit\n')
  const preview = f.run(...f.args, '--dry-run')
  const decision = preview.value.data.destinations[0].conflicts[0].decision.slice('--replace '.length)
  await writeFile(join(f.destination, 'edited.md'), 'Later edit\n')
  const before = await inventory(f.project)
  const result = f.run(...f.args, '--replace', decision)
  assert.equal(result.status, 3, result.stdout)
  assert.equal(result.value.problems[0].code, 'stale-replacement')
  assert.deepEqual(await inventory(f.project), before)
})

test('uninstall retains edited ownership until explicit hash-bound cleanup and preserves unowned runtime', async t => {
  const f = await lifecycle(t)
  await writeFile(join(f.destination, 'edited.md'), 'User edit\n')
  await rm(join(f.destination, 'current.md'))
  await writeFile(join(f.destination, 'unowned.txt'), 'Keep\n')
  const before = await inventory(f.project)
  assert.equal(f.run(...f.args, '--uninstall', '--dry-run').status, 0)
  assert.deepEqual(await inventory(f.project), before)
  const removed = f.run(...f.args, '--uninstall')
  assert.equal(removed.status, 2, removed.stdout)
  assert.deepEqual(removed.value.data.installations[0].retained, ['edited.md', 'unowned.txt'])
  const record = JSON.parse(await readFile(f.ownership, 'utf8'))
  assert.deepEqual(Object.keys(record.files), ['edited.md'])
  assert.equal(record.fileVersions['edited.md'], 'v0.0.1')
  assert.equal(record.runtime, null)
  // A directory created after runtime removal remains unowned on repeat cleanup.
  await mkdir(join(f.destination, 'node_modules'))
  await writeFile(join(f.destination, 'node_modules/keep.txt'), 'Keep runtime\n')
  const repeated = f.run(...f.args, '--uninstall')
  assert.equal(repeated.status, 2, repeated.stdout)
  assert.equal(await readFile(join(f.destination, 'node_modules/keep.txt'), 'utf8'), 'Keep runtime\n')
  const decision = removed.value.data.installations[0].conflicts[0].decision.slice('--replace '.length)
  const cleanup = f.run(...f.args, '--uninstall', '--replace', decision)
  assert.equal(cleanup.status, 0, cleanup.stdout)
  assert.equal(await readFile(join(cleanup.value.data.installations[0].backup, 'edited.md'), 'utf8'), 'User edit\n')
  assert.equal(await readFile(join(f.destination, 'unowned.txt'), 'utf8'), 'Keep\n')
})

async function interrupt(f, boundary) {
  const hook = join(f.directory, 'interrupt.mjs')
  await writeFile(hook, `import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'
const rename = fs.rename
const unlink = fs.unlink
const copyFile = fs.copyFile
const rmdir = fs.rmdir
const writeFile = fs.writeFile
const open = fs.open
const boundary = ${JSON.stringify(boundary)}
let edited = false
fs.open = async (path, ...args) => {
  const handle = await open(path, ...args)
  const name = String(path)
  const kind = boundary.split(':')[1]
  if (boundary.startsWith('partial-writer:') && name.includes('.bstack-recovery-.bstack-install' + (kind === 'ownership' ? '' : '-' + kind) + '.json-')) {
    const write = handle.writeFile.bind(handle)
    handle.writeFile = async bytes => {
      if (kind === 'cleanup') {
        try { await fs.access(join(dirname(path), '.bstack-install-cleanup.json')) } catch { return write(bytes) }
      }
      await write(bytes.subarray(0, boundary.endsWith(':empty') ? 0 : Math.floor(bytes.length / 2)))
      process.exit(86)
    }
  }
  return handle
}
fs.writeFile = async (path, bytes, options) => {
  if (boundary === 'partial-backup' && String(path).replaceAll('\\\\', '/').includes('/.bstack-backup-')) {
    await writeFile(path, bytes.subarray(0, Math.floor(bytes.length / 2)), options)
    process.exit(86)
  }
  return writeFile(path, bytes, options)
}
fs.copyFile = async (from, to) => {
  if (boundary === 'partial-temp' && String(to).replaceAll('\\\\', '/').includes('/repo-audit/.bstack-install-') && String(to).endsWith('.tmp')) {
    const bytes = await fs.readFile(from)
    await fs.writeFile(to, bytes.subarray(0, Math.floor(bytes.length / 2)))
    process.exit(86)
  }
  return copyFile(from, to)
}
fs.rename = async (from, to) => {
  if (boundary === 'link-prepared' && String(from).endsWith('.tmp') && String(to).endsWith('.bstack-install-journal.json')) {
    const value = JSON.parse(await fs.readFile(from, 'utf8'))
    if (value.linkStage) process.exit(86)
  }
  if (boundary === 'link-runtime' && String(to).replaceAll('\\\\', '/').endsWith('/skills/repo-audit/node_modules')) {
    await rename(from, to)
    process.exit(86)
  }
  if (boundary === 'link-activate' && String(to).replaceAll('\\\\', '/').endsWith('/skills/repo-audit') && (await fs.lstat(from)).isSymbolicLink()) {
    await rename(from, to)
    process.exit(86)
  }
  if (boundary.startsWith('writer-') && String(from).endsWith('.tmp')) {
    const value = JSON.parse(await fs.readFile(from, 'utf8'))
    if (boundary === 'writer-' + value.state || boundary === 'writer-cleanup' && value.entries || boundary === 'writer-ownership' && value.mode === 'copy') process.exit(86)
  }
  const result = await rename(from, to)
  const path = String(to).replaceAll('\\\\', '/')
  if (path.endsWith('/.bstack-install.json') && boundary.startsWith('cleanup-receipt-') && path.includes('/.' + boundary.slice('cleanup-receipt-'.length) + '/')) {
    try {
      await fs.access(join(dirname(to), '../../.bstack-install-cleanup.json'))
      if (!JSON.parse(await fs.readFile(to, 'utf8')).acceptedAdoption) process.exit(86)
    } catch {}
  }
  if (path.endsWith('/.bstack-install-journal.json')) {
    const journal = JSON.parse(await fs.readFile(to, 'utf8'))
    if (boundary === journal.state) process.exit(86)
    if (boundary === 'agents-' + journal.state && path.includes('/.agents/')) process.exit(86)
    if (boundary === 'agents-stage-failure' && journal.state === 'staging' && path.includes('/.agents/')) throw Object.assign(new Error('Fixture staging failure'), { code: 'EACCES' })
    if (boundary === 'earlier-host-edit' && journal.state === 'prepared' && path.includes('/.agents/')) await fs.writeFile(join(dirname(to), '../../.claude/skills/repo-audit/SKILL.md'), 'Later host edit\\n')
  }
  if (boundary === 'ownership-adopt' && path.endsWith('/.bstack-install.json') && JSON.parse(await fs.readFile(to, 'utf8')).acceptedAdoption) process.exit(86)
  if (boundary === 'agents-ownership-adopt' && path.includes('/.agents/') && path.endsWith('/.bstack-install.json') && JSON.parse(await fs.readFile(to, 'utf8')).acceptedAdoption) process.exit(86)
  if (boundary === 'moved-cleanup-edit' && path.endsWith('/.bstack-install.json') && JSON.parse(await fs.readFile(to, 'utf8')).runtime?.version === '0.1.79') {
    const journal = JSON.parse(await fs.readFile(join(dirname(to), '.bstack-install-journal.json'), 'utf8'))
    await fs.writeFile(join(journal.stage, 'previous-runtime/keep.txt'), 'Cleanup runtime edit\\n')
  }
  if (boundary === 'approved-file-rename' && path.endsWith('/repo-audit/SKILL.md')) process.exit(86)
  if (boundary === 'approved-addition-rename' && path.endsWith('/repo-audit/added.md')) process.exit(86)
  if (boundary === 'copy-rename' && path.endsWith('/skills/repo-audit')) process.exit(86)
  if (boundary === 'copy-edit' && path.endsWith('/skills/repo-audit')) await fs.writeFile(join(to, 'SKILL.md'), 'Late user edit\\n')
  if (boundary === 'ownership-edit' && !edited && path.endsWith('/.bstack-install.json')) {
    edited = true
    await fs.writeFile(join(dirname(to), 'repo-audit/current.md'), 'Late user edit\\n')
  }
  if (boundary === 'file-rename' && path.endsWith('/repo-audit/current.md')) process.exit(86)
  if (boundary === 'runtime-backup' && path.endsWith('/previous-runtime')) process.exit(86)
  if (boundary === 'runtime-rename' && path.endsWith('/repo-audit/node_modules')) process.exit(86)
  return result
}
fs.unlink = async path => {
  if (boundary === 'link-unlink' && String(path).replaceAll('\\\\', '/').endsWith('/skills/repo-audit') && (await fs.lstat(path)).isSymbolicLink()) {
    await unlink(path)
    process.exit(86)
  }
  const normalized = String(path).replaceAll('\\\\', '/')
  if (boundary === 'cleanup-failure-agents' && normalized.includes('/.agents/') && normalized.includes('/.bstack-stage-') && normalized.endsWith('/SKILL.md')) throw Object.assign(new Error('Fixture cleanup failure'), { code: 'EACCES' })
  const result = await unlink(path)
  if (boundary === 'partial-runtime-uninstall' && normalized.includes('/repo-audit/node_modules/')) process.exit(86)
  if (boundary === 'partial-runtime-cleanup' && normalized.includes('/previous-runtime/')) process.exit(86)
  for (const host of ['claude', 'agents']) {
    if (normalized.includes('/.' + host + '/')) {
      if (boundary === 'cleanup-file-' + host && normalized.includes('/.bstack-stage-') && normalized.endsWith('/SKILL.md')) process.exit(86)
      if (boundary === 'cleanup-journal-' + host && normalized.endsWith('/.bstack-install-journal.json')) process.exit(86)
      if (boundary === 'cleanup-ownership-' + host && normalized.endsWith('/.bstack-install.json')) process.exit(86)
    }
  }
  if (boundary === 'file-remove' && String(path).replaceAll('\\\\', '/').endsWith('/repo-audit/current.md')) process.exit(86)
  return result
}
fs.rmdir = async path => {
  const result = await rmdir(path)
  const normalized = String(path).replaceAll('\\\\', '/')
  for (const host of ['claude', 'agents']) {
    if (normalized.includes('/.' + host + '/') && normalized.includes('/.bstack-stage-')) {
      try {
        await fs.access(normalized.slice(0, normalized.indexOf('/.' + host + '/')) + '/.bstack-install-cleanup.json')
        if (boundary === 'cleanup-runtime-' + host && normalized.endsWith('/previous-runtime')) process.exit(86)
        if (boundary === 'cleanup-staged-runtime-' + host && normalized.endsWith('/node_modules')) process.exit(86)
      } catch {}
    }
  }
  if (boundary === 'runtime-remove' && String(path).replaceAll('\\\\', '/').endsWith('/repo-audit/node_modules')) process.exit(86)
  return result
}
syncBuiltinESMExports()
`)
  f.env.NODE_OPTIONS = `--import=${JSON.stringify(hook)}`
}

async function editOnVersionCheck(f, directory, path, contents, check) {
  await writeFile(join(directory, 'node_modules/lavish-axi/dist/cli.mjs'), `import { readFileSync, writeFileSync } from 'node:fs'
const counter = ${JSON.stringify(join(f.directory, 'version-check-count'))}
let count = 0
try { count = Number(readFileSync(counter, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
writeFileSync(counter, String(++count))
if (count === ${check}) writeFileSync(${JSON.stringify(path)}, ${JSON.stringify(contents)})
console.log('0.1.78')
`)
}

for (const path of ['current.md', 'SKILL.md', 'retired.md']) {
  test(`completion blocks a late update edit to ${path} with an actionable decision`, async t => {
    const f = await lifecycle(t)
    await editOnVersionCheck(f, f.destination, join(f.destination, path), 'Late user edit\n', 2)
    const result = f.run(...f.args)
    assert.equal(result.status, 2, result.stdout)
    const report = result.value.data.installations[0]
    assert.equal(report.sourceVersion, 'mixed')
    const conflict = report.conflicts.find(conflict => conflict.path === path)
    assert.match(conflict.diff, /-Late user edit/)
    assert.equal(await readFile(join(f.destination, path), 'utf8'), 'Late user edit\n')
    const ownership = JSON.parse(await readFile(f.ownership, 'utf8'))
    assert.equal(ownership.sourceVersion, 'mixed')
    assert.equal(Object.hasOwn(ownership.files, path), true)
    await writeFile(join(f.destination, 'node_modules/lavish-axi/dist/cli.mjs'), "console.log('0.1.78')\n")
    const retried = f.run(...f.args, ...conflict.decision.split(' '))
    assert.equal(retried.status, 0, retried.stdout)
    assert.equal(retried.value.data.installations[0].sourceVersion, 'v0.0.2')
  })
}

test('completion blocks runtime drift during final version verification', async t => {
  const f = await lifecycle(t)
  await editOnVersionCheck(f, f.destination, join(f.destination, 'node_modules/lavish-axi/package.json'), JSON.stringify({ version: '0.2.0' }), 2)
  const result = f.run(...f.args)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.runtime.version, '0.2.0')
  assert.equal(report.runtime.verified, false)
  assert.equal(report.conflicts[0].path, 'node_modules')
  assert.match(report.conflicts[0].decision, /restore the pinned runtime/)
})

test('completion blocks first-copy edits after activation', async t => {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'copy-edit')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.conflicts[0].path, 'SKILL.md')
  assert.match(report.conflicts[0].diff, /-Late user edit/)
  assert.equal(JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install.json'), 'utf8')).fileVersions['package.json'], 'v0.0.1')
  delete f.env.NODE_OPTIONS
  const retried = f.run(...args, ...report.conflicts[0].decision.split(' '))
  assert.equal(retried.status, 0)
  assert.equal(retried.value.data.installations[0].fileVersions['package.json'], 'v0.0.1')
})

for (const boundary of ['prepared', 'activated']) {
  test(`completion blocks resumed-copy edits after ${boundary}`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const parent = join(f.project, '.agents/skills')
    const destination = join(parent, 'repo-audit')
    const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
    await editOnVersionCheck(f, boundary === 'prepared' ? journal.stage : destination, join(destination, 'SKILL.md'), 'Late user edit\n', 3)
    const result = f.run(...args)
    assert.equal(result.status, 2, result.stdout)
    const report = result.value.data.installations[0]
    assert.equal(report.sourceVersion, 'mixed')
    assert.equal(report.conflicts[0].path, 'SKILL.md')
    assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), 'Late user edit\n')
    assert.equal(JSON.parse(await readFile(join(parent, '.bstack-install.json'), 'utf8')).fileVersions['package.json'], 'v0.0.1')
    const retried = f.run(...args, ...report.conflicts[0].decision.split(' '))
    assert.equal(retried.status, 0)
    assert.equal(retried.value.data.installations[0].fileVersions['package.json'], 'v0.0.1')
  })
}

test('completion retains ownership for a file recreated during uninstall', async t => {
  const f = await lifecycle(t)
  await interrupt(f, 'ownership-edit')
  const result = f.run(...f.args, '--uninstall')
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.conflicts[0].path, 'current.md')
  assert.deepEqual(report.retained, ['current.md'])
  assert.equal(await readFile(join(f.destination, 'current.md'), 'utf8'), 'Late user edit\n')
  assert.deepEqual(Object.keys(JSON.parse(await readFile(f.ownership, 'utf8')).files), ['current.md'])
  delete f.env.NODE_OPTIONS
  assert.equal(f.run(...f.args, '--uninstall', ...report.conflicts[0].decision.split(' ')).status, 0)
})

test('completion blocks edits during repeat-install runtime verification', async t => {
  const f = await lifecycle(t)
  assert.equal(f.run(...f.args).status, 0)
  const legacy = JSON.parse(await readFile(f.ownership, 'utf8'))
  delete legacy.fileVersions
  await writeFile(f.ownership, JSON.stringify(legacy))
  await editOnVersionCheck(f, f.destination, join(f.destination, 'current.md'), 'Late user edit\n', 1)
  const result = f.run(...f.args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.data.installations[0].sourceVersion, 'mixed')
  assert.equal(result.value.data.installations[0].conflicts[0].path, 'current.md')
  assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).sourceVersion, 'mixed')
  assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).fileVersions['package.json'], 'v0.0.2')
  const retried = f.run(...f.args, ...result.value.data.installations[0].conflicts[0].decision.split(' '))
  assert.equal(retried.status, 0)
  assert.equal(retried.value.data.installations[0].fileVersions['package.json'], 'v0.0.2')
})

test('uninstall preserves a runtime recreated after interrupted removal', async t => {
  const f = await lifecycle(t)
  await interrupt(f, 'runtime-remove')
  assert.equal(f.run(...f.args, '--uninstall').status, 86)
  delete f.env.NODE_OPTIONS
  await mkdir(join(f.destination, 'node_modules'))
  await writeFile(join(f.destination, 'node_modules/keep.txt'), 'Replacement runtime\n')
  const resumed = f.run(...f.args, '--uninstall')
  assert.equal(resumed.status, 2, resumed.stdout)
  assert.equal(resumed.value.problems[0].code, 'runtime-conflict')
  assert.equal(resumed.value.data.installations[0].runtime.created, false)
  assert.equal(await readFile(join(f.destination, 'node_modules/keep.txt'), 'utf8'), 'Replacement runtime\n')
  await lstat(f.journal)
})

for (const host of ['agents', 'all']) {
  for (const boundary of ['partial-backup', 'approved-file-rename']) {
    for (const edited of [false, true]) {
      test(`activated copy repair ${edited ? 'rejects later edits' : 'replays approval'} after ${boundary} for ${host}`, async t => {
        const f = await fixture(t)
        const args = ['--scope', 'project', '--project', f.project, '--host', host]
        await interrupt(f, 'copy-rename')
        assert.equal(f.run(...args).status, 86)
        delete f.env.NODE_OPTIONS
        if (host === 'all') {
          await interrupt(f, 'staging')
          assert.equal(f.run('--scope', 'project', '--project', f.project, '--host', 'agents').status, 86)
          delete f.env.NODE_OPTIONS
        }
        const parent = join(f.project, host === 'all' ? '.claude/skills' : '.agents/skills')
        const destination = join(parent, 'repo-audit')
        await writeFile(join(destination, 'SKILL.md'), 'Approved user edit\n')
        const blocked = f.run(...args)
        assert.equal(blocked.status, 2, blocked.stdout)
        const conflict = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md')
        const approvedArgs = [...args, ...conflict.decision.split(' ')]
        await interrupt(f, boundary)
        assert.equal(f.run(...approvedArgs).status, 86)
        delete f.env.NODE_OPTIONS
        await assert.rejects(lstat(join(parent, '.bstack-install.json')), { code: 'ENOENT' })
        const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
        const backup = journal.backup
        if (edited) {
          await writeFile(join(destination, 'SKILL.md'), 'Later user edit\n')
          const before = await inventory(f.project)
          const rejected = f.run(...approvedArgs)
          assert.equal(rejected.status, 3, rejected.stdout)
          assert.equal(rejected.value.problems[0].code, 'stale-replacement')
          const report = rejected.value.data.installations[0]
          assert.equal(report.sourceVersion, 'mixed')
          assert.equal(report.backup, backup)
          assert.equal(report.files['SKILL.md'], createHash('sha256').update('Later user edit\n').digest('hex'))
          const current = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
          assert.equal(current.actualHash, report.files['SKILL.md'])
          assert.equal(current.proposedHash, conflict.proposedHash)
          assert.ok(current.diff.includes('-Later user edit\n'))
          assert.equal(current.decision, `--replace ${host === 'all' ? 'claude' : 'agents'}:SKILL.md:${report.files['SKILL.md']}`)
          if (host === 'all') {
            assert.equal(rejected.value.data.installations[1].sourceVersion, 'not-installed')
            assert.deepEqual(rejected.value.data.installations[1].conflicts, [])
          }
          assert.deepEqual(await inventory(f.project), before)
        } else {
          const resumed = f.run(...approvedArgs)
          assert.equal(resumed.status, 0, resumed.stdout)
          assert.equal(resumed.value.data.installations.length, host === 'all' ? 2 : 1)
          assert.equal(await readFile(join(backup, 'SKILL.md'), 'utf8'), 'Approved user edit\n')
          assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
          const record = JSON.parse(await readFile(join(parent, '.bstack-install.json'), 'utf8'))
          assert.equal(record.files['SKILL.md'], conflict.proposedHash)
          for (const report of resumed.value.data.installations) assert.equal(report.sourceVersion, record.sourceVersion)
        }
      })
    }
  }
}

for (const uninstall of [false, true]) {
  test(`${uninstall ? 'uninstall' : 'update'} preserves a replacement runtime directory`, async t => {
    const f = await lifecycle(t)
    await rename(join(f.destination, 'node_modules'), join(f.project, 'original-runtime'))
    await mkdir(join(f.destination, 'node_modules'))
    await writeFile(join(f.destination, 'node_modules/keep.txt'), 'Replacement runtime\n')
    const result = f.run(...f.args, ...(uninstall ? ['--uninstall'] : []))
    assert.equal(result.status, 2, result.stdout)
    assert.equal(result.value.data.installations[0].runtime.created, false)
    assert.equal(await readFile(join(f.destination, 'node_modules/keep.txt'), 'utf8'), 'Replacement runtime\n')
  })
}

for (const operation of ['update', 'uninstall', 'first copy']) {
  test(`${operation} recovery rejects a changed canonical destination`, async t => {
    const f = operation === 'first copy' ? await fixture(t) : await lifecycle(t)
    const args = operation === 'first copy' ? ['--scope', 'project', '--project', f.project, '--host', 'agents'] : f.args
    await interrupt(f, operation === 'first copy' ? 'activated' : 'applying')
    assert.equal(f.run(...args, ...(operation === 'uninstall' ? ['--uninstall'] : [])).status, 86)
    delete f.env.NODE_OPTIONS
    const destination = join(f.project, '.agents/skills/repo-audit')
    const replacement = join(f.project, 'replacement')
    await rename(destination, replacement)
    await symlink(replacement, destination, process.platform === 'win32' ? 'junction' : 'dir')
    const before = await inventory(replacement)
    const result = f.run(...args, ...(operation === 'uninstall' ? ['--uninstall'] : []))
    assert.equal(result.status, 2, result.stdout)
    assert.equal(result.value.problems[0].code, 'changed-destination')
    assert.deepEqual(await inventory(replacement), before)
  })
}

test('update recovery preserves a replacement previous runtime in its stage', async t => {
  const f = await lifecycle(t)
  await rm(join(f.destination, 'node_modules/lavish-axi/dist/cli.mjs'))
  await interrupt(f, 'runtime-backup')
  assert.equal(f.run(...f.args).status, 86)
  delete f.env.NODE_OPTIONS
  const journal = JSON.parse(await readFile(f.journal, 'utf8'))
  const previous = join(journal.stage, 'previous-runtime')
  await rename(previous, join(f.project, 'original-runtime'))
  await mkdir(previous)
  await writeFile(join(previous, 'keep.txt'), 'Stage replacement\n')
  const result = f.run(...f.args)
  assert.equal(result.status, 0, result.stdout)
  assert.equal(result.value.data.installations[0].retainedStage, journal.stage)
  assert.equal(await readFile(join(previous, 'keep.txt'), 'utf8'), 'Stage replacement\n')
})

test('prepared copy recovery preserves a replacement staged runtime', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'prepared')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const journal = JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install-journal.json'), 'utf8'))
  const runtime = join(journal.stage, 'node_modules')
  const original = join(f.project, 'original-runtime')
  await rename(runtime, original)
  await cp(original, runtime, { recursive: true })
  await writeFile(join(runtime, 'keep.txt'), 'Stage replacement\n')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'runtime-conflict')
  assert.equal(await readFile(join(runtime, 'keep.txt'), 'utf8'), 'Stage replacement\n')
})

test('legacy runtime ownership does not adopt a directory without identity', async t => {
  const f = await legacyInstallation(t)
  await writeFile(join(f.destination, 'node_modules/keep.txt'), 'Legacy content\n')
  const result = f.run(...f.args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.data.installations[0].runtime.created, false)
  assert.equal(await readFile(join(f.destination, 'node_modules/keep.txt'), 'utf8'), 'Legacy content\n')
  assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).runtime.identity, undefined)
})

for (const operation of ['repeat', 'update', 'uninstall']) {
  test(`legacy runtime decision enables C25a ${operation}`, async t => {
    const f = await legacyInstallation(t)
    if (operation === 'update') {
      await writeFile(join(f.source, 'new.md'), 'Version two\n')
      f.git('add', '.')
      f.git('commit', '-m', 'new release')
      f.git('tag', 'v0.0.2')
    }
    const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
    const before = await inventory(f.project)
    const preview = f.run(...args, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.deepEqual(await inventory(f.project), before)
    const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === 'node_modules').decision.split(' ')
    assert.equal(decision[0], '--adopt-runtime')
    const approvedPreview = f.run(...args, ...decision, '--dry-run')
    assert.equal(approvedPreview.status, 0, approvedPreview.stdout)
    assert.equal(approvedPreview.value.data.changes.some(change => change.action === 'runtime-adopt'), true)
    assert.deepEqual(await inventory(f.project), before)
    const result = f.run(...args, ...decision)
    assert.equal(result.status, 0, result.stdout)
    assert.equal(result.value.data.installations[0].sourceVersion, operation === 'uninstall' ? 'uninstalled' : operation === 'update' ? 'v0.0.2' : 'v0.0.1')
    if (operation === 'uninstall') await assert.rejects(lstat(f.destination), { code: 'ENOENT' })
    else assert.equal(result.value.data.installations[0].runtime.created, true)
    const repeated = f.run(...args)
    assert.equal(repeated.status, 0, repeated.stdout)
    assert.deepEqual(repeated.value.data.changes, [])
  })
}

for (const change of ['replacement', 'content', 'invalid version']) {
  test(`legacy runtime decision rejects stale ${change} and preserves content`, async t => {
    const f = await legacyInstallation(t)
    const preview = f.run(...f.args, '--dry-run')
    const decision = preview.value.data.destinations[0].conflicts[0].decision.split(' ')
    if (change === 'replacement') {
      await rename(join(f.destination, 'node_modules'), join(f.project, 'original-runtime'))
      await cp(join(f.project, 'original-runtime'), join(f.destination, 'node_modules'), { recursive: true })
    }
    if (change === 'invalid version') await writeFile(join(f.destination, 'node_modules/lavish-axi/dist/cli.mjs'), "console.log('changed')\n")
    if (change !== 'replacement') await writeFile(join(f.destination, 'node_modules/keep.txt'), 'User content\n')
    const before = await inventory(f.project)
    const result = f.run(...f.args, ...decision)
    assert.equal(result.status, 3, result.stdout)
    assert.equal(result.value.problems[0].code, 'stale-runtime-decision')
    assert.deepEqual(await inventory(f.project), before)
  })
}

for (const operation of ['replacement', 'obsolete removal', 'uninstall']) {
  test(`partial backup resumes an approved ${operation} from verified original bytes`, async t => {
    const f = await lifecycle(t)
    const path = operation === 'obsolete removal' ? 'retired.md' : 'current.md'
    await writeFile(join(f.destination, path), 'Approved user content\n')
    const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
    const preview = f.run(...args, '--dry-run')
    const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === path).decision.split(' ')
    await interrupt(f, 'partial-backup')
    assert.equal(f.run(...args, ...decision).status, 86)
    delete f.env.NODE_OPTIONS
    const journal = JSON.parse(await readFile(f.journal, 'utf8'))
    const backup = join(journal.backup, path)
    assert.equal(await readFile(backup, 'utf8'), 'Approved us')
    const result = f.run(...args, ...decision)
    assert.equal(result.status, 0, result.stdout)
    assert.equal(await readFile(backup, 'utf8'), 'Approved user content\n')
    if (operation === 'replacement') assert.equal(await readFile(join(f.destination, path), 'utf8'), 'Version two\n')
    else await assert.rejects(lstat(join(f.destination, path)), { code: 'ENOENT' })
  })
}

test('legacy runtime adoption rechecks content before saving ownership', async t => {
  const f = await legacyInstallation(t)
  await editOnVersionCheck(f, f.destination, join(f.destination, 'node_modules/keep.txt'), 'Late runtime edit\n', 3)
  const preview = f.run(...f.args, '--dry-run')
  const decision = preview.value.data.destinations[0].conflicts[0].decision.split(' ')
  const result = f.run(...f.args, ...decision)
  assert.equal(result.status, 3, result.stdout)
  assert.equal(result.value.problems[0].code, 'stale-runtime-decision')
  assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).runtime.identity, undefined)
  assert.equal(await readFile(join(f.destination, 'node_modules/keep.txt'), 'utf8'), 'Late runtime edit\n')
})

test('partial backup recovery preserves changed backup content', async t => {
  const f = await lifecycle(t)
  await writeFile(join(f.destination, 'current.md'), 'Approved user content\n')
  const preview = f.run(...f.args, '--dry-run')
  const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === 'current.md').decision.split(' ')
  await interrupt(f, 'partial-backup')
  assert.equal(f.run(...f.args, ...decision).status, 86)
  delete f.env.NODE_OPTIONS
  const journal = JSON.parse(await readFile(f.journal, 'utf8'))
  const backup = join(journal.backup, 'current.md')
  await writeFile(backup, 'User backup edit\n')
  const result = f.run(...f.args, ...decision)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'backup-changed')
  assert.equal(await readFile(backup, 'utf8'), 'User backup edit\n')
  assert.equal(await readFile(join(f.destination, 'current.md'), 'utf8'), 'Approved user content\n')
  await lstat(f.journal)
})

for (const [operation, boundary] of [
  ['repeat', 'ownership-adopt'],
  ['update', 'ownership-adopt'], ['update', 'staging'], ['update', 'prepared'],
  ['update', 'applying'], ['update', 'partial-backup'], ['update', 'approved-file-rename'],
  ['uninstall', 'ownership-adopt'], ['uninstall', 'applying'], ['uninstall', 'partial-backup'], ['uninstall', 'runtime-remove']
]) {
  test(`legacy ${operation} replays its exact approved command after ${boundary}`, async t => {
    const f = await legacyInstallation(t)
    if (operation !== 'repeat') await writeFile(join(f.destination, 'SKILL.md'), 'Approved user content\n')
    const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
    const preview = f.run(...args, '--dry-run')
    const decisions = preview.value.data.destinations[0].conflicts.flatMap(conflict => conflict.decision.split(' '))
    const command = [...args, ...decisions]
    await interrupt(f, boundary)
    assert.equal(f.run(...command).status, 86)
    delete f.env.NODE_OPTIONS
    const resumed = f.run(...command)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.installations[0].sourceVersion, operation === 'uninstall' ? 'uninstalled' : 'v0.0.1')
    if (operation !== 'uninstall') {
      assert.equal(await readFile(join(f.destination, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
      assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).acceptedAdoption, undefined)
      assert.equal(f.run(...command).status, 3)
    }
  })
}

for (const [operation, boundary] of [
  ['repeat', 'agents-ownership-adopt'], ['update', 'agents-staging'], ['update', 'agents-applying'], ['uninstall', 'agents-applying']
]) {
  test(`cross-host ${operation} replays both hosts' decisions after ${boundary}`, async t => {
    const f = await legacyInstallation(t, 'all')
    const claude = join(f.project, '.claude/skills/repo-audit')
    if (operation !== 'repeat') {
      await writeFile(join(claude, 'SKILL.md'), 'Approved user content\n')
      await writeFile(join(f.destination, 'SKILL.md'), 'Approved user content\n')
    }
    await writeFile(join(claude, 'keep.txt'), 'Unowned Claude content\n')
    await writeFile(join(f.destination, 'keep.txt'), 'Unowned agents content\n')
    const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
    const preview = f.run(...args, '--dry-run')
    const decisions = preview.value.data.destinations.flatMap(entry => entry.conflicts.flatMap(conflict => conflict.decision.split(' ')))
    await interrupt(f, boundary)
    assert.equal(f.run(...args, ...decisions).status, 86)
    delete f.env.NODE_OPTIONS
    const result = f.run(...args, ...decisions)
    assert.equal(result.status, 0, result.stdout)
    assert.deepEqual(result.value.data.installations.map(entry => entry.sourceVersion), [operation === 'uninstall' ? 'uninstalled' : 'v0.0.1', operation === 'uninstall' ? 'uninstalled' : 'v0.0.1'])
    assert.equal(await readFile(join(claude, 'keep.txt'), 'utf8'), 'Unowned Claude content\n')
    assert.equal(await readFile(join(f.destination, 'keep.txt'), 'utf8'), 'Unowned agents content\n')
    await assert.rejects(lstat(join(f.project, '.claude/skills/.bstack-install-journal.json')), { code: 'ENOENT' })
    await assert.rejects(lstat(join(f.project, '.agents/skills/.bstack-install-journal.json')), { code: 'ENOENT' })
  })
}

for (const change of ['file', 'runtime']) {
  test(`cross-host replay rejects a changed completed host ${change}`, async t => {
    const f = await legacyInstallation(t, 'all')
    const claude = join(f.project, '.claude/skills/repo-audit')
    await writeFile(join(claude, 'SKILL.md'), 'Approved user content\n')
    await writeFile(join(f.destination, 'SKILL.md'), 'Approved user content\n')
    const preview = f.run(...f.args, '--dry-run')
    const decisions = preview.value.data.destinations.flatMap(entry => entry.conflicts.flatMap(conflict => conflict.decision.split(' ')))
    await interrupt(f, 'agents-staging')
    assert.equal(f.run(...f.args, ...decisions).status, 86)
    delete f.env.NODE_OPTIONS
    await writeFile(join(claude, change === 'file' ? 'SKILL.md' : 'node_modules/keep.txt'), 'Later user content\n')
    const before = await inventory(f.project)
    const result = f.run(...f.args, ...decisions)
    assert.equal(result.status, 3, result.stdout)
    assert.equal(result.value.problems[0].code, change === 'file' ? 'stale-replacement' : 'stale-runtime-decision')
    assert.deepEqual(await inventory(f.project), before)
  })
}

for (const operation of ['upgrade', 'uninstall']) {
  for (const change of ['none', 'new content', 'edited content', 'replacement directory']) {
    test(`partial runtime deletion ${operation} recovers while preserving ${change}`, async t => {
      const f = await legacyInstallation(t)
      if (operation === 'upgrade') await upgradeRuntime(f)
      const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
      const decision = f.run(...args, '--dry-run').value.data.destinations[0].conflicts.find(conflict => conflict.path === 'node_modules').decision.split(' ')
      await interrupt(f, operation === 'upgrade' ? 'partial-runtime-cleanup' : 'partial-runtime-uninstall')
      assert.equal(f.run(...args, ...decision).status, 86)
      delete f.env.NODE_OPTIONS
      const journal = JSON.parse(await readFile(join(f.parent, '.bstack-install-journal.json'), 'utf8'))
      const path = operation === 'upgrade' ? join(journal.stage, 'previous-runtime') : join(f.destination, 'node_modules')
      await assert.rejects(lstat(join(path, 'lavish-axi/package.json')), { code: 'ENOENT' })
      if (change === 'new content') await writeFile(join(path, 'keep.txt'), 'Keep runtime\n')
      if (change === 'edited content') await writeFile(join(path, 'lavish-axi/dist/cli.mjs'), 'Keep runtime\n')
      if (change === 'replacement directory') {
        await rename(path, path + '-original')
        await mkdir(path)
        await writeFile(join(path, 'keep.txt'), 'Keep runtime\n')
      }
      const before = await inventory(path)
      const result = f.run(...args, ...decision)
      assert.equal(result.status, change === 'none' ? 0 : 2, result.stdout)
      if (change === 'none') await assert.rejects(lstat(path), { code: 'ENOENT' })
      else {
        assert.equal(result.value.problems[0].code, 'runtime-conflict')
        assert.deepEqual(await inventory(path), before)
        const withoutDecision = f.run(...args)
        assert.equal(withoutDecision.status, 2, withoutDecision.stdout)
        assert.deepEqual(await inventory(path), before)
      }
    })
  }
}

for (const kind of ['ownership', 'journal', 'cleanup']) {
  for (const length of ['empty', 'partial']) {
    test(`incomplete recovery writer ${kind} ${length} preserves source binding`, async t => {
      const f = await fixture(t)
      await writeFile(join(f.checkout, '.gitignore'), 'node_modules/\n.agents/skills/repo-audit/\n.agents/skills/.bstack-install.json\n')
      f.git('add', '.gitignore')
      f.git('commit', '-m', 'ignore fixture installations')
      f.git('tag', 'v0.0.1')
      const args = ['--scope', 'project', '--project', f.checkout, '--host', 'agents']
      assert.equal(f.run(...args).status, 0)
      await upgradeRuntime(f)
      await interrupt(f, `partial-writer:${kind}:${length}`)
      assert.equal(f.run(...args).status, 86)
      delete f.env.NODE_OPTIONS
      const parent = kind === 'cleanup' ? f.checkout : join(f.checkout, '.agents/skills')
      const temporary = (await readdir(parent)).find(name => name.startsWith('.bstack-recovery-') && name.endsWith('.tmp'))
      const bytes = await readFile(join(parent, temporary))
      assert.throws(() => JSON.parse(bytes.toString('utf8')))
      const result = f.run(...args)
      assert.equal(result.status, 0, result.stdout)
      assert.equal(result.value.data.sourceVersion, 'v0.0.2')
      await writeFile(join(parent, 'unrelated.txt'), 'Source drift\n')
      assert.match(f.run(...args, '--dry-run').value.data.sourceVersion, /:dirty$/)
    })
  }
}

test('failure snapshot retains unowned collisions when a later host fails', async t => {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'all']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.source, 'added.md'), 'New source\n')
  f.git('add', '.')
  f.git('commit', '-m', 'fixture update')
  f.git('tag', 'v0.0.2')
  const destination = join(f.project, '.claude/skills/repo-audit')
  await writeFile(join(destination, 'added.md'), 'Unowned collision\n')
  await interrupt(f, 'agents-stage-failure')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations.find(report => report.destination === destination)
  assert.equal(report.files['added.md'], createHash('sha256').update('Unowned collision\n').digest('hex'))
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.conflicts[0].path, 'added.md')
  const plain = command(process.execPath, [join(f.checkout, 'install/install.mjs'), ...args], f.project, f.env)
  assert.equal(plain.status, 2, plain.stdout)
  assert.ok(plain.stdout.includes(`file: added.md ${report.files['added.md']}`))
  assert.ok(plain.stdout.includes('installed state: mixed'))
  assert.ok(plain.stdout.includes(`Decision: ${report.conflicts[0].decision}`))
})

test('failure snapshot retains edited approved additions and recorded backups', async t => {
  const f = await lifecycle(t)
  await writeFile(join(f.destination, 'added.md'), 'Approved collision\n')
  const decision = f.run(...f.args, '--dry-run').value.data.destinations[0].conflicts.find(conflict => conflict.path === 'added.md').decision.split(' ')
  await interrupt(f, 'approved-addition-rename')
  assert.equal(f.run(...f.args, ...decision).status, 86)
  delete f.env.NODE_OPTIONS
  await writeFile(join(f.destination, 'added.md'), 'Edited addition\n')
  const journal = JSON.parse(await readFile(f.journal, 'utf8'))
  const result = f.run(...f.args, ...decision)
  assert.equal(result.status, 3, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.files['added.md'], createHash('sha256').update('Edited addition\n').digest('hex'))
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.backup, journal.backup)
  const conflict = report.conflicts.find(conflict => conflict.path === 'added.md')
  assert.equal(conflict.actualHash, report.files['added.md'])
  assert.equal(conflict.proposedHash, createHash('sha256').update('New package file\n').digest('hex'))
  assert.ok(conflict.diff.includes('-Edited addition\n'))
  assert.ok(conflict.diff.includes('+New package file\n'))
  assert.equal(conflict.decision, `--replace agents:added.md:${report.files['added.md']}`)
  assert.equal(await readFile(join(report.backup, 'added.md'), 'utf8'), 'Approved collision\n')
  const plain = command(process.execPath, [join(f.checkout, 'install/install.mjs'), ...f.args, ...decision], f.project, f.env)
  assert.equal(plain.status, 3, plain.stdout)
  assert.ok(plain.stdout.includes(`file: added.md ${report.files['added.md']}`))
  assert.ok(plain.stdout.includes(`backup: ${report.backup}`))
  assert.ok(plain.stdout.includes(conflict.diff))
  assert.ok(plain.stdout.includes(`Decision: ${conflict.decision}`))
  const approved = f.run(...f.args, ...conflict.decision.split(' '))
  assert.equal(approved.status, 0, approved.stdout)
  assert.equal(await readFile(join(approved.value.data.installations[0].backup, `added.md.${conflict.actualHash}`), 'utf8'), 'Edited addition\n')
  assert.equal(await readFile(join(f.destination, 'added.md'), 'utf8'), 'New package file\n')
})

test('failure conflict snapshot refreshes edited unowned collisions during runtime failure', async t => {
  const f = await fixture(t, true)
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.source, 'added.md'), 'Proposed addition\n')
  f.git('add', '.')
  f.git('commit', '-m', 'fixture update')
  f.git('tag', 'v0.0.2')
  const destination = join(f.project, '.agents/skills/repo-audit')
  await writeFile(join(destination, 'added.md'), 'Original collision\n')
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '1'
  assert.equal(f.run(...args).status, 1)
  await writeFile(join(destination, 'added.md'), 'Later collision\n')
  const result = f.run(...args)
  assert.equal(result.status, 1, result.stdout)
  const conflict = result.value.data.installations[0].conflicts.find(conflict => conflict.path === 'added.md')
  assert.equal(conflict.actualHash, createHash('sha256').update('Later collision\n').digest('hex'))
  assert.equal(conflict.ownedHash, null)
  assert.equal(conflict.proposedHash, createHash('sha256').update('Proposed addition\n').digest('hex'))
  assert.ok(conflict.diff.includes('-Later collision\n'))
  assert.ok(conflict.diff.includes('+Proposed addition\n'))
  assert.equal(conflict.decision, `--replace agents:added.md:${conflict.actualHash}`)
  const plain = command(process.execPath, [join(f.checkout, 'install/install.mjs'), ...args], f.project, f.env)
  assert.equal(plain.status, 1, plain.stdout)
  assert.ok(plain.stdout.includes(conflict.diff))
  assert.ok(plain.stdout.includes(`Decision: ${conflict.decision}`))
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  const approved = f.run(...args, ...conflict.decision.split(' '))
  assert.equal(approved.status, 0, approved.stdout)
  assert.equal(await readFile(join(approved.value.data.installations[0].backup, 'added.md'), 'utf8'), 'Later collision\n')
  assert.equal(await readFile(join(destination, 'added.md'), 'utf8'), 'Proposed addition\n')
})

for (const path of ['added.md', 'edited.md']) {
  test(`equal-byte ${path} ownership conflict requires its displayed decision`, async t => {
    const f = await lifecycle(t)
    const proposed = await readFile(join(f.source, path))
    await writeFile(join(f.destination, path), proposed)
    const blocked = f.run(...f.args)
    assert.equal(blocked.status, 2, blocked.stdout)
    const conflict = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === path)
    assert.equal(conflict.actualHash, conflict.proposedHash)
    const approved = f.run(...f.args, ...conflict.decision.split(' '))
    assert.equal(approved.status, 0, approved.stdout)
    assert.equal(approved.value.data.installations[0].sourceVersion, 'v0.0.2')
    assert.deepEqual(await readFile(join(approved.value.data.installations[0].backup, path)), proposed)
    const record = JSON.parse(await readFile(f.ownership, 'utf8'))
    assert.equal(record.files[path], conflict.proposedHash)
  })
}

for (const operation of ['update', 'copy repair']) {
  for (const host of ['claude', 'agents']) {
    for (const change of ['release', 'authored files']) {
      test(`pending ${operation} binds ${change} before either host mutates with ${host} recovery`, async t => {
        const f = await fixture(t)
        const args = ['--scope', 'project', '--project', f.project, '--host', 'all']
        f.git('tag', 'v0.0.1')
        if (operation === 'update') {
          assert.equal(f.run(...args).status, 0)
          await writeFile(join(f.source, 'current.md'), 'Version two\n')
          f.git('add', '.')
          f.git('commit', '-m', 'second release')
          f.git('tag', 'v0.0.2')
        } else {
          await interrupt(f, 'copy-rename')
          assert.equal(f.run('--scope', 'project', '--project', f.project, '--host', host).status, 86)
          delete f.env.NODE_OPTIONS
          await writeFile(join(f.project, `.${host}/skills/repo-audit/SKILL.md`), 'Approved user edit\n')
          const conflict = f.run(...args).value.data.installations.find(report => report.conflicts.length).conflicts[0]
          args.push(...conflict.decision.split(' '))
        }
        const revision = f.git('rev-parse', 'HEAD')
        await interrupt(f, host === 'agents' ? 'agents-applying' : 'applying')
        assert.equal(f.run(...args).status, 86)
        delete f.env.NODE_OPTIONS
        const before = await inventory(f.project)
        if (change === 'authored files') await writeFile(join(f.source, 'current.md'), 'Version three\n')
        f.git('add', '.')
        f.git('commit', '--allow-empty', '-m', 'third release')
        f.git('tag', 'v0.0.3')
        const rejected = f.run(...args)
        assert.equal(rejected.status, 2, rejected.stdout)
        assert.equal(rejected.value.problems[0].code, 'journal-source-changed')
        assert.deepEqual(await inventory(f.project), before)
        f.git('checkout', '--detach', revision)
        const resumed = f.run(...args)
        assert.equal(resumed.status, 0, resumed.stdout)
        assert.deepEqual(resumed.value.data.installations.map(report => report.sourceVersion), [operation === 'update' ? 'v0.0.2' : 'v0.0.1', operation === 'update' ? 'v0.0.2' : 'v0.0.1'])
      })
    }
  }
}

test('activated copy replacement preserves original source binding', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'copy-rename')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const destination = join(f.project, '.agents/skills/repo-audit')
  await writeFile(join(destination, 'SKILL.md'), 'User edit\n')
  const conflict = f.run(...args).value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md')
  const sourcePath = join(f.source, 'references/architecture.md')
  const original = await readFile(sourcePath)
  await writeFile(sourcePath, Buffer.concat([original, Buffer.from('\nChanged source\n')]))
  const before = await inventory(f.project)
  const rejected = f.run(...args, ...conflict.decision.split(' '))
  assert.equal(rejected.status, 2, rejected.stdout)
  assert.equal(rejected.value.problems[0].code, 'journal-source-changed')
  assert.deepEqual(await inventory(f.project), before)
  await writeFile(sourcePath, original)
  assert.equal(f.run(...args, ...conflict.decision.split(' ')).status, 0)
})

for (const boundary of ['staging', 'prepared', 'ownership', 'cleanup']) {
  test(`recovery writer temporary preserves tagged source binding at ${boundary}`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.checkout, '--host', 'agents']
    await interrupt(f, 'writer-' + boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const resumed = f.run(...args)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.sourceVersion, 'v0.0.1')
    const names = await readdir(boundary === 'cleanup' ? f.checkout : join(f.checkout, '.agents/skills'))
    assert.equal(names.some(name => name.endsWith('.tmp')), true)
    await writeFile(join(f.checkout, '.bstack-00000000-0000-0000-0000-000000000000.tmp'), 'Unrelated source\n')
    const changed = f.run(...args, '--dry-run')
    assert.equal(changed.status, 0, changed.stdout)
    assert.match(changed.value.data.sourceVersion, /:dirty$/)
  })
}

for (const edited of [false, true]) {
  test(`cleanup of an already-current host ${edited ? 'executes its displayed replacement decision' : 'resumes unchanged without a journal'}`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.project, '--host', 'all']
    assert.equal(f.run(...args).status, 0)
    await writeFile(join(f.source, 'current.md'), 'Version two\n')
    f.git('add', '.')
    f.git('commit', '-m', 'second release')
    f.git('tag', 'v0.0.2')
    assert.equal(f.run('--scope', 'project', '--project', f.project, '--host', 'claude').status, 0)
    const parent = join(f.project, '.claude/skills')
    const destination = join(parent, 'repo-audit')
    await assert.rejects(lstat(join(parent, '.bstack-install-journal.json')), { code: 'ENOENT' })
    const preview = f.run(...args, '--dry-run')
    assert.deepEqual(preview.value.data.destinations.map(entry => entry.action), ['no-op', 'update'])
    await writeFile(join(destination, 'unowned.txt'), 'Keep current-host content\n')
    await interrupt(f, edited ? 'earlier-host-edit' : 'cleanup-journal-agents')
    const result = f.run(...args)
    assert.equal(result.status, edited ? 2 : 86, result.stdout)
    delete f.env.NODE_OPTIONS
    const cleanup = JSON.parse(await readFile(join(f.project, '.bstack-install-cleanup.json'), 'utf8'))
    assert.equal(cleanup.entries[0].recovery, undefined)
    assert.equal(cleanup.entries[0].record.sourceVersion, 'v0.0.2')
    if (edited) {
      assert.equal(result.value.problems[0].code, 'cleanup-conflict')
      const report = result.value.data.installations.find(report => report.destination === destination)
      assert.equal(report.sourceVersion, 'mixed')
      const conflict = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
      assert.equal(conflict.decision, `--replace claude:SKILL.md:${createHash('sha256').update('Later host edit\n').digest('hex')}`)
      const before = await inventory(f.project)
      const repeated = f.run(...args)
      assert.equal(repeated.status, 2, repeated.stdout)
      assert.equal(repeated.value.problems[0].code, 'cleanup-conflict')
      assert.deepEqual(await inventory(f.project), before)
      const sibling = join(f.project, '.agents/skills/repo-audit')
      const siblingBefore = await inventory(sibling)
      await writeFile(join(destination, 'SKILL.md'), 'Newer edit\n')
      const staleBefore = await inventory(f.project)
      const stale = f.run(...args, ...conflict.decision.split(' '))
      assert.equal(stale.status, 3, stale.stdout)
      assert.equal(stale.value.problems[0].code, 'stale-replacement')
      assert.deepEqual(await inventory(f.project), staleBefore)
      await writeFile(join(destination, 'SKILL.md'), 'Later host edit\n')
      const dry = f.run(...args, ...conflict.decision.split(' '), '--dry-run')
      assert.equal(dry.status, 2, dry.stdout)
      assert.equal(dry.value.problems[0].code, 'cleanup-conflict')
      assert.deepEqual(await inventory(f.project), before)
      await rm(join(destination, 'current.md'))
      await interrupt(f, 'approved-file-rename')
      const interrupted = f.run(...args, ...conflict.decision.split(' '))
      assert.equal(interrupted.status, 86, interrupted.stdout)
      delete f.env.NODE_OPTIONS
      const pending = f.run(...args)
      assert.equal(pending.status, 2, pending.stdout)
      await assert.rejects(lstat(join(destination, 'current.md')), { code: 'ENOENT' })
      assert.deepEqual(await inventory(sibling), siblingBefore)
      const partial = pending.value.data.installations.find(report => report.destination === destination)
      assert.equal(await readFile(join(partial.backup, 'SKILL.md'), 'utf8'), 'Later host edit\n')
      const remaining = partial.conflicts.find(conflict => conflict.path === 'current.md')
      assert.equal(remaining.decision, '--replace claude:current.md:absent')
      const resolved = f.run(...args, ...remaining.decision.split(' '))
      assert.equal(resolved.status, 0, JSON.stringify({ status: resolved.status, code: resolved.value.problems[0]?.code }))
      assert.equal(await readFile(join(partial.backup, 'SKILL.md'), 'utf8'), 'Later host edit\n')
      assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
      assert.equal(await readFile(join(destination, 'current.md'), 'utf8'), 'Version two\n')
      assert.equal(await readFile(join(destination, 'unowned.txt'), 'utf8'), 'Keep current-host content\n')
      assert.deepEqual(await inventory(sibling), siblingBefore)
    } else {
      const resumed = f.run(...args)
      assert.equal(resumed.status, 0, resumed.stdout)
      assert.deepEqual(resumed.value.data.installations.map(report => report.sourceVersion), ['v0.0.2', 'v0.0.2'])
      await assert.rejects(lstat(join(f.project, '.bstack-install-cleanup.json')), { code: 'ENOENT' })
    }
  })
}

test('cross-host failure refreshes earlier actual state and preserves backup details', async t => {
  const f = await legacyInstallation(t, 'all')
  const claude = join(f.project, '.claude/skills/repo-audit')
  await writeFile(join(claude, 'SKILL.md'), 'Approved edit\n')
  await writeFile(join(f.source, 'current.md'), 'New release\n')
  f.git('add', '.')
  f.git('commit', '-m', 'fixture update')
  f.git('tag', 'v0.0.2')
  const preview = f.run(...f.args, '--dry-run')
  const decisions = preview.value.data.destinations.flatMap(entry => entry.conflicts.flatMap(conflict => conflict.decision.split(' ')))
  await interrupt(f, 'earlier-host-edit')
  const result = f.run(...f.args, ...decisions)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations.find(report => report.destination === claude)
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.files['SKILL.md'], createHash('sha256').update('Later host edit\n').digest('hex'))
  assert.equal(await readFile(join(report.backup, 'SKILL.md'), 'utf8'), 'Approved edit\n')
  const conflict = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
  assert.equal(conflict.actualHash, report.files['SKILL.md'])
  assert.ok(conflict.diff.includes('-Later host edit\n'))
  assert.equal(conflict.decision, `--replace claude:SKILL.md:${report.files['SKILL.md']}`)
  delete f.env.NODE_OPTIONS
  const repeated = f.run(...f.args, ...decisions)
  assert.equal(repeated.status, 3, repeated.stdout)
  const refreshed = repeated.value.data.installations.find(report => report.destination === claude)
  assert.equal(refreshed.files['SKILL.md'], report.files['SKILL.md'])
  assert.equal(refreshed.sourceVersion, 'mixed')
  assert.equal(refreshed.backup, report.backup)
  assert.deepEqual(refreshed.conflicts, report.conflicts)
  const currentDecisions = decisions.map(value => value.startsWith('claude:SKILL.md:') ? conflict.decision.slice('--replace '.length) : value)
  const resolved = f.run(...f.args, ...currentDecisions)
  assert.equal(resolved.status, 0, resolved.stdout)
  assert.equal(resolved.value.data.installations.find(report => report.destination === claude).sourceVersion, 'v0.0.2')
  assert.equal(await readFile(join(report.backup, 'SKILL.md'), 'utf8'), 'Approved edit\n')
  assert.equal(await readFile(join(report.backup, `SKILL.md.${conflict.actualHash}`), 'utf8'), 'Later host edit\n')
  assert.equal(await readFile(join(claude, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
})

test('cleanup failure reports recreated files after earlier ownership retirement', async t => {
  const f = await legacyInstallation(t, 'all')
  const claude = join(f.project, '.claude/skills/repo-audit')
  await writeFile(join(claude, 'keep.txt'), 'Unowned content\n')
  const args = [...f.args, '--uninstall']
  const decisions = f.run(...args, '--dry-run').value.data.destinations.flatMap(entry => entry.conflicts.flatMap(conflict => conflict.decision.split(' ')))
  await interrupt(f, 'cleanup-journal-claude')
  assert.equal(f.run(...args, ...decisions).status, 86)
  delete f.env.NODE_OPTIONS
  await writeFile(join(claude, 'SKILL.md'), 'Recreated content\n')
  const result = f.run(...args, ...decisions)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations.find(report => report.destination === claude)
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.files['SKILL.md'], createHash('sha256').update('Recreated content\n').digest('hex'))
  assert.equal(await readFile(join(claude, 'keep.txt'), 'utf8'), 'Unowned content\n')
  const conflict = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
  const resolved = f.run(...args, ...decisions, ...conflict.decision.split(' '))
  assert.equal(resolved.status, 0, resolved.stdout)
  const completed = resolved.value.data.installations.find(report => report.destination === claude)
  assert.equal(completed.sourceVersion, 'uninstalled')
  assert.equal(await readFile(join(completed.backup, `SKILL.md.${conflict.actualHash}`), 'utf8'), 'Recreated content\n')
  await assert.rejects(lstat(join(claude, 'SKILL.md')), { code: 'ENOENT' })
  await assert.rejects(lstat(join(f.project, '.claude/skills/.bstack-install.json')), { code: 'ENOENT' })
  assert.equal(await readFile(join(claude, 'keep.txt'), 'utf8'), 'Unowned content\n')
})

for (const operation of ['copy', 'update']) {
  for (const boundary of [operation === 'copy' ? 'cleanup-journal-agents' : 'cleanup-file-agents', 'cleanup-journal-claude']) {
    test(`cleanup ${operation} executes fresh decisions after ${boundary} and resumes interrupted approval`, async t => {
      const f = await fixture(t)
      f.git('tag', 'v0.0.1')
      const args = ['--scope', 'project', '--project', f.project, '--host', 'all']
      if (operation === 'update') {
        assert.equal(f.run(...args).status, 0)
        await writeFile(join(f.source, 'current.md'), 'New release\n')
        f.git('add', '.')
        f.git('commit', '-m', 'fixture update')
        f.git('tag', 'v0.0.2')
      }
      await interrupt(f, boundary)
      assert.equal(f.run(...args).status, 86)
      delete f.env.NODE_OPTIONS
      const destination = join(f.project, '.claude/skills/repo-audit')
      await writeFile(join(destination, 'SKILL.md'), 'First cleanup edit\n')
      await writeFile(join(destination, 'keep.txt'), 'Keep unrelated\n')
      const blocked = f.run(...args)
      assert.equal(blocked.status, 2, blocked.stdout)
      const decision = blocked.value.data.installations.find(report => report.destination === destination).conflicts[0].decision.split(' ')
      await writeFile(join(destination, 'SKILL.md'), 'Second cleanup edit\n')
      const before = await inventory(f.project)
      const stale = f.run(...args, ...decision)
      assert.equal(stale.status, 3, stale.stdout)
      assert.equal(stale.value.problems[0].code, 'stale-replacement')
      assert.deepEqual(await inventory(f.project), before)
      const current = stale.value.data.installations.find(report => report.destination === destination).conflicts[0]
      await interrupt(f, 'approved-file-rename')
      assert.equal(f.run(...args, ...current.decision.split(' ')).status, 86)
      delete f.env.NODE_OPTIONS
      const resumed = f.run(...args)
      assert.equal(resumed.status, 0, resumed.stdout)
      const report = resumed.value.data.installations.find(report => report.destination === destination)
      assert.equal(report.sourceVersion, operation === 'update' ? 'v0.0.2' : 'v0.0.1')
      assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
      assert.equal(await readFile(join(report.backup, 'SKILL.md'), 'utf8'), 'Second cleanup edit\n')
      assert.equal(await readFile(join(destination, 'keep.txt'), 'utf8'), 'Keep unrelated\n')
      await assert.rejects(lstat(join(f.project, '.bstack-install-cleanup.json')), { code: 'ENOENT' })
    })
  }
}

test('cleanup approval preserves an unapproved deletion until its own current decision', async t => {
  const f = await lifecycle(t)
  await interrupt(f, 'cleanup-file-agents')
  assert.equal(f.run(...f.args).status, 86)
  delete f.env.NODE_OPTIONS
  await writeFile(join(f.destination, 'SKILL.md'), 'Approved cleanup edit\n')
  const blocked = f.run(...f.args)
  const decision = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md').decision.split(' ')
  await rm(join(f.destination, 'added.md'))
  const repaired = f.run(...f.args, ...decision)
  assert.equal(repaired.status, 2, repaired.stdout)
  await assert.rejects(lstat(join(f.destination, 'added.md')), { code: 'ENOENT' })
  assert.equal(await readFile(join(f.destination, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
  const report = repaired.value.data.installations[0]
  assert.equal(await readFile(join(report.backup, 'SKILL.md'), 'utf8'), 'Approved cleanup edit\n')
  const current = report.conflicts.find(conflict => conflict.path === 'added.md')
  assert.equal(current.decision, '--replace agents:added.md:absent')
  const resolved = f.run(...f.args, ...current.decision.split(' '))
  assert.equal(resolved.status, 0, resolved.stdout)
  assert.equal(resolved.value.data.installations[0].sourceVersion, 'v0.0.2')
  assert.equal(await readFile(join(f.destination, 'added.md'), 'utf8'), 'New package file\n')
})

for (const [boundary, edited, flags] of [
  ['runtime-backup', false, true], ['runtime-rename', false, true],
  ['runtime-backup', true, true], ['runtime-rename', true, true], ['runtime-backup', true, false]
]) {
  test(`moved adoption ${edited ? 'preserves edits' : 'resumes'} after ${boundary} ${flags ? 'with' : 'without'} original flags`, async t => {
    const f = await legacyInstallation(t)
    await upgradeRuntime(f)
    const preview = f.run(...f.args, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === 'node_modules').decision.split(' ')
    await interrupt(f, boundary)
    assert.equal(f.run(...f.args, ...decision).status, 86)
    delete f.env.NODE_OPTIONS
    const journal = JSON.parse(await readFile(join(f.parent, '.bstack-install-journal.json'), 'utf8'))
    const old = join(journal.stage, 'previous-runtime')
    if (edited) await writeFile(join(old, 'keep.txt'), 'Moved runtime edit\n')
    const result = f.run(...f.args, ...(flags ? decision : []))
    assert.equal(result.status, edited ? flags ? 3 : 2 : 0, result.stdout)
    if (edited) {
      assert.equal(result.value.problems[0].code, flags ? 'stale-runtime-decision' : 'runtime-conflict')
      assert.equal(await readFile(join(old, 'keep.txt'), 'utf8'), 'Moved runtime edit\n')
    } else {
      assert.equal(result.value.data.installations[0].runtime.version, '0.1.79')
      await assert.rejects(lstat(old), { code: 'ENOENT' })
    }
  })
}

for (const [operation, boundary] of [
  ['update', 'cleanup-file-claude'], ['update', 'cleanup-file-agents'],
  ['update', 'cleanup-staged-runtime-claude'], ['update', 'cleanup-staged-runtime-agents'],
  ['update', 'cleanup-journal-claude'], ['update', 'cleanup-journal-agents'],
  ['upgrade', 'cleanup-runtime-claude'], ['upgrade', 'cleanup-runtime-agents'],
  ['repeat', 'cleanup-receipt-claude'], ['repeat', 'cleanup-receipt-agents'],
  ['uninstall', 'cleanup-ownership-claude'], ['uninstall', 'cleanup-ownership-agents'],
  ['uninstall', 'cleanup-journal-claude'], ['uninstall', 'cleanup-journal-agents'],
  ['update', 'cleanup-failure-agents']
]) {
  test(`command cleanup replays exact ${operation} flags after ${boundary}`, async t => {
    const f = await legacyInstallation(t, 'all')
    const claude = join(f.project, '.claude/skills/repo-audit')
    if (operation !== 'repeat') {
      await writeFile(join(claude, 'SKILL.md'), 'Approved user content\n')
      await writeFile(join(f.destination, 'SKILL.md'), 'Approved user content\n')
    }
    if (operation === 'upgrade') await upgradeRuntime(f)
    await writeFile(join(claude, 'keep.txt'), 'Unowned Claude content\n')
    await writeFile(join(f.destination, 'keep.txt'), 'Unowned agents content\n')
    const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
    const preview = f.run(...args, '--dry-run')
    const decisions = preview.value.data.destinations.flatMap(entry => entry.conflicts.flatMap(conflict => conflict.decision.split(' ')))
    await interrupt(f, boundary)
    const interrupted = f.run(...args, ...decisions)
    assert.equal(interrupted.status, boundary === 'cleanup-failure-agents' ? 2 : 86, interrupted.stdout)
    delete f.env.NODE_OPTIONS
    await lstat(join(f.project, '.bstack-install-cleanup.json'))
    const dryRun = f.run(...args, ...decisions, '--dry-run')
    assert.equal(dryRun.status, 0, dryRun.stdout)
    const resumed = f.run(...args, ...decisions)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.deepEqual(resumed.value.data.installations.map(entry => entry.sourceVersion), Array(2).fill(operation === 'uninstall' ? 'uninstalled' : operation === 'upgrade' ? 'v0.0.2' : 'v0.0.1'))
    assert.equal(await readFile(join(claude, 'keep.txt'), 'utf8'), 'Unowned Claude content\n')
    assert.equal(await readFile(join(f.destination, 'keep.txt'), 'utf8'), 'Unowned agents content\n')
    await assert.rejects(lstat(join(f.project, '.bstack-install-cleanup.json')), { code: 'ENOENT' })
    await assert.rejects(lstat(join(f.project, '.claude/skills/.bstack-install-journal.json')), { code: 'ENOENT' })
    await assert.rejects(lstat(join(f.project, '.agents/skills/.bstack-install-journal.json')), { code: 'ENOENT' })
    if (operation !== 'uninstall') {
      assert.equal(JSON.parse(await readFile(join(f.project, '.claude/skills/.bstack-install.json'), 'utf8')).acceptedAdoption, undefined)
      assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).acceptedAdoption, undefined)
    }
  })
}

for (const change of ['installed file', 'moved runtime']) {
  test(`command cleanup rejects changed ${change} after earlier host cleanup`, async t => {
    const f = await legacyInstallation(t, 'all')
    await writeFile(join(f.project, '.claude/skills/repo-audit/SKILL.md'), 'Approved user content\n')
    await writeFile(join(f.destination, 'SKILL.md'), 'Approved user content\n')
    await upgradeRuntime(f)
    const preview = f.run(...f.args, '--dry-run')
    const decisions = preview.value.data.destinations.flatMap(entry => entry.conflicts.flatMap(conflict => conflict.decision.split(' ')))
    await interrupt(f, 'cleanup-journal-claude')
    assert.equal(f.run(...f.args, ...decisions).status, 86)
    delete f.env.NODE_OPTIONS
    const cleanup = JSON.parse(await readFile(join(f.project, '.bstack-install-cleanup.json'), 'utf8'))
    const path = change === 'installed file' ? join(f.project, '.claude/skills/repo-audit/SKILL.md') : join(cleanup.entries[1].recovery.stage, 'previous-runtime/keep.txt')
    await writeFile(path, 'Later user content\n')
    const before = await inventory(f.project)
    const result = f.run(...f.args, ...decisions)
    assert.equal(result.status, 3, result.stdout)
    assert.equal(result.value.problems[0].code, change === 'installed file' ? 'stale-replacement' : 'stale-runtime-decision')
    assert.deepEqual(await inventory(f.project), before)
  })
}

test('moved adoption preserves edits detected at final cleanup', async t => {
  const f = await legacyInstallation(t)
  await upgradeRuntime(f)
  const preview = f.run(...f.args, '--dry-run')
  const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === 'node_modules').decision.split(' ')
  await interrupt(f, 'moved-cleanup-edit')
  const result = f.run(...f.args, ...decision)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'runtime-conflict')
  const journal = JSON.parse(await readFile(join(f.parent, '.bstack-install-journal.json'), 'utf8'))
  assert.equal(await readFile(join(journal.stage, 'previous-runtime/keep.txt'), 'utf8'), 'Cleanup runtime edit\n')
  assert.equal(result.value.data.installations[0].runtime.version, '0.1.79')
})

for (const change of ['approved file', 'runtime content', 'runtime identity', 'source']) {
  test(`approved command replay rejects changed ${change} after staging`, async t => {
    const f = await legacyInstallation(t)
    await writeFile(join(f.destination, 'SKILL.md'), 'Approved user content\n')
    const preview = f.run(...f.args, '--dry-run')
    const decisions = preview.value.data.destinations[0].conflicts.flatMap(conflict => conflict.decision.split(' '))
    await interrupt(f, 'staging')
    assert.equal(f.run(...f.args, ...decisions).status, 86)
    delete f.env.NODE_OPTIONS
    if (change === 'approved file') await writeFile(join(f.destination, 'SKILL.md'), 'Later user content\n')
    if (change === 'runtime content') await writeFile(join(f.destination, 'node_modules/keep.txt'), 'Later runtime content\n')
    if (change === 'runtime identity') {
      await rename(join(f.destination, 'node_modules'), join(f.project, 'original-runtime'))
      await cp(join(f.project, 'original-runtime'), join(f.destination, 'node_modules'), { recursive: true })
    }
    if (change === 'source') await writeFile(join(f.source, 'new.md'), 'Later source\n')
    const before = await inventory(f.project)
    const result = f.run(...f.args, ...decisions)
    assert.equal(result.status, change === 'source' ? 2 : 3, result.stdout)
    assert.equal(result.value.problems[0].code, change === 'source' ? 'journal-source-changed' : change === 'approved file' ? 'stale-replacement' : 'stale-runtime-decision')
    assert.deepEqual(await inventory(f.project), before)
  })
}

for (const boundary of ['staging', 'prepared', 'copy-rename', 'activated', 'completed']) {
  test(`first copy resumes after interruption at ${boundary} using actual hashes`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const parent = join(f.project, '.agents/skills')
    const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
    const actual = ['activated', 'completed', 'copy-rename'].includes(boundary) ? join(parent, 'repo-audit') : journal.stage
    await writeFile(join(actual, 'unrelated.txt'), 'Unrelated\n')
    const before = await inventory(f.project)
    assert.equal(f.run(...args, '--dry-run').status, 0)
    assert.deepEqual(await inventory(f.project), before)
    const resumed = f.run(...args)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(await readFile(join(parent, 'repo-audit/unrelated.txt'), 'utf8'), 'Unrelated\n')
    assert.equal((await readdir(parent)).includes('.bstack-install-journal.json'), false)
    assert.equal(f.run(...args).status, 0)
  })
}

for (const boundary of ['applying', 'partial-temp', 'file-rename', 'runtime-backup', 'runtime-rename']) {
  test(`update resumes after interruption at ${boundary} without repeating completed mutations`, async t => {
    const f = await lifecycle(t)
    if (boundary.startsWith('runtime-')) await rm(join(f.destination, 'node_modules/lavish-axi/dist/cli.mjs'))
    await interrupt(f, boundary)
    assert.equal(f.run(...f.args).status, 86)
    delete f.env.NODE_OPTIONS
    await writeFile(join(f.destination, 'unrelated.txt'), 'Keep\n')
    if (boundary === 'applying') {
      const journal = JSON.parse(await readFile(f.journal, 'utf8'))
      await writeFile(join(journal.stage, 'unrelated.txt'), 'Staged user content\n')
    }
    const beforePreview = await inventory(f.project)
    const preview = f.run(...f.args, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.deepEqual(await inventory(f.project), beforePreview)
    if (boundary === 'file-rename') assert.equal(preview.value.data.changes.some(change => change.action === 'replace' && change.path.endsWith('/current.md')), false)
    const resumed = f.run(...f.args)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.installations[0].sourceVersion, 'v0.0.2')
    assert.equal(await readFile(join(f.destination, 'current.md'), 'utf8'), 'Version two\n')
    assert.equal(await readFile(join(f.destination, 'unrelated.txt'), 'utf8'), 'Keep\n')
    if (boundary === 'applying') assert.equal(await readFile(join(resumed.value.data.installations[0].retainedStage, 'unrelated.txt'), 'utf8'), 'Staged user content\n')
    else assert.equal((await readdir(f.parent)).some(path => path.startsWith('.bstack-stage-')), false)
  })
}

for (const boundary of ['copy-rename', 'activated', 'completed']) {
  test(`edited activated copy reports actual state after ${boundary}`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const destination = join(f.project, '.agents/skills/repo-audit')
    await writeFile(join(destination, 'SKILL.md'), 'User edit\n')
    const before = await inventory(f.project)
    for (const preview of [true, false]) {
      const result = f.run(...args, ...(preview ? ['--dry-run'] : []))
      assert.equal(result.status, 2, result.stdout)
      const report = result.value.data.installations[0]
      assert.equal(report.sourceVersion, 'mixed')
      assert.equal(report.files['SKILL.md'], createHash('sha256').update('User edit\n').digest('hex'))
      assert.equal(report.runtime.version, '0.1.78')
      assert.equal(report.runtime.verified, true)
      const conflict = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
      assert.equal(conflict.actualHash, report.files['SKILL.md'])
      assert.equal(conflict.proposedHash, createHash('sha256').update(await readFile(join(f.source, 'SKILL.md'))).digest('hex'))
      assert.ok(conflict.diff.includes('-User edit\n'))
      assert.equal(conflict.decision, `--replace agents:SKILL.md:${report.files['SKILL.md']}`)
      assert.deepEqual(await inventory(f.project), before)
    }
    const blocked = f.run(...args)
    const conflict = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md')
    const approved = f.run(...args, ...conflict.decision.split(' '))
    assert.equal(approved.status, 0, approved.stdout)
    assert.equal(await readFile(join(approved.value.data.installations[0].backup, 'SKILL.md'), 'utf8'), 'User edit\n')
    const record = JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install.json'), 'utf8'))
    assert.equal(record.files['SKILL.md'], conflict.proposedHash)
  })
}

for (const uninstall of [false, true]) {
  test(`blocked ${uninstall ? 'uninstall' : 'update'} reports actual replacement runtime`, async t => {
    const f = await lifecycle(t)
    const runtime = join(f.project, 'other-runtime')
    await mkdir(join(runtime, 'lavish-axi/dist'), { recursive: true })
    await writeFile(join(runtime, 'lavish-axi/package.json'), JSON.stringify({ version: '0.2.0' }))
    await writeFile(join(runtime, 'lavish-axi/dist/cli.mjs'), "console.log('0.2.0')\n")
    await rm(join(f.destination, 'node_modules'), { recursive: true })
    await symlink(runtime, join(f.destination, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const result = f.run(...f.args, ...(uninstall ? ['--uninstall'] : []))
    assert.equal(result.status, 2, result.stdout)
    const report = result.value.data.installations[0]
    assert.equal(report.sourceVersion, 'mixed')
    assert.equal(report.runtime.version, '0.2.0')
    assert.equal(report.runtime.verified, true)
    assert.equal(report.runtime.created, false)
    assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).runtime.version, '0.1.78')
    assert.equal(await readlink(join(f.destination, 'node_modules')), runtime)
  })
}

for (const change of ['edited destination', 'proposed destination', 'edited temporary']) {
  test(`interrupted update handles ${change} without orphaning temporary ownership`, async t => {
    const f = await lifecycle(t)
    await interrupt(f, 'partial-temp')
    assert.equal(f.run(...f.args).status, 86)
    delete f.env.NODE_OPTIONS
    const journal = JSON.parse(await readFile(f.journal, 'utf8'))
    const operation = journal.plan.operations.find(operation => operation.temporary)
    const target = join(f.destination, operation.path)
    if (change === 'edited temporary') await writeFile(operation.temporary, 'User temporary\n')
    else await writeFile(target, change === 'edited destination' ? 'Later user edit\n' : await readFile(join(journal.stage, operation.path)))
    const result = f.run(...f.args)
    if (change === 'edited temporary') {
      assert.equal(result.status, 2, result.stdout)
      assert.equal(result.value.problems[0].code, 'temporary-changed')
      assert.equal(await readFile(operation.temporary, 'utf8'), 'User temporary\n')
      assert.equal(JSON.parse(await readFile(f.journal, 'utf8')).plan.operations[0].temporary, operation.temporary)
    } else {
      assert.equal(result.status, change === 'edited destination' ? 2 : 0, result.stdout)
      await assert.rejects(lstat(operation.temporary), { code: 'ENOENT' })
      if (change === 'edited destination') {
        assert.equal(await readFile(target, 'utf8'), 'Later user edit\n')
        const conflict = result.value.data.installations[0].conflicts.find(conflict => conflict.path === operation.path)
        const replaced = f.run(...f.args, ...conflict.decision.split(' '))
        assert.equal(replaced.status, 0, replaced.stdout)
        assert.equal(replaced.value.data.installations[0].sourceVersion, 'v0.0.2')
      }
    }
  })
}

test('aliased lifecycle artifacts preserve tagged source versions for both hosts', async t => {
  const f = await fixture(t)
  for (const host of ['agents', 'claude']) {
    const parent = join(f.checkout, `installed-${host}`)
    await mkdir(parent)
    await mkdir(join(f.checkout, `.${host}`))
    await symlink(parent, join(f.checkout, `.${host}/skills`), process.platform === 'win32' ? 'junction' : 'dir')
  }
  f.git('add', '.')
  f.git('commit', '-m', 'record host aliases')
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.checkout, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  const target = join(f.checkout, 'installed-agents/repo-audit/SKILL.md')
  await writeFile(target, 'User edit\n')
  const conflict = f.run(...args).value.data.installations[0].conflicts[0]
  assert.equal(f.run(...args, ...conflict.decision.split(' ')).status, 0)
  assert.equal((await readdir(join(f.checkout, 'installed-agents'))).some(path => path.startsWith('.bstack-backup-')), true)
  for (const host of ['agents', 'claude']) {
    const preview = f.run('--scope', 'project', '--project', f.checkout, '--host', host, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.equal(preview.value.data.sourceVersion, 'v0.0.1')
    if (host === 'agents') assert.deepEqual(preview.value.data.changes, [])
  }
  await writeFile(join(f.checkout, 'installed-agents/unrelated.md'), 'User content\n')
  assert.match(f.run(...args, '--dry-run').value.data.sourceVersion, /:dirty$/)
})

test('uninstall resumes after a file deletion and reports a later edited owned file', async t => {
  const f = await lifecycle(t)
  await interrupt(f, 'file-remove')
  assert.equal(f.run(...f.args, '--uninstall').status, 86)
  delete f.env.NODE_OPTIONS
  await writeFile(join(f.destination, 'edited.md'), 'Changed during interruption\n')
  const resumed = f.run(...f.args, '--uninstall')
  assert.equal(resumed.status, 2, resumed.stdout)
  assert.equal(await readFile(join(f.destination, 'edited.md'), 'utf8'), 'Changed during interruption\n')
  assert.deepEqual(Object.keys(JSON.parse(await readFile(f.ownership, 'utf8')).files), ['edited.md'])
})

for (const scope of ['user', 'project']) {
  test(`link lifecycle previews source runtime, verifies repeats and preserves target in isolated ${scope} scope`, async t => {
    const f = await fixture(t)
    const selected = scope === 'user' ? f.home : f.project
    const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : []), '--host', 'all', '--link']
    const sourceBefore = await inventory(f.source)
    const homeBefore = await inventory(selected)
    const preview = f.run(...args, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.equal(preview.value.data.mode, 'link')
    assert.equal(preview.value.data.changes[0].action, 'source-runtime-install')
    assert.equal(preview.value.data.changes[0].path, join(f.source, 'node_modules'))
    assert.deepEqual(await inventory(f.source), sourceBefore)
    assert.deepEqual(await inventory(selected), homeBefore)
    const installed = f.run(...args)
    assert.equal(installed.status, 0, installed.stdout)
    const runtimeStat = await lstat(join(f.source, 'node_modules'), { bigint: true })
    for (const host of ['agents', 'claude']) {
      const destination = join(selected, `.${host}/skills/repo-audit`)
      assert.equal((await lstat(destination)).isSymbolicLink(), true)
      assert.equal(await readlink(destination), f.source)
      const saved = JSON.parse(await readFile(join(selected, `.${host}/skills/.bstack-install.json`), 'utf8'))
      assert.equal(saved.mode, 'link')
      assert.equal(saved.source, f.source)
    }
    const repeated = f.run(...args)
    assert.equal(repeated.status, 0, repeated.stdout)
    assert.deepEqual(repeated.value.data.changes, [])
    assert.deepEqual(await lstat(join(f.source, 'node_modules'), { bigint: true }), runtimeStat)
    await writeFile(join(f.source, 'SKILL.md'), (await readFile(join(f.source, 'SKILL.md'), 'utf8')) + '\nDeveloper edit\n')
    await writeFile(join(f.source, 'notes.md'), 'Unrelated target content\n')
    const edited = await inventory(f.source)
    const implicit = f.run(...args.filter(arg => arg !== '--link'))
    assert.equal(implicit.status, 2, implicit.stdout)
    assert.equal(implicit.value.problems[0].code, 'link-mode-required')
    const updated = f.run(...args)
    assert.equal(updated.status, 0, updated.stdout)
    assert.equal(updated.value.data.mode, 'link')
    assert.equal(updated.value.data.destinations[0].action, 'linked-checkout-update')
    assert.deepEqual(await inventory(f.source), edited)
    const removed = f.run(...args, '--uninstall')
    assert.equal(removed.status, 0, removed.stdout)
    assert.deepEqual(await inventory(f.source), edited)
    for (const host of ['agents', 'claude']) assert.deepEqual(await readdir(join(selected, `.${host}/skills`)), [])
  })
}

for (const replacement of ['unowned directory', 'changed target', 'replaced link', 'replacement directory']) {
  test(`link lifecycle preserves ${replacement}`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
    const parent = join(f.project, '.agents/skills')
    const destination = join(parent, 'repo-audit')
    const target = join(f.project, 'other-target')
    await mkdir(target)
    await writeFile(join(target, 'keep.md'), 'Keep target\n')
    if (replacement === 'unowned directory') await mkdir(destination, { recursive: true })
    else {
      assert.equal(f.run(...args).status, 0)
      await rename(destination, join(parent, 'original-link'))
      if (replacement === 'replacement directory') await mkdir(destination)
      else await symlink(replacement === 'changed target' ? target : f.source, destination, process.platform === 'win32' ? 'junction' : 'dir')
    }
    const before = await inventory(f.source)
    for (const extra of [[], ['--uninstall'], ['--dry-run']]) {
      const result = f.run(...args, ...extra)
      assert.equal(result.status, 2, result.stdout)
      assert.equal(result.value.problems[0].code, replacement === 'unowned directory' ? 'unowned-collision' : 'changed-link')
      assert.equal(await readFile(join(target, 'keep.md'), 'utf8'), 'Keep target\n')
      assert.deepEqual(await inventory(f.source), before)
    }
  })
}

for (const change of ['invalid runtime', 'valid runtime']) {
  test(`link installation preserves an existing ${change}`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
    const prepared = command('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], f.source, f.env)
    assert.equal(prepared.status, 0, prepared.stderr)
    await writeFile(join(f.source, 'node_modules/keep.txt'), 'User runtime content\n')
    if (change === 'invalid runtime') await writeFile(join(f.source, 'node_modules/lavish-axi/dist/cli.mjs'), "console.log('wrong version')\n")
    const before = await inventory(f.source)
    const result = f.run(...args)
    assert.equal(result.status, change === 'valid runtime' ? 0 : 2, result.stdout)
    assert.deepEqual(await inventory(f.source), before)
    if (change === 'invalid runtime') assert.equal(result.value.problems[0].code, 'runtime-conflict')
    else assert.equal(result.value.data.changes.some(change => change.action === 'source-runtime-install'), false)
  })
}

for (const change of ['invalid manifest', 'missing manifest']) {
  test(`owned link removal preserves source with ${change} without validating the target package`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
    assert.equal(f.run(...args).status, 0)
    if (change === 'invalid manifest') await writeFile(join(f.source, 'package.json'), '{invalid manifest')
    else await rm(join(f.source, 'package.json'))
    const before = await inventory(f.source)
    const removed = f.run(...args.filter(arg => arg !== '--link'), '--uninstall')
    assert.equal(removed.status, 0, removed.stdout)
    assert.deepEqual(await inventory(f.source), before)
    assert.deepEqual(await readdir(join(f.project, '.agents/skills')), [])
  })
}

test('all-host link preflight refuses a later collision before preparing source runtime', async t => {
  const f = await fixture(t)
  await mkdir(join(f.project, '.agents/skills/repo-audit'), { recursive: true })
  const before = await inventory(f.source)
  const result = f.run('--scope', 'project', '--project', f.project, '--host', 'all', '--link')
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'unowned-collision')
  assert.deepEqual(await inventory(f.source), before)
  await assert.rejects(lstat(join(f.project, '.claude')), { code: 'ENOENT' })
})

test('interrupted link activation preserves a replacement entry and target', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
  await interrupt(f, 'link-activate')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const destination = join(f.project, '.agents/skills/repo-audit')
  await rename(destination, join(f.project, 'saved-link'))
  await mkdir(destination)
  await writeFile(join(destination, 'keep.txt'), 'Replacement content\n')
  const before = await inventory(f.source)
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'changed-link')
  assert.equal(await readFile(join(destination, 'keep.txt'), 'utf8'), 'Replacement content\n')
  assert.deepEqual(await inventory(f.source), before)
})

test('failed link runtime never activates and retry preserves failed stage content', async t => {
  const f = await fixture(t, true)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
  const source = await inventory(f.source)
  const failed = f.run(...args)
  assert.equal(failed.status, 2, failed.stdout)
  assert.equal(failed.value.problems[0].code, 'runtime-install-failed')
  assert.deepEqual(await inventory(f.source), source)
  const parent = join(f.project, '.agents/skills')
  const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
  await writeFile(join(journal.runtimeStage, 'keep.txt'), 'Failed stage edit\n')
  await assert.rejects(lstat(join(parent, 'repo-audit')), { code: 'ENOENT' })
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  const resumed = f.run(...args)
  assert.equal(resumed.status, 0, resumed.stdout)
  assert.equal(await readFile(join(journal.runtimeStage, 'keep.txt'), 'utf8'), 'Failed stage edit\n')
})

test('interrupted link runtime preserves a replaced preparation stage', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
  await interrupt(f, 'link-runtime')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const journal = JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install-journal.json'), 'utf8'))
  await rename(journal.runtimeStage, join(f.project, 'saved-stage'))
  const target = join(f.project, 'replacement-stage')
  await cp(join(f.project, 'saved-stage'), target, { recursive: true })
  await symlink(target, journal.runtimeStage, process.platform === 'win32' ? 'junction' : 'dir')
  const before = await inventory(target)
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'runtime-conflict')
  assert.deepEqual(await inventory(target), before)
})

for (const boundary of ['link-runtime', 'link-prepared', 'link-activate']) {
  test(`tagged checkout link recovery preserves source binding after ${boundary}`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.checkout, '--host', 'agents', '--link']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const resumed = f.run(...args)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.sourceVersion, 'v0.0.1')
    assert.equal(f.run(...args).value.data.destinations[0].action, 'no-op')
  })
}

for (const boundary of ['link-runtime', 'link-activate', 'link-unlink']) {
  test(`link lifecycle resumes after ${boundary} while preserving target content`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
    if (boundary === 'link-unlink') assert.equal(f.run(...args).status, 0)
    await interrupt(f, boundary)
    const operation = [...args, ...(boundary === 'link-unlink' ? ['--uninstall'] : [])]
    const interrupted = f.run(...operation)
    assert.equal(interrupted.status, 86, interrupted.stdout)
    delete f.env.NODE_OPTIONS
    await writeFile(join(f.source, 'scratch-note'), 'Target content\n')
    if (boundary !== 'link-unlink') {
      // An authored source change cannot silently complete an interrupted install.
      assert.equal(f.run(...operation).value.problems[0].code, 'journal-source-changed')
      await rm(join(f.source, 'scratch-note'))
      await writeFile(join(f.source, 'node_modules/keep.txt'), 'Target content\n')
    }
    const before = await inventory(f.source)
    const preview = f.run(...operation, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.deepEqual(await inventory(f.source), before)
    const resumed = f.run(...operation)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.deepEqual(await inventory(f.source), before)
  })
}

test('changed staged recovery bytes block without overwriting or deleting unrelated content', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'prepared')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const journal = JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install-journal.json'), 'utf8'))
  await writeFile(join(journal.stage, 'SKILL.md'), 'Changed staged content\n')
  const before = await inventory(f.project)
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'recovery-conflict')
  assert.deepEqual(await inventory(f.project), before)
})

test('runtime failure on update reports the unchanged installed version and retries the verified stage', async t => {
  const f = await fixture(t, true)
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  const destination = join(f.project, '.agents/skills/repo-audit')
  const before = await inventory(destination)
  await writeFile(join(f.source, 'new.md'), 'New authored content\n')
  f.git('add', '.')
  f.git('commit', '-m', 'new release')
  f.git('tag', 'v0.0.2')
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '1'
  const failed = f.run(...args)
  assert.equal(failed.status, 1, failed.stdout)
  assert.equal(failed.value.problems[0].code, 'runtime-install-failed')
  assert.equal(failed.value.data.installations[0].sourceVersion, 'v0.0.1')
  assert.equal(failed.value.data.installations[0].runtime.verified, true)
  assert.deepEqual(await inventory(destination), before)
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  const resumed = f.run(...args)
  assert.equal(resumed.status, 0, resumed.stdout)
  assert.equal(resumed.value.data.installations[0].sourceVersion, 'v0.0.2')
  assert.equal(await readFile(join(destination, 'new.md'), 'utf8'), 'New authored content\n')
})
