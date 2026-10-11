import test from 'node:test'
import assert from 'node:assert/strict'
import { lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture, inventory, legacyInstallation, upgradeRuntime, interrupt } from './install-fixture.mjs'

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
