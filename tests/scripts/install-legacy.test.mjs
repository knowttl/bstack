import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { command, inventory, legacyInstallation, interrupt, editOnVersionCheck } from './install-fixture.mjs'

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
