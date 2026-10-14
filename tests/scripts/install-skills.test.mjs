import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, lstat, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root, command, fixture, inventory } from './install-fixture.mjs'

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
