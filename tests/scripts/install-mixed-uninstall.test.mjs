import test from 'node:test'
import assert from 'node:assert/strict'
import { lstat, readFile, readlink, rename, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { command, fixture, inventory, interrupt } from './install-fixture.mjs'

for (const copyHost of ['claude', 'agents']) {
  for (const scenario of ['clean', 'edited copy', 'changed link', 'changed copy', 'copy interruption', 'cleanup interruption', 'link interruption', 'link cleanup interruption']) {
    test(`mixed-mode uninstall handles ${scenario} with ${copyHost} copy in user scope`, async t => {
      const f = await fixture(t)
      const selected = f.home
      const args = ['--scope', 'user']
      const linkHost = copyHost === 'claude' ? 'agents' : 'claude'
      const copy = join(selected, `.${copyHost}/skills/repo-audit`)
      const link = join(selected, `.${linkHost}/skills/repo-audit`)
      await writeFile(join(f.source, 'current.md'), 'Owned copy content\n')
      assert.equal(f.run(...args, '--host', copyHost).status, 0)
      assert.equal(f.run(...args, '--host', linkHost, '--link').status, 0)
      await writeFile(join(copy, 'notes.txt'), 'Unrelated copy content\n')
      await writeFile(join(f.source, 'notes.txt'), 'Unrelated target content\n')
      if (scenario === 'edited copy') await writeFile(join(copy, 'SKILL.md'), 'Edited copy\n')
      if (scenario === 'changed link' || scenario === 'changed copy') {
        const destination = scenario === 'changed link' ? link : copy
        await rename(destination, join(selected, 'saved-installation'))
        await symlink(f.source, destination, process.platform === 'win32' ? 'junction' : 'dir')
      }
      const sourceBefore = await inventory(f.source)
      const command = [...args, '--host', 'all', '--uninstall']
      const preview = f.run(...command, '--dry-run')
      if (scenario.startsWith('changed')) {
        assert.equal(preview.status, 2, preview.stdout)
        assert.equal(f.run(...command).status, 2)
        assert.equal(await readlink(link), f.source)
        const originalCopy = scenario === 'changed copy' ? join(selected, 'saved-installation') : copy
        assert.equal((await lstat(join(originalCopy, 'SKILL.md'))).isFile(), true)
        assert.deepEqual(await inventory(f.source), sourceBefore)
        return
      }
      assert.equal(preview.status, 0, preview.stdout)
      assert.equal(preview.value.data.mode, 'mixed')
      assert.equal(await readlink(link), f.source)
      assert.equal((await lstat(join(copy, 'SKILL.md'))).isFile(), true)
      if (scenario.endsWith('interruption')) {
        await interrupt(f, scenario === 'copy interruption' ? 'file-remove' : scenario === 'cleanup interruption' ? `cleanup-journal-${copyHost}` : scenario === 'link cleanup interruption' ? `cleanup-journal-${linkHost}` : 'link-unlink')
        const interrupted = f.run(...command)
        assert.equal(interrupted.status, 86, interrupted.stdout)
        delete f.env.NODE_OPTIONS
      }
      const removed = f.run(...command, '--link')
      assert.equal(removed.status, scenario === 'edited copy' ? 2 : 0, removed.stdout)
      await assert.rejects(lstat(link), { code: 'ENOENT' })
      assert.equal(await readFile(join(copy, 'notes.txt'), 'utf8'), 'Unrelated copy content\n')
      if (scenario === 'edited copy') {
        assert.equal(await readFile(join(copy, 'SKILL.md'), 'utf8'), 'Edited copy\n')
        const decision = removed.value.data.installations.find(entry => entry.destination === copy).conflicts.find(conflict => conflict.path === 'SKILL.md').decision
        const cleaned = f.run(...command, ...decision.split(' '))
        assert.equal(cleaned.status, 0, cleaned.stdout)
      }
      for (const host of [copyHost, linkHost]) {
        await assert.rejects(lstat(join(selected, `.${host}/skills/.bstack-install.json`)), { code: 'ENOENT' })
        await assert.rejects(lstat(join(selected, `.${host}/skills/.bstack-install-journal.json`)), { code: 'ENOENT' })
      }
      assert.deepEqual(await inventory(f.source), sourceBefore)
    })
  }
}

for (const copyHost of ['claude', 'agents']) {
  test(`mixed-mode tagged checkout removal preserves failed runtime stages after link cleanup for ${copyHost} copy`, async t => {
    const f = await fixture(t, true)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.checkout]
    const linkHost = copyHost === 'claude' ? 'agents' : 'claude'
    const linkParent = join(f.checkout, `.${linkHost}/skills`)
    const copy = join(f.checkout, `.${copyHost}/skills/repo-audit`)
    f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
    assert.equal(f.run(...args, '--host', copyHost).status, 0)
    f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '1'
    const failed = f.run(...args, '--host', linkHost, '--link')
    assert.equal(failed.status, 2, failed.stdout)
    assert.equal(failed.value.problems[0].code, 'runtime-install-failed')
    const journal = JSON.parse(await readFile(join(linkParent, '.bstack-install-journal.json'), 'utf8'))
    await writeFile(join(journal.runtimeStage, 'keep.txt'), 'Unrelated failed-stage content\n')
    f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
    const installed = f.run(...args, '--host', linkHost, '--link')
    assert.equal(installed.status, 0, installed.stdout)
    assert.equal(installed.value.data.sourceVersion, 'v0.0.1')
    await writeFile(join(copy, 'keep.txt'), 'Unrelated copy content\n')
    await writeFile(join(f.source, 'node_modules/keep.txt'), 'Unrelated target content\n')
    const stageBefore = await inventory(journal.runtimeStage)
    const sourceBefore = await inventory(f.source)
    const command = [...args, '--host', 'all', '--uninstall']
    await interrupt(f, `cleanup-journal-${linkHost}`)
    assert.equal(f.run(...command).status, 86)
    delete f.env.NODE_OPTIONS
    await assert.rejects(lstat(join(linkParent, '.bstack-install.json')), { code: 'ENOENT' })
    await assert.rejects(lstat(join(linkParent, '.bstack-install-journal.json')), { code: 'ENOENT' })
    const preview = f.run(...command, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.equal(preview.value.data.sourceVersion, 'v0.0.1')
    const resumed = f.run(...command)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.sourceVersion, 'v0.0.1')
    assert.deepEqual(await inventory(journal.runtimeStage), stageBefore)
    assert.deepEqual(await inventory(f.source), sourceBefore)
    assert.equal(await readFile(join(copy, 'keep.txt'), 'utf8'), 'Unrelated copy content\n')
    await assert.rejects(lstat(join(f.checkout, '.bstack-install-cleanup.json')), { code: 'ENOENT' })
  })

  test(`mixed-mode tagged checkout removal retains source binding after link cleanup for ${copyHost} copy`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.checkout]
    const linkHost = copyHost === 'claude' ? 'agents' : 'claude'
    assert.equal(f.run(...args, '--host', copyHost).status, 0)
    assert.equal(f.run(...args, '--host', linkHost, '--link').status, 0)
    const command = [...args, '--host', 'all', '--uninstall']
    const preview = f.run(...command, '--dry-run')
    assert.equal(preview.status, 0, preview.stdout)
    assert.equal(preview.value.data.sourceVersion, 'v0.0.1')
    await interrupt(f, `cleanup-journal-${linkHost}`)
    assert.equal(f.run(...command).status, 86)
    delete f.env.NODE_OPTIONS
    const resumed = f.run(...command)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.sourceVersion, 'v0.0.1')
    await assert.rejects(lstat(join(f.checkout, '.bstack-install-cleanup.json')), { code: 'ENOENT' })
  })
}
