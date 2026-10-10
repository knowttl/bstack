import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises'
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

test('edited installations preserve conflicts and link mode remains deferred', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.project, '.agents/skills/repo-audit/SKILL.md'), '# User edits\n')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.data.installations[0].sourceVersion, 'mixed')
  assert.equal(await readFile(join(f.project, '.agents/skills/repo-audit/SKILL.md'), 'utf8'), '# User edits\n')
  assert.equal(f.run(...args, '--link').value.problems[0].code, 'unsupported-lifecycle')
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
const rename = fs.rename
const unlink = fs.unlink
const copyFile = fs.copyFile
const boundary = ${JSON.stringify(boundary)}
fs.copyFile = async (from, to) => {
  if (boundary === 'partial-temp' && String(to).replaceAll('\\\\', '/').includes('/repo-audit/.bstack-install-') && String(to).endsWith('.tmp')) {
    const bytes = await fs.readFile(from)
    await fs.writeFile(to, bytes.subarray(0, Math.floor(bytes.length / 2)))
    process.exit(86)
  }
  return copyFile(from, to)
}
fs.rename = async (from, to) => {
  const result = await rename(from, to)
  const path = String(to).replaceAll('\\\\', '/')
  if (path.endsWith('/.bstack-install-journal.json')) {
    const journal = JSON.parse(await fs.readFile(to, 'utf8'))
    if (boundary === journal.state) process.exit(86)
  }
  if (boundary === 'copy-rename' && path.endsWith('/skills/repo-audit')) process.exit(86)
  if (boundary === 'file-rename' && path.endsWith('/repo-audit/current.md')) process.exit(86)
  if (boundary === 'runtime-backup' && path.endsWith('/previous-runtime')) process.exit(86)
  if (boundary === 'runtime-rename' && path.endsWith('/repo-audit/node_modules')) process.exit(86)
  return result
}
fs.unlink = async path => {
  const result = await unlink(path)
  if (boundary === 'file-remove' && String(path).replaceAll('\\\\', '/').endsWith('/repo-audit/current.md')) process.exit(86)
  return result
}
syncBuiltinESMExports()
`)
  f.env.NODE_OPTIONS = `--import=${JSON.stringify(hook)}`
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
