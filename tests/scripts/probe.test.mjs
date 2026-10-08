import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, access } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { emptyRepo, build, run, snapshot } from './discovery-fixture.mjs'

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function setup(t) {
  const { directory, repo } = await emptyRepo(t)
  await writeFile(join(repo, 'product.txt'), 'original')
  const spec = { schemaVersion: 1, endpoint: 'https://dependency.example.invalid/price', environment: ['BSTACK_PROBE_REGION'],
    sideEffects: false, assumption: 'The checkout total is 10.', inputScopes: ['product.txt'], cwd: '.', versionArgs: ['--version'] }
  const path = join(directory, 'probe-spec.json')
  const env = { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache'), BSTACK_PROBE_REGION: 'sandbox' }
  delete env.NODE_TEST_CONTEXT
  const command = ['node', '-e', 'console.log("observed")']
  const record = async (phase, extra = [], selected = command, environment = env, target = repo) => {
    await writeFile(path, JSON.stringify(spec))
    return run('probe record', target, environment, ['--name', 'price', '--phase', phase, '--spec', path, ...extra, '--', ...selected])
  }
  const compare = (before, after, environment = env, target = repo) => run('probe compare', target, environment,
    ['--name', 'price', ...(before ? ['--before', before.data.runId] : []), ...(after ? ['--after', after.data.runId] : [])])
  return { repo, directory, spec, path, env, command, record, compare }
}

test('matching live calls capture literal arguments and pass across changed product inputs without target writes', async t => {
  const f = await setup(t)
  const args = ['日本語 spaces', '$HOME', '$(touch injected)', '; touch injected', '--approved-by-user']
  f.command.splice(0, f.command.length, 'node', '-e', 'console.log(JSON.stringify(process.argv.slice(1)))', '--', ...args)
  const original = await snapshot(f.repo)
  const before = await f.record('before')
  assert.equal(before.exit, 0)
  assert.deepEqual(JSON.parse(before.data.execution.stdout), args)
  assert.equal(before.data.execution.toolVersion.stdout.trim(), process.version)
  assert.deepEqual(await snapshot(f.repo), original)
  await writeFile(join(f.repo, 'product.txt'), 'changed')
  const changed = await snapshot(f.repo)
  const after = await f.record('after')
  assert.equal(after.exit, 0)
  assert.notEqual(before.data.originalState.fingerprint, after.data.originalState.fingerprint)
  assert.equal(f.compare(before, after).data.verified, true)
  assert.deepEqual(await snapshot(f.repo), changed)
  assert.equal(JSON.parse(await readFile(after.data.path, 'utf8')).callDigest, before.data.callDigest)
})

for (const phase of ['before', 'after']) {
  test(`comparison rejects a missing ${phase} probe`, async t => {
    const f = await setup(t)
    const record = await f.record(phase === 'before' ? 'after' : 'before')
    const result = f.compare(phase === 'before' ? null : record, phase === 'after' ? null : record)
    assert.equal(result.exit, 1)
    assert.ok(result.problems.some(item => item.code === `missing-${phase}-probe`))
  })
}

for (const [name, change] of [
  ['endpoint', f => { f.spec.endpoint += '/different' }],
  ['command', f => { f.command.push('different') }],
  ['environment', f => { f.env.BSTACK_PROBE_REGION = 'production' }]
]) {
  test(`comparison rejects changed ${name}`, async t => {
    const f = await setup(t)
    const before = await f.record('before')
    change(f)
    const after = await f.record('after')
    assert.equal(after.exit, 0)
    const result = f.compare(before, after)
    assert.equal(result.exit, 1)
    assert.ok(result.problems.some(item => item.code === 'probe-pair-mismatch'))
  })
}

test('side-effect approval is refused before either version or live command and binds only the specific call', async t => {
  const f = await setup(t)
  f.spec.sideEffects = true
  const marker = join(f.directory, 'executed')
  f.spec.versionArgs = ['-e', 'require("node:fs").writeFileSync(process.argv[1], "version")', marker]
  const before = await f.record('before')
  assert.equal(before.exit, 2)
  assert.equal(before.problems[0].code, 'probe-approval-required')
  await assert.rejects(access(marker), { code: 'ENOENT' })
  f.spec.versionArgs = ['--version']
  const approved = await f.record('before', ['--approved-by-user'])
  assert.equal(approved.exit, 0)
  assert.deepEqual(approved.data.approval, { runId: approved.data.runId, callDigest: approved.data.callDigest, approvedByUser: true })
  const after = await f.record('after')
  assert.equal(after.exit, 2)
  const repeat = await f.record('after', ['--approved-by-user'])
  assert.equal(f.compare(approved, repeat).exit, 0)
  const saved = JSON.parse(await readFile(repeat.data.path, 'utf8'))
  saved.approval = approved.data.approval
  await writeFile(repeat.data.path, JSON.stringify(saved))
  assert.ok(f.compare(approved, repeat).problems.some(item => item.code === 'probe-approval-required'))
})

test('a child argument cannot approve a side-effecting call', async t => {
  const f = await setup(t)
  f.spec.sideEffects = true
  const result = await f.record('before', [], ['node', '-e', '', '--', '--approved-by-user'])
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'probe-approval-required')
})

