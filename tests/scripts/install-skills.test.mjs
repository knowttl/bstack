import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, command, fixture, inventory, interrupt } from './install-fixture.mjs'

// The fixture ships repo-audit with its pinned runtime; verification joins it as a skill that pins none.
async function twoSkills(t) {
  const f = await fixture(t)
  await cp(join(root, 'skills/verification'), join(f.checkout, 'skills/verification'), { recursive: true })
  f.git('add', '.')
  f.git('commit', '-m', 'add verification')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  const parent = join(f.project, '.agents/skills')
  return { ...f, args, parent }
}

test('a skill selected by name installs alone and runs from its installed folder', async t => {
  const f = await twoSkills(t)
  const result = f.run(...f.args, '--skill', 'verification')
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.deepEqual((await readdir(f.parent)).sort(), ['.bstack-install-verification.json', 'verification'])
  const destination = join(f.parent, 'verification')
  const checked = command(process.execPath, [join(root, 'scripts/check-package.mjs'), '--skill', destination], f.project, f.env)
  assert.equal(checked.status, 0, checked.stdout + checked.stderr)
  assert.equal(await lstat(join(destination, 'node_modules')).catch(error => error.code), 'ENOENT')
  assert.equal(JSON.parse(await readFile(join(f.parent, '.bstack-install-verification.json'), 'utf8')).runtime, null)
  const plan = join(f.project, 'plan.json')
  await writeFile(plan, '{}')
  const ran = command(process.execPath, [join(destination, 'scripts/verification.mjs'), 'run-checks', '--repo', f.checkout, '--plan', plan, '--json'], f.project, f.env)
  // Validation against the installed check-plan schema names the first required field.
  assert.equal(JSON.parse(ran.stdout).problems[0].path, '$/schemaVersion', ran.stdout)
})

test('without a selection every skill folder installs, updates and uninstalls on its own records', async t => {
  const f = await twoSkills(t)
  const installed = f.run(...f.args)
  assert.equal(installed.status, 0, installed.stdout + installed.stderr)
  assert.deepEqual((await readdir(f.parent)).sort(), ['.bstack-install-verification.json', '.bstack-install.json', 'repo-audit', 'verification'])
  assert.deepEqual(f.run(...f.args).value.data.destinations.map(entry => entry.action), ['no-op', 'no-op'])
  const verification = await inventory(join(f.parent, 'verification'))
  const removed = f.run(...f.args, '--skill', 'repo-audit', '--uninstall')
  assert.equal(removed.status, 0, removed.stdout + removed.stderr)
  assert.deepEqual((await readdir(f.parent)).sort(), ['.bstack-install-verification.json', 'verification'])
  assert.deepEqual(await inventory(join(f.parent, 'verification')), verification)
  await writeFile(join(f.checkout, 'skills/verification/update.md'), 'A new file\n')
  f.git('add', '.')
  f.git('commit', '-m', 'update verification')
  const updated = f.run(...f.args, '--skill', 'verification')
  assert.equal(updated.status, 0, updated.stdout + updated.stderr)
  assert.equal(await readFile(join(f.parent, 'verification/update.md'), 'utf8'), 'A new file\n')
})

test('a linked skill without a runtime links, repeats and unlinks', async t => {
  const f = await twoSkills(t)
  const args = [...f.args, '--skill', 'verification', '--link']
  assert.equal(f.run(...args).status, 0)
  assert.equal((await lstat(join(f.parent, 'verification'))).isSymbolicLink(), true)
  assert.deepEqual(f.run(...args).value.data.destinations.map(entry => entry.action), ['no-op'])
  const removed = f.run(...args, '--uninstall')
  assert.equal(removed.status, 0, removed.stdout + removed.stderr)
  assert.deepEqual(await readdir(f.parent), [])
})

