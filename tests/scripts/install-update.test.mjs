import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, readFile, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fixture, inventory, lifecycle, interrupt } from './install-fixture.mjs'

for (const operation of ['update', 'uninstall', 'interrupted update']) {
  test(`runtime retirement removes owned runtime during ${operation}`, async t => {
    const f = await lifecycle(t)
    await rm(join(f.source, 'package.json'))
    await rm(join(f.source, 'package-lock.json'))
    f.git('add', '.')
    f.git('commit', '-m', 'retire runtime')
    f.git('tag', 'v0.0.3')
    const args = [...f.args, ...(operation === 'uninstall' ? ['--uninstall'] : [])]
    const before = await inventory(f.project)
    const preview = f.run(...args, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.ok(preview.value.data.changes.some(change => change.action === 'runtime-remove'))
    assert.deepEqual(await inventory(f.project), before)
    if (operation === 'interrupted update') {
      await interrupt(f, 'applying')
      assert.equal(f.run(...args).status, 86)
      delete f.env.NODE_OPTIONS
      const recovery = f.run(...args, '--dry-run')
      assert.equal(recovery.status, 0, recovery.stdout)
      assert.ok(recovery.value.data.changes.some(change => change.action === 'runtime-remove'))
    }
    const result = f.run(...args)
    assert.equal(result.status, 0, result.stdout)
    await assert.rejects(lstat(join(f.destination, 'node_modules')), { code: 'ENOENT' })
    await assert.rejects(lstat(f.journal), { code: 'ENOENT' })
    if (operation === 'uninstall') {
      await assert.rejects(lstat(f.ownership), { code: 'ENOENT' })
    } else {
      assert.equal(result.value.data.installations[0].sourceVersion, 'v0.0.3')
      assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).runtime, null)
      assert.equal(f.run(...args).status, 0)
      assert.equal(f.run(...args, '--uninstall').status, 0)
      await assert.rejects(lstat(f.ownership), { code: 'ENOENT' })
    }
  })
}

for (const uninstall of [false, true]) {
  test(`runtime retirement preserves an unowned replacement during ${uninstall ? 'uninstall' : 'update'}`, async t => {
    const f = await lifecycle(t)
    await rm(join(f.source, 'package.json'))
    await rm(join(f.source, 'package-lock.json'))
    f.git('add', '.')
    f.git('commit', '-m', 'retire runtime')
    await rename(join(f.destination, 'node_modules'), join(f.project, 'owned-runtime'))
    await mkdir(join(f.destination, 'node_modules'))
    await writeFile(join(f.destination, 'node_modules/keep.txt'), 'User runtime\n')
    const before = await inventory(join(f.destination, 'node_modules'))
    const owned = JSON.parse(await readFile(f.ownership, 'utf8')).runtime
    const result = f.run(...f.args, ...(uninstall ? ['--uninstall'] : []))
    assert.equal(result.status, 2, result.stdout)
    assert.ok(result.value.data.installations[0].conflicts.some(conflict => conflict.path === 'node_modules'))
    assert.deepEqual(await inventory(join(f.destination, 'node_modules')), before)
    assert.deepEqual(JSON.parse(await readFile(f.ownership, 'utf8')).runtime, owned)
  })
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
