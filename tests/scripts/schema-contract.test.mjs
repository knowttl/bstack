import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Invoke the installed entry point from outside its own working directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Test fixtures stay outside the installed skill package.
const inputs = join(root, 'tests', 'inputs')
// All assertions exercise dispatch and the result envelope.
const entry = join(root, 'skills', 'repo-audit', 'scripts', 'repo-audit.mjs')

function run(workspace, fixture, schema) {
  const args = [entry, 'contract-test', '--workspace', workspace, '--input', join(inputs, fixture), '--json']
  if (schema) args.push('--schema', join(inputs, schema))
  const result = spawnSync(process.execPath, args, { cwd: workspace, encoding: 'utf8' })
  assert.equal(result.stderr, '')
  return { exit: result.status, result: JSON.parse(result.stdout) }
}

test('valid schema data dispatches from another cwd without changing the workspace', async t => {
  const workspace = await mkdtemp(join(tmpdir(), 'bstack schema ü & '))
  t.after(() => rm(workspace, { recursive: true, force: true }))
  const result = run(workspace, 'schema-valid.json')
  assert.equal(result.exit, 0)
  assert.equal(result.result.command, 'contract-test')
  assert.equal(result.result.status, 'passed')
  assert.equal(result.result.data.records.length, 2)
  assert.deepEqual(await readdir(workspace), [])
})

for (const [fixture, schema, codes, messages] of [
  ['schema-invalid.json', undefined, ['invalid-const', 'unknown-field', 'invalid-enum', 'invalid-pattern', 'duplicate-id', 'missing-id', 'invalid-type'], ['extra', 'one']],
  ['schema-valid.json', 'schema-unknown-keywords.json', ['unsupported-keyword'], ['format', 'uniqueItems', 'allOf']],
  ['schema-valid.json', 'schema-invalid-definition.json', ['invalid-schema'], ['type', 'required', 'properties', 'schema must be an object', 'minItems', 'minLength', 'pattern', 'enum', 'title', '$schema']],
  ['schema-empty.json', undefined, ['min-items'], []],
  ['schema-missing.json', undefined, ['missing-field'], ['records']],
  ['schema-wrong-types.json', undefined, ['invalid-type', 'min-length', 'missing-id', 'invalid-pattern'], []],
  ['schema-map-invalid.json', 'schema-map.json', ['invalid-type'], []],
  ['schema-malformed.json', undefined, ['invalid-input'], []]
]) {
  test(`${fixture} with ${schema ?? 'the installed schema'} fails with named problems and no writes`, async t => {
    const workspace = await mkdtemp(join(tmpdir(), 'bstack schema '))
    t.after(() => rm(workspace, { recursive: true, force: true }))
    const { exit, result } = run(workspace, fixture, schema)
    assert.equal(exit, 1)
    assert.equal(result.status, 'failed')
    for (const code of codes) assert.ok(result.problems.some(problem => problem.code === code), code)
    for (const message of messages) assert.ok(result.problems.some(problem => problem.message.includes(message)), message)
    assert.ok(result.problems.every(problem => problem.path && problem.fix))
    assert.deepEqual(await readdir(workspace), [])
  })
}

test('schema-valued additional properties validates each map value', () => {
  assert.equal(run(tmpdir(), 'schema-map-valid.json', 'schema-map.json').exit, 0)
})

test('command help succeeds with its implementation absent while execution reports blocked', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bstack help '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await cp(join(root, 'skills', 'repo-audit', 'scripts'), join(directory, 'scripts'), { recursive: true })
  await rm(join(directory, 'scripts', 'commands'), { recursive: true })
  const copy = join(directory, 'scripts', 'repo-audit.mjs')
  const help = spawnSync(process.execPath, [copy, 'contract-test', '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /--input <file>/)
  assert.match(help.stdout, /--schema <file>/)
  const execution = spawnSync(process.execPath, [copy, 'contract-test', '--workspace', directory, '--input', join(inputs, 'schema-valid.json'), '--json'], { encoding: 'utf8' })
  assert.equal(execution.status, 2)
  assert.equal(JSON.parse(execution.stdout).problems[0].code, 'command-unavailable')
})

test('dispatch rejects unsupported arguments before loading the command', () => {
  const result = spawnSync(process.execPath, [entry, 'contract-test', '--unknown', '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 3)
  assert.deepEqual(JSON.parse(result.stdout).problems.map(problem => problem.code), ['unknown-option', 'missing-target'])
})