test('an unknown skill is a usage error that lists the available skills', async t => {
  const f = await twoSkills(t)
  const result = f.run(...f.args, '--skill', 'missing')
  assert.equal(result.status, 3)
  assert.match(result.value.problems[0].fix, /repo-audit, verification/)
  assert.equal(await readdir(f.parent).catch(error => error.code), 'ENOENT')
})

test('an installed runtime that the source no longer pins blocks the update', async t => {
  const f = await twoSkills(t)
  assert.equal(f.run(...f.args, '--skill', 'verification').status, 0)
  const ownership = join(f.parent, '.bstack-install-verification.json')
  const record = JSON.parse(await readFile(ownership, 'utf8'))
  await writeFile(ownership, JSON.stringify({ ...record, runtime: { path: join(f.parent, 'verification/node_modules'), created: true, version: '0.1.78' } }))
  const result = f.run(...f.args, '--skill', 'verification')
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'runtime-dropped')
})

test('the default selection resumes cleanup belonging to its later skill', async t => {
  const f = await twoSkills(t)
  assert.equal(f.run(...f.args, '--skill', 'repo-audit').status, 0)
  await interrupt(f, 'cleanup-saved')
  assert.equal(f.run(...f.args).status, 86)
  delete f.env.NODE_OPTIONS
  const resumed = f.run(...f.args)
  assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr)
  assert.equal(await lstat(join(f.project, '.bstack-install-cleanup.json')).catch(error => error.code), 'ENOENT')
  assert.deepEqual((await readdir(f.parent)).sort(), ['.bstack-install-verification.json', '.bstack-install.json', 'repo-audit', 'verification'])
})

for (const skill of ['repo-audit', 'verification']) {
  test(`the default selection routes a replacement to ${skill}`, async t => {
    const f = await twoSkills(t)
    assert.equal(f.run(...f.args).status, 0)
    const path = join(f.parent, skill, 'SKILL.md')
    await writeFile(path, (await readFile(path, 'utf8')) + '\nLocal edit\n')
    const blocked = f.run(...f.args)
    assert.equal(blocked.status, 2, blocked.stdout)
    const conflict = blocked.value.data.installations.find(entry => entry.destination === join(f.parent, skill)).conflicts[0]
    const replaced = f.run(...f.args, ...conflict.decision.split(' '))
    assert.equal(replaced.status, 0, replaced.stdout + replaced.stderr)
    assert.equal(await readFile(path, 'utf8'), await readFile(join(f.checkout, 'skills', skill, 'SKILL.md'), 'utf8'))
  })
  test(`stale replacement for ${skill} reports its current conflict`, async t => {
    const f = await twoSkills(t)
    assert.equal(f.run(...f.args).status, 0)
    const destination = join(f.parent, skill)
    const path = join(destination, 'SKILL.md')
    await writeFile(path, 'First edit\n')
    const blocked = f.run(...f.args)
    const decision = blocked.value.data.installations.find(entry => entry.destination === destination).conflicts[0].decision
    await writeFile(path, 'Second edit\n')
    const before = await inventory(f.project)
    const stale = f.run(...f.args, ...decision.split(' '))
    assert.equal(stale.status, 3, stale.stdout)
    assert.equal(stale.value.problems[0].code, 'stale-replacement')
    const conflict = stale.value.data.installations.find(entry => entry.destination === destination).conflicts[0]
    assert.match(conflict.diff, /-Second edit/)
    assert.notEqual(conflict.decision, decision)
    assert.deepEqual(await inventory(f.project), before)
  })

  for (const boundary of ['writer-activated', 'cleanup-saved']) {
    test(`approved ${skill} repair resumes after ${boundary}`, async t => {
      const f = await twoSkills(t)
      await interrupt(f, boundary)
      assert.equal(f.run(...f.args, '--skill', skill).status, 86)
      delete f.env.NODE_OPTIONS
      const destination = join(f.parent, skill)
      const path = join(destination, 'SKILL.md')
      await writeFile(path, 'Recovery edit\n')
      const blocked = f.run(...f.args)
      assert.equal(blocked.status, 2, blocked.stdout)
      const conflict = blocked.value.data.installations.find(entry => entry.destination === destination).conflicts[0]
      const repaired = f.run(...f.args, ...conflict.decision.split(' '))
      assert.equal(repaired.status, 0, repaired.stdout)
      assert.equal(await readFile(path, 'utf8'), await readFile(join(f.checkout, 'skills', skill, 'SKILL.md'), 'utf8'))
      assert.equal(await readFile(join(repaired.value.data.installations.find(entry => entry.destination === destination).backup, 'SKILL.md'), 'utf8'), 'Recovery edit\n')
    })
  }
}

