import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { git, run, snapshot } from './discovery-fixture.mjs'

function commit(repo) {
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  return git(repo, 'rev-parse', 'HEAD')
}

async function collect(t, f, base) {
  const result = run('evidence collect', f.repo, process.env, ['--base', base])
  if (result.data.path) t.after(() => rm(join(result.data.path, '..'), { recursive: true, force: true }))
  return result
}

test('collects committed, staged, unstaged, new, renamed and deleted paths together', async t => {
  const f = await maintenanceRepo(t)
  const base = commit(f.repo)
  await writeFile(join(f.repo, 'src/committed.mjs'), 'committed\n')
  await rename(join(f.repo, 'src/old.mjs'), join(f.repo, 'outside ü & [x].mjs'))
  commit(f.repo)
  await writeFile(join(f.repo, 'src/staged.mjs'), 'staged\n')
  await rm(join(f.repo, 'src/delete.mjs'))
  git(f.repo, 'add', '.')
  await writeFile(join(f.repo, 'src/change.mjs'), 'unstaged\n')
  await writeFile(join(f.repo, 'src/new\nname?.mjs'), 'new\n')
  const before = await snapshot(f.repo)
  const result = await collect(t, f, base)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.base.objectId, base)
  assert.deepEqual(result.data.paths, ['outside ü & [x].mjs', 'src/change.mjs', 'src/committed.mjs', 'src/delete.mjs', 'src/new\nname?.mjs', 'src/old.mjs', 'src/staged.mjs'])
  assert.deepEqual(result.data.changes.find(change => change.oldPath), { source: 'committed', status: 'R100', oldPath: 'src/old.mjs', path: 'outside ü & [x].mjs' })
  assert.equal(result.data.changes.find(change => change.path === 'src/delete.mjs').status, 'D')
  assert.deepEqual([...new Set(result.data.changes.map(change => change.source))].sort(), ['committed', 'new', 'staged', 'unstaged'])
  assert.deepEqual(result.data.unmappedPaths, ['outside ü & [x].mjs'])
  assert.deepEqual(result.data.candidateDocuments, f.contract.documents)
  const skeleton = JSON.parse(await readFile(result.data.path, 'utf8'))
  assert.deepEqual(skeleton.paths, result.data.paths)
  assert.equal(skeleton.documents[0].assessment, null)
  assert.deepEqual(skeleton.unmappedAssessments, [{ path: 'outside ü & [x].mjs', assessment: null }])
  assert.ok(relative(f.repo, result.data.path).startsWith('..'))
  assert.deepEqual(await snapshot(f.repo), before)
})

test('unborn repo records an explicit empty tree including staged and new files', async t => {
  const f = await maintenanceRepo(t)
  git(f.repo, 'add', 'src/change.mjs')
  const result = await collect(t, f, 'empty')
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.head, null)
  assert.deepEqual(result.data.base, { ref: 'empty', kind: 'empty-tree', objectId: git(f.repo, 'hash-object', '-t', 'tree', '--stdin') })
  assert.ok(result.data.paths.includes('.bstack/project.json'))
  assert.equal(result.data.changes.find(change => change.path === 'src/change.mjs').source, 'staged')
})

test('missing base blocks an unborn repo rather than returning an empty comparison', async t => {
  const f = await maintenanceRepo(t)
  const result = await collect(t, f, 'missing')
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'base-unavailable')
  assert.equal(result.data.path, undefined)
})

test('missing base blocks committed history', async t => {
  const f = await maintenanceRepo(t)
  commit(f.repo)
  assert.equal((await collect(t, f, 'missing')).exit, 2)
})

test('shallow history names the exact full-history fetch prerequisite', async t => {
  const f = await maintenanceRepo(t)
  const base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'next\n')
  commit(f.repo)
  const shallow = join(f.directory, 'shallow')
  git(f.directory, 'clone', '--depth', '1', `file://${f.repo}`, shallow)
  const result = await collect(t, { repo: shallow }, base)
  assert.equal(result.exit, 2)
  assert.match(result.problems[0].fix, /git fetch --unshallow origin/)
  assert.ok(result.problems[0].fix.includes(`git fetch origin ${base}`))
})

