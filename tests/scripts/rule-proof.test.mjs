import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { emptyRepo, build, run, snapshot } from './discovery-fixture.mjs'

async function setup(t, command) {
  const f = await emptyRepo(t)
  f.valid = join(f.directory, 'valid')
  f.violation = join(f.directory, 'violation')
  await mkdir(f.valid)
  await mkdir(f.violation)
  await writeFile(join(f.valid, 'case.txt'), 'valid')
  await writeFile(join(f.violation, 'case.txt'), 'private')
  f.plan = { schemaVersion: 1, changeKind: 'feature', acceptanceSources: [{ id: 'design', path: 'DESIGN.md', contentHash: '0'.repeat(64) }],
    acceptanceCases: [{ id: 'boundary', sourceId: 'design', pointer: 'public', outcome: 'Private imports fail.', userJourney: false }],
    checks: [{ id: 'boundary', role: 'outcome', required: true, acceptanceCases: ['boundary'], inputScopes: ['**'], command }] }
  f.path = join(f.directory, 'plan.json')
  f.invoke = async (expect = 'private') => {
    await writeFile(f.path, JSON.stringify(f.plan))
    return run('rule-proof', f.repo, { ...process.env, XDG_CACHE_HOME: join(f.directory, 'cache'), LOCALAPPDATA: join(f.directory, 'cache') },
      ['--check-plan', f.path, '--check-id', 'boundary', '--valid', f.valid, '--violation', f.violation, '--expect', expect])
  }
  return f
}

const command = { executable: 'node', args: ['-e', 'const fs = require("node:fs"); const kind = fs.readFileSync("case.txt", "utf8"); fs.writeFileSync("generated", kind); console.log(kind); process.exit(kind === "valid" ? 0 : 1)'], cwd: '.', versionArgs: ['--version'] }

test('proof preserves source fixtures and records normal rejection with tool version', async t => {
  const f = await setup(t, command)
  const before = await snapshot(f.directory)
  const result = await f.invoke()
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.cases.map(item => item.execution.exitCode), [0, 1])
  assert.equal(result.data.cases[0].execution.toolVersion.stdout.trim(), process.version)
  assert.deepEqual(await snapshot(f.valid), before.valid)
  assert.deepEqual(await snapshot(f.violation), before.violation)
  assert.deepEqual(JSON.parse(await readFile(result.data.path, 'utf8')), result.data)
  assert.equal(Object.hasOwn(await snapshot(dirname(result.data.path)), 'valid'), false)
})

for (const [name, replacement, expected] of [
  ['passing violation', { args: ['-e', 'console.log("private")'] }, 'failed'],
  ['wrong diagnostic', { args: ['-e', 'const fs = require("node:fs"); process.exit(fs.readFileSync("case.txt", "utf8") === "valid" ? 0 : 1)'] }, 'failed'],
  ['failed setup', { args: ['-e', 'console.log("private"); process.exit(1)'] }, 'blocked'],
  ['missing tool', { executable: 'bstack-missing-native-tool' }, 'blocked'],
  ['failed version', { versionArgs: ['-e', 'process.exit(1)'] }, 'blocked'],
  ['missing cwd', { cwd: 'absent' }, 'blocked'],
  ['timeout', { args: ['-e', 'setInterval(() => {}, 1000)'], timeoutMs: 100 }, 'blocked']
]) {
  test(`${name} cannot prove enforcement`, async t => {
    const f = await setup(t, { ...command, ...replacement })
    const result = await f.invoke()
    assert.equal(result.status, expected)
    assert.notEqual(result.exit, 0)
    assert.equal(result.data.cases[0].status, expected === 'blocked' ? 'blocked' : 'passed')
  })
}

for (const [stack, executable, args, versionArgs] of [
  ['ts', 'node', ['boundaries.mjs'], ['-p', 'require("typescript").version']],
  ['py', 'uv', ['run', '--no-sync', 'python', 'boundaries.py'], ['run', '--no-sync', 'python', '--version']]
]) {
  test(`${stack} native public imports and permitted direction pass while private, alias and cycles fail`, async t => {
    const f = await setup(t, { executable, args, versionArgs, cwd: '.' })
    f.valid = build(t, `${stack}-rule-proof`)
    for (const kind of ['private', 'alias', 'cycle']) {
      f.violation = build(t, `${stack}-rule-proof-${kind}`)
      const result = await f.invoke(`"${kind}"`)
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.data.cases.map(item => item.status), ['passed', 'passed'])
      assert.equal(result.data.cases[0].execution.stdout.trim(), '[]')
      assert.deepEqual(JSON.parse(result.data.cases[1].execution.stdout), [kind])
      t.diagnostic(JSON.stringify({ stack, violation: kind, command: result.data.command,
        cases: result.data.cases.map(item => ({ kind: item.kind, status: item.status, toolVersion: item.execution.toolVersion.stdout.trim(),
          exitCode: item.execution.exitCode, stdout: item.execution.stdout, stderr: item.execution.stderr })) }))
    }
  })
}

for (const [name, mutate] of [
  ['unknown check ID', f => { f.plan.checks[0].id = 'other' }],
  ['skipped check', f => { f.plan.checks[0].skipReason = 'Unavailable.' }],
  ['identical fixtures', f => { f.violation = f.valid }],
  ['string child command', f => { f.plan.checks[0].command = 'node boundaries.mjs' }]
]) {
  test(`${name} is rejected before execution`, async t => {
    const f = await setup(t, command)
    mutate(f)
    const before = await snapshot(f.valid)
    const result = await f.invoke()
    assert.notEqual(result.exit, 0)
    assert.deepEqual(await snapshot(f.valid), before)
    assert.equal(result.data.path, undefined)
  })
}
