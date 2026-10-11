import test from 'node:test'
import assert from 'node:assert/strict'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { legacyInstallation, upgradeRuntime, interrupt } from './install-fixture.mjs'

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