test('copy replacement decisions do not block removal of a sibling link', async t => {
  const f = await twoSkills(t)
  assert.equal(f.run(...f.args, '--skill', 'repo-audit', '--link').status, 0)
  assert.equal(f.run(...f.args, '--skill', 'verification').status, 0)
  const path = join(f.parent, 'verification', 'SKILL.md')
  await writeFile(path, (await readFile(path, 'utf8')) + '\nLocal edit\n')
  const blocked = f.run(...f.args, '--uninstall', '--dry-run')
  assert.equal(blocked.value.data.mode, 'mixed')
  const conflict = blocked.value.data.destinations.find(entry => entry.destination === join(f.parent, 'verification')).conflicts[0]
  const removed = f.run(...f.args, '--uninstall', ...conflict.decision.split(' '))
  assert.equal(removed.status, 0, removed.stdout + removed.stderr)
  assert.equal(removed.value.data.mode, 'mixed')
  assert.equal(await lstat(join(f.parent, 'repo-audit')).catch(error => error.code), 'ENOENT')
  assert.equal(await lstat(join(f.parent, 'verification')).catch(error => error.code), 'ENOENT')
})

for (const [args, ownershipRemains] of [[[], true], [['--uninstall', '--link'], false]]) test(`the default selection routes runtime adoption to its owning skill ${args.join(' ')}`, async t => {
  const f = await twoSkills(t)
  assert.equal(f.run(...f.args).status, 0)
  const ownership = join(f.parent, '.bstack-install.json')
  const record = JSON.parse(await readFile(ownership, 'utf8'))
  delete record.runtime.identity
  await writeFile(ownership, JSON.stringify(record))
  const preview = f.run(...f.args, ...args, '--dry-run')
  const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === 'node_modules').decision
  const adopted = f.run(...f.args, ...args, ...decision.split(' '))
  assert.equal(adopted.status, 0, adopted.stdout + adopted.stderr)
  assert.equal(Boolean(await lstat(ownership).catch(() => null)), ownershipRemains)
})

test('stale runtime adoption reports the current ownership decision', async t => {
  const f = await twoSkills(t)
  assert.equal(f.run(...f.args).status, 0)
  const ownership = join(f.parent, '.bstack-install.json')
  const record = JSON.parse(await readFile(ownership, 'utf8'))
  delete record.runtime.identity
  await writeFile(ownership, JSON.stringify(record))
  const preview = f.run(...f.args, '--dry-run')
  const decision = preview.value.data.destinations[0].conflicts.find(conflict => conflict.path === 'node_modules').decision
  await writeFile(join(f.parent, 'repo-audit/node_modules/keep.txt'), 'Later runtime content\n')
  const before = await inventory(f.project)
  const stale = f.run(...f.args, ...decision.split(' '))
  assert.equal(stale.status, 3, stale.stdout)
  assert.equal(stale.value.problems[0].code, 'stale-runtime-decision')
  const conflict = stale.value.data.installations.find(entry => entry.destination === join(f.parent, 'repo-audit')).conflicts.find(conflict => conflict.path === 'node_modules')
  assert.match(conflict.decision, /^--adopt-runtime /)
  assert.notEqual(conflict.decision, decision)
  assert.deepEqual(await inventory(f.project), before)
})
