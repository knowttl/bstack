import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, mkdir, readFile, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { command, fixture, inventory, interrupt } from './install-fixture.mjs'

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

for (const scope of ['user', 'project']) {
  for (const host of ['claude', 'agents']) {
    test(`single-host link supports all-host removal without its source manifest in ${scope} scope for ${host}`, async t => {
      const f = await fixture(t)
      const selected = scope === 'user' ? f.home : f.project
      const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : [])]
      assert.equal(f.run(...args, '--host', host, '--link').status, 0)
      await rm(join(f.source, 'package.json'))
      const before = await inventory(f.source)
      const removed = f.run(...args, '--host', 'all', '--uninstall')
      assert.equal(removed.status, 0, removed.stdout)
      await assert.rejects(lstat(join(selected, `.${host}/skills/repo-audit`)), { code: 'ENOENT' })
      assert.deepEqual(await inventory(f.source), before)
    })
  }
}

for (const replacement of ['unowned directory', 'unowned link', 'changed target', 'replaced link', 'replacement directory']) {
  test(`link lifecycle preserves ${replacement}`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
    const parent = join(f.project, '.agents/skills')
    const destination = join(parent, 'repo-audit')
    const target = join(f.project, 'other-target')
    await mkdir(target)
    await writeFile(join(target, 'keep.md'), 'Keep target\n')
    if (replacement === 'unowned directory') await mkdir(destination, { recursive: true })
    else if (replacement === 'unowned link') {
      await mkdir(parent, { recursive: true })
      await symlink(target, destination, process.platform === 'win32' ? 'junction' : 'dir')
    }
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
      assert.equal(result.value.problems[0].code, replacement.startsWith('unowned') ? 'unowned-collision' : 'changed-link')
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

test('link repeat rejects a replaced source directory while removal preserves it', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
  assert.equal(f.run(...args).status, 0)
  const oldSource = join(f.directory, 'original-source')
  await rename(f.source, oldSource)
  await cp(oldSource, f.source, { recursive: true })
  const before = await inventory(f.source)
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'changed-link')
  assert.deepEqual(await inventory(f.source), before)
  assert.equal(f.run(...args, '--uninstall').status, 0)
  assert.deepEqual(await inventory(f.source), before)
  assert.deepEqual(await inventory(oldSource), before)
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

test('link runtime preparation supports separate source and destination filesystems', async t => {
  const f = await fixture(t)
  await interrupt(f, 'different-filesystems')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents', '--link']
  const installed = f.run(...args)
  assert.equal(installed.status, 0, installed.stdout)
  assert.equal(await readlink(join(f.project, '.agents/skills/repo-audit')), f.source)
  assert.equal(await readFile(join(f.source, 'node_modules/lavish-axi/package.json'), 'utf8'), await readFile(join(f.project, '.agents/skills/repo-audit/node_modules/lavish-axi/package.json'), 'utf8'))
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
