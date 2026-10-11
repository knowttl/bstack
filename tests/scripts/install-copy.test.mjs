import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { root, command, fixture, inventory } from './install-fixture.mjs'

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
  for (const tagged of location === 'checkout' ? [false, true] : [false]) {
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