test('resolves a named base once to its commit ID and recomputes after working-tree changes', async t => {
  const f = await maintenanceRepo(t)
  const base = commit(f.repo)
  git(f.repo, 'tag', 'baseline')
  const first = await collect(t, f, 'baseline')
  assert.equal(first.data.base.objectId, base)
  assert.deepEqual(first.data.paths, [])
  await writeFile(join(f.repo, 'src/change.mjs'), 'new bytes\n')
  const second = await collect(t, f, 'baseline')
  assert.deepEqual(second.data.paths, ['src/change.mjs'])
})

for (const source of ['staged', 'unstaged']) {
  test(`${source} rename maps both old and new scopes`, async t => {
    const f = await maintenanceRepo(t)
    const base = commit(f.repo)
    if (source === 'unstaged') {
      // An unstaged rename into another tracked path is detected by the worktree diff.
      await writeFile(join(f.repo, 'destination.mjs'), '')
      commit(f.repo)
    }
    await rename(join(f.repo, 'src/old.mjs'), join(f.repo, 'destination.mjs'))
    if (source === 'staged') git(f.repo, 'add', '.')
    const result = await collect(t, f, base)
    assert.equal(result.exit, 0)
    assert.ok(result.data.paths.includes('src/old.mjs'))
    assert.ok(result.data.paths.includes('destination.mjs'))
    assert.deepEqual(result.data.mappings.find(mapping => mapping.path === 'src/old.mjs').documentIds, ['design'])
    assert.ok(result.data.unmappedPaths.includes('destination.mjs'))
  })
}

test('globstar includes zero segments and path case stays distinct', async t => {
  const f = await maintenanceRepo(t)
  f.contract.scopes[0].paths = ['src/**/*.mjs']
  await f.save()
  const base = commit(f.repo)
  await writeFile(join(f.repo, 'src/direct.mjs'), '')
  await writeFile(join(f.repo, 'src/upper.MJS'), '')
  const result = await collect(t, f, base)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.mappings.find(mapping => mapping.path === 'src/direct.mjs').scopeIds, ['code'])
  assert.ok(result.data.unmappedPaths.includes('src/upper.MJS'))
})

test('collection requires an explicit base and rejects supplied inventories', async t => {
  const f = await maintenanceRepo(t)
  assert.equal(run('evidence collect', f.repo).exit, 3)
  assert.equal(run('evidence collect', f.repo, process.env, ['--base', 'empty', '--paths', '[]']).exit, 3)
})

test('a scope without document relationships still requires an unmapped impact assessment', async t => {
  const f = await maintenanceRepo(t)
  f.contract.scopes[0].documentIds = []
  await f.save()
  const base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'change again\n')
  const result = await collect(t, f, base)
  assert.deepEqual(result.data.unmappedPaths, ['src/change.mjs'])
  assert.deepEqual(result.data.candidateDocuments, [])
})

for (const collection of ['documents', 'rules', 'acceptanceSources']) {
  for (const source of ['committed', 'staged', 'unstaged']) {
    for (const action of ['delete', 'rename']) {
      test(`collect retains ${source} ${action} of ${collection} source pointer`, async t => {
        const f = await maintenanceRepo(t)
        const path = `${collection}.md`
        await writeFile(join(f.repo, path), '# Source\n')
        f.contract[collection][0].path = path
        await f.save()
        const base = commit(f.repo)
        if (action === 'rename') await rename(join(f.repo, path), join(f.repo, 'moved.md'))
        else await rm(join(f.repo, path))
        if (source === 'staged') git(f.repo, 'add', '.')
        if (source === 'committed') commit(f.repo)
        const result = await collect(t, f, base)
        assert.equal(result.exit, 0, JSON.stringify(result))
        assert.ok(result.data.paths.includes(path))
        assert.ok(result.data.changes.some(change => change.source === source && (change.path === path || change.oldPath === path)))
        if (action === 'rename') assert.ok(result.data.paths.includes('moved.md'))
        const skeleton = JSON.parse(await readFile(result.data.path, 'utf8'))
        assert.deepEqual(skeleton.paths, result.data.paths)
        if (collection === 'documents') assert.deepEqual(result.data.candidateDocuments, f.contract.documents)
        assert.equal(run('contract validate', f.repo).problems[0]?.code, 'missing-path')
      })
    }
  }
  test(`collect rejects unrelated missing ${collection} pointer`, async t => {
    const f = await maintenanceRepo(t)
    const base = commit(f.repo)
    await rm(join(f.repo, 'src/delete.mjs'))
    f.contract[collection][0].path = 'never-existed.md'
    await f.save()
    const result = await collect(t, f, base)
    assert.equal(result.problems[0]?.code, 'missing-path')
    assert.equal(result.data.path, undefined)
  })
}