for (const [name, command, timeoutMs, reason] of [
  ['missing executable', ['bstack-nonexistent-probe'], undefined, /ENOENT/],
  ['timeout', ['node', '-e', 'setInterval(() => {}, 1000)'], 100, /timed out/],
  ['failed assertion', ['node', '-e', 'process.exit(7)'], undefined, /asserted outcome/]
]) {
  test(`${name} retains its reason and cannot verify the pair`, async t => {
    const f = await setup(t)
    const before = await f.record('before')
    if (timeoutMs) f.spec.timeoutMs = timeoutMs
    const after = await f.record('after', [], command)
    assert.notEqual(after.exit, 0)
    assert.equal(after.data.status, name === 'failed assertion' ? 'failed' : 'unverified')
    assert.match(after.data.reason, reason)
    assert.equal(f.compare(before, after).exit, 1)
  })
}

test('declared input changes during a probe block its capture', async t => {
  const f = await setup(t)
  const result = await f.record('before', [], ['node', '-e', 'require("node:fs").writeFileSync("product.txt", "changed")'])
  assert.equal(result.exit, 2)
  assert.equal(result.data.reason, 'inputs changed during run')
})

for (const name of ['input', 'environment', 'descriptor']) {
  test(`a later ${name} change invalidates the after capture`, async t => {
    const f = await setup(t)
    const before = await f.record('before')
    const after = await f.record('after')
    if (name === 'input') await writeFile(join(f.repo, 'product.txt'), 'later')
    else if (name === 'environment') f.env.BSTACK_PROBE_REGION = 'later'
    else await writeFile(f.path, JSON.stringify(f.spec, null, 2))
    assert.ok(f.compare(before, after).problems.some(item => item.code === 'stale-probe'))
  })
}

test('comparison rejects swapped phases and capture reuse', async t => {
  const f = await setup(t)
  const before = await f.record('before')
  const after = await f.record('after')
  assert.equal(f.compare(after, before).exit, 1)
  assert.equal(f.compare(before, before).exit, 1)
})

test('malformed descriptors and unsafe scopes do not execute the probe', async t => {
  const f = await setup(t)
  f.spec.inputScopes = ['../outside']
  const result = await f.record('before')
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'invalid-glob')
  f.spec.inputScopes = ['product.txt']
  f.spec.sideEffects = 'false'
  const malformed = await f.record('before')
  assert.equal(malformed.exit, 1)
  assert.ok(malformed.problems.some(item => item.code === 'invalid-type'))
})

test('ts-shop live stand-in disagrees with the passing mock so its probe pair is not ready', async t => {
  const f = await setup(t)
  const repo = build(t, 'ts-shop')
  const server = spawn(process.execPath, [join(checkout, 'tests/inputs/price-server.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] })
  const closed = once(server, 'exit')
  t.after(async () => { server.kill(); await closed })
  const [ready] = await once(server.stdout, 'data')
  const endpoint = ready.toString().trim()
  const units = spawnSync(process.execPath, ['--test', 'unit.test.mjs'], { cwd: repo, env: f.env, encoding: 'utf8' })
  assert.equal(units.status, 0, units.stdout + units.stderr)
  f.spec.endpoint = endpoint
  f.spec.inputScopes = ['packages/**']
  const command = ['node', '--input-type=module', '-e', 'import assert from "node:assert/strict"; import { checkout } from "./packages/web/ui.ts"; const order = await checkout(process.argv[1]); console.log(JSON.stringify(order)); assert.deepEqual(order, { status: 201, total: 10 })', endpoint]
  const before = await f.record('before', [], command, f.env, repo)
  const after = await f.record('after', [], command, f.env, repo)
  assert.equal(before.data.status, 'failed')
  assert.equal(after.data.status, 'failed')
  assert.deepEqual(JSON.parse(after.data.execution.stdout), { status: 201, total: 12 })
  assert.equal(f.compare(before, after, f.env, repo).data.verified, false)
})
