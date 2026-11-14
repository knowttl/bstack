import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { emptyRepo, build, runVerification as run, snapshot } from './discovery-fixture.ts'

type Command = { executable: string; args: readonly string[]; cwd: string; versionArgs: readonly string[]; timeoutMs?: number }
type Fixture = Awaited<ReturnType<typeof emptyRepo>> & {
  valid: string; violation: string; path: string;
  plan: { schemaVersion: number; changeKind: string;
    acceptanceSources: { id: string; path: string; contentHash: string }[];
    acceptanceCases: { id: string; sourceId: string; pointer: string; outcome: string; userJourney: boolean }[];
    checks: { id: string; role: string; required: boolean; acceptanceCases: string[]; inputScopes: string[]; command: Command; skipReason?: string }[] }
  invoke: (expect?: string, replacement?: string, extra?: readonly string[]) => Promise<ReturnType<typeof run>>
}

async function setup(t: import('node:test').TestContext, command: Command) {
  const f = await emptyRepo(t) as Fixture
  f.valid = join(f.directory, 'valid')
  f.violation = join(f.directory, 'violation')
  await mkdir(f.valid)
  await mkdir(f.violation)
  await writeFile(join(f.valid, 'case.txt'), 'valid')
  await writeFile(join(f.violation, 'case.txt'), diagnostic)
  f.plan = { schemaVersion: 1, changeKind: 'feature', acceptanceSources: [{ id: 'design', path: 'DESIGN.md', contentHash: '0'.repeat(64) }],
    acceptanceCases: [{ id: 'boundary', sourceId: 'design', pointer: 'public', outcome: 'Private imports fail.', userJourney: false }],
    checks: [{ id: 'boundary', role: 'outcome', required: true, acceptanceCases: ['boundary'], inputScopes: ['**'], command }] }
  f.path = join(f.directory, 'plan.json')
  f.invoke = async (expect = 'private-import', replacement = 'src/public.ts', extra = []) => {
    await writeFile(f.path, JSON.stringify(f.plan))
    return run('rule-proof', f.repo, { ...process.env, XDG_CACHE_HOME: join(f.directory, 'cache'), LOCALAPPDATA: join(f.directory, 'cache') },
      ['--check-plan', f.path, '--check-id', 'boundary', '--valid', f.valid, '--violation', f.violation, '--expect', expect, ...(replacement ? ['--replacement', replacement] : []), ...extra])
  }
  return f
}

const diagnostic = 'src/app.ts:1: private-import: app imports a private module. Use src/public.ts.'

const command = { executable: 'node', args: ['-e', 'const fs = require("node:fs"); const kind = fs.readFileSync("case.txt", "utf8"); fs.writeFileSync("generated", kind); console.log(kind); process.exit(kind === "valid" ? 0 : 1)'], cwd: '.', versionArgs: ['--version'] }

for (const absolute of [false, true]) {
  test(`proof relocates ${absolute ? 'absolute' : 'relative'} dependency executable links in both copies`, async t => {
    const f = await setup(t, { ...command, args: ['node_modules/.bin/check'] })
    for (const root of [f.valid, f.violation]) {
      await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
      await mkdir(join(root, 'node_modules/check/bin'), { recursive: true })
      await mkdir(join(root, 'node_modules/check/lib'))
      await writeFile(join(root, 'node_modules/check/bin/check'), 'require("../lib/check.cjs")')
      await writeFile(join(root, 'node_modules/check/lib/check.cjs'),
        'const fs = require("node:fs"); const kind = fs.readFileSync("case.txt", "utf8"); fs.writeFileSync(__dirname + "/generated", kind); console.log(kind); process.exit(kind === "valid" ? 0 : 1)')
      await symlink(absolute ? join(root, 'node_modules/check/bin/check') : '../check/bin/check', join(root, 'node_modules/.bin/check'), 'file')
    }
    const before = await Promise.all([snapshot(f.valid), snapshot(f.violation)])
    const result = await f.invoke()
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.cases.map((item: NonNullable<typeof result.data.cases>[number]) => item.execution.exitCode), [0, 1])
    assert.deepEqual(await Promise.all([snapshot(f.valid), snapshot(f.violation)]), before)
  })
}

test('proof preserves source fixtures and records normal rejection with tool version', async t => {
  const f = await setup(t, command)
  const before = await snapshot(f.directory)
  const result = await f.invoke()
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.cases.map((item: NonNullable<typeof result.data.cases>[number]) => item.execution.exitCode), [0, 1])
  assert.equal(result.data.cases[0].execution.toolVersion.stdout.trim(), process.version)
  assert.deepEqual(await snapshot(f.valid), before.valid)
  assert.deepEqual(await snapshot(f.violation), before.violation)
  assert.deepEqual(JSON.parse(await readFile(result.data.path, 'utf8')), result.data)
  assert.equal(Object.hasOwn(await snapshot(dirname(result.data.path)), 'valid'), false)
})