test('collect retains deletion of a shared document rule and acceptance source', async t => {
  const f = await maintenanceRepo(t)
  const base = commit(f.repo)
  await rm(join(f.repo, 'README.md'))
  const result = await collect(t, f, base)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.paths, ['README.md'])
  assert.deepEqual(result.data.candidateDocuments, f.contract.documents)
})

for (const collection of ['documents', 'rules', 'acceptanceSources']) {
  for (const source of ['committed', 'staged', 'unstaged']) {
    test(`collect retains ${source} case-only rename of ${collection}`, async t => {
      const f = await maintenanceRepo(t)
      const path = `${collection.toUpperCase()}.md`
      const destination = `${collection.toLowerCase()}.md`
      await writeFile(join(f.repo, path), '# Source\n')
      f.contract[collection][0].path = path
      await f.save()
      const base = commit(f.repo)
      await rename(join(f.repo, path), join(f.repo, 'rename-temp.md'))
      await rename(join(f.repo, 'rename-temp.md'), join(f.repo, destination))
      if (source === 'staged') git(f.repo, 'add', '-A')
      if (source === 'committed') commit(f.repo)
      const result = await collect(t, f, base)
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.data.paths, [path, destination].sort())
      if (collection === 'documents') assert.deepEqual(result.data.candidateDocuments, f.contract.documents)
      const skeleton = JSON.parse(await readFile(result.data.path, 'utf8'))
      assert.deepEqual(skeleton.paths, result.data.paths)
      assert.equal(run('contract validate', f.repo).problems[0]?.code, 'missing-path')
    })
  }
  test(`collect rejects unrelated wrong-case ${collection} pointer`, async t => {
    const f = await maintenanceRepo(t)
    const base = commit(f.repo)
    await rm(join(f.repo, 'src/delete.mjs'))
    f.contract[collection][0].path = 'readme.md'
    await f.save()
    assert.equal((await collect(t, f, base)).problems[0]?.code, 'missing-path')
  })
}

for (const collection of ['documents', 'rules', 'acceptanceSources']) {
  for (const source of ['committed', 'staged', 'unstaged']) {
    for (const replacement of ['directory', 'ancestor file']) {
      test(`collect retains ${source} removed ${collection} source replaced by ${replacement}`, async t => {
        const f = await maintenanceRepo(t)
        await mkdir(join(f.repo, 'config'))
        await writeFile(join(f.repo, 'config/rules'), '# Rules\n')
        f.contract[collection][0].path = 'config/rules'
        await f.save()
        const base = commit(f.repo)
        await rm(join(f.repo, 'config'), { recursive: true })
        if (replacement === 'directory') {
          await mkdir(join(f.repo, 'config/rules'), { recursive: true })
          await writeFile(join(f.repo, 'config/rules/imports.json'), '{}\n')
        } else await writeFile(join(f.repo, 'config'), 'replacement\n')
        if (source === 'staged') git(f.repo, 'add', '-A')
        if (source === 'committed') commit(f.repo)
        const result = await collect(t, f, base)
        assert.equal(result.exit, 0, JSON.stringify(result))
        assert.ok(result.data.paths.includes('config/rules'))
        assert.deepEqual(result.data.changes.find(change => change.path === 'config/rules'), { source, status: 'D', path: 'config/rules' })
        if (collection === 'documents') assert.deepEqual(result.data.candidateDocuments, f.contract.documents)
        const skeleton = JSON.parse(await readFile(result.data.path, 'utf8'))
        assert.deepEqual(skeleton.paths, result.data.paths)
        assert.notEqual(run('contract validate', f.repo).exit, 0)
      })
    }
  }
}