for (const [name, replacement, expected] of [
  ['passing violation', { args: ['-e', `console.log(${JSON.stringify(diagnostic)})`] }, 'failed'],
  ['wrong diagnostic', { args: ['-e', 'const fs = require("node:fs"); process.exit(fs.readFileSync("case.txt", "utf8") === "valid" ? 0 : 1)'] }, 'failed'],
  ['failed setup', { args: ['-e', 'console.log("private"); process.exit(1)'] }, 'blocked'],
  ['missing tool', { executable: 'bstack-missing-native-tool' }, 'blocked'],
  ['failed version', { versionArgs: ['-e', 'process.exit(1)'] }, 'blocked'],
  ['missing cwd', { cwd: 'absent' }, 'blocked'],
  ['timeout', { args: ['-e', 'setInterval(() => {}, 1000)'], timeoutMs: 100 }, 'blocked']
] satisfies [unknown, unknown, unknown][]) {
  test(`${name} cannot prove enforcement`, async t => {
    const f = await setup(t, { ...command, ...replacement })
    const result = await f.invoke()
    assert.equal(result.status, expected)
    assert.notEqual(result.exit, 0)
    assert.equal(result.data.cases[0].status, expected === 'blocked' ? 'blocked' : 'passed')
  })
}

test('a violation whose diagnostic does not name the replacement cannot prove enforcement', async t => {
  const f = await setup(t, command)
  const result = await f.invoke('private-import', 'src/other.ts')
  assert.equal(result.exit, 1)
  assert.deepEqual(result.data.cases.map((item: NonNullable<typeof result.data.cases>[number]) => item.status), ['passed', 'failed'])
  assert.equal(result.problems[0].message, 'violation: Violation output does not name the replacement src/other.ts.')
})

for (const [name, extra] of [['neither a replacement nor a reason', []], ['both a replacement and a reason', ['--replacement', 'src/public.ts', '--no-replacement', 'Nothing replaces it.']]] satisfies [unknown, unknown][]) {
  test(`a proof with ${name} is a usage error`, async t => {
    const f = await setup(t, command)
    const result = await f.invoke('private-import', '', extra)
    assert.equal(result.exit, 3)
    assert.equal(result.problems[0].code, 'missing-proof-options')
  })
}

test('a proof with a reason instead of a replacement passes and reports the reason as a limitation', async t => {
  const f = await setup(t, command)
  const result = await f.invoke('private-import', '', ['--no-replacement', 'The rule removes code and nothing replaces it.'])
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.replacement, null)
  assert.equal(result.data.noReplacementReason, 'The rule removes code and nothing replaces it.')
  assert.equal(result.data.limitations.at(-1), 'The diagnostic was not required to name a replacement: The rule removes code and nothing replaces it.')
  assert.deepEqual(JSON.parse(await readFile(result.data.path, 'utf8')), result.data)
})

for (const [stack, executable, args, versionArgs, owner] of [
  ['ts', 'node', ['boundaries.ts'], ['-p', 'require("typescript").version'], 'packages/core/index.ts'],
  ['py', 'uv', ['run', '--no-sync', 'python', 'boundaries.py'], ['run', '--no-sync', 'python', '--version'], 'ledger.Ledger']
] satisfies [unknown, unknown, unknown, unknown, unknown][]) {
  test(`${stack} native public imports and permitted direction pass while private, alias and cycles fail`, async t => {
    const f = await setup(t, { executable, args, versionArgs, cwd: '.' })
    f.valid = build(t, `${stack}-rule-proof`)
    for (const [kind, rule, replacement] of [['private', 'private-import', owner], ['alias', 'alias-import', owner], ['cycle', 'dependency-cycle', 'a one-way dependency']]) {
      f.violation = build(t, `${stack}-rule-proof-${kind}`)
      const result = await f.invoke(`: ${rule}: `, replacement)
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.data.cases.map((item: NonNullable<typeof result.data.cases>[number]) => item.status), ['passed', 'passed'])
      assert.equal(result.data.cases[0].execution.stdout, '')
      assert.equal(result.data.replacement, replacement)
      t.diagnostic(JSON.stringify({ stack, violation: kind, command: result.data.command,
        cases: result.data.cases.map((item: NonNullable<typeof result.data.cases>[number]) => ({ kind: item.kind, status: item.status, toolVersion: item.execution.toolVersion.stdout.trim(),
          exitCode: item.execution.exitCode, stdout: item.execution.stdout, stderr: item.execution.stderr })) }))
    }
  })
}

for (const [name, mutate] of [
  ['unknown check ID', (f: Awaited<ReturnType<typeof setup>>) => { f.plan.checks[0].id = 'other' }],
  ['skipped check', (f: Awaited<ReturnType<typeof setup>>) => { f.plan.checks[0].skipReason = 'Unavailable.' }],
  ['identical fixtures', (f: Awaited<ReturnType<typeof setup>>) => { f.violation = f.valid }],
  ['string child command', (f: Awaited<ReturnType<typeof setup>>) => { (f.plan.checks[0] as {command: unknown}).command = 'node boundaries.mjs' }]
] satisfies [unknown, unknown][]) {
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
