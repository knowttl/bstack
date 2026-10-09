import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { run, snapshot } from './discovery-fixture.mjs'

test('valid pointers, native leaf commands and planned generator outputs validate without writes', async t => {
  const f = await maintenanceRepo(t)
  const before = await snapshot(f.repo)
  const result = run('contract validate', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.contract, f.contract)
  assert.deepEqual(await snapshot(f.repo), before)
})

test('explicit contract path works from an unrelated cwd', async t => {
  const f = await maintenanceRepo(t)
  await copyFile(join(f.repo, '.bstack/project.json'), join(f.repo, 'project ü &.json'))
  assert.equal(run('contract validate', f.repo, process.env, ['--contract', 'project ü &.json']).exit, 0)
})

for (const [name, mutate] of [
  ['unknown version', c => { c.schemaVersion = 2 }],
  ['missing document', c => { c.documents[0].path = 'missing.md' }],
  ['wrong case pointer', c => { c.documents[0].path = 'readme.md' }],
  ['shell string check', c => { c.checks[0].command = 'npm test' }],
  ['unknown check ID', c => { c.rules[0].checkIds = ['absent'] }],
  ['unknown document ID', c => { c.scopes[0].documentIds = ['absent'] }],
  ['unknown rule ID', c => { c.scopes[0].ruleIds = ['absent'] }],
  ['escaping glob', c => { c.scopes[0].paths = ['../outside/**'] }],
  ['absolute glob', c => { c.scopes[0].paths = ['/src/**'] }],
  ['Windows absolute glob', c => { c.scopes[0].paths = ['C:/src/**'] }],
  ['unsupported glob', c => { c.scopes[0].paths = ['src/[ab].mjs'] }],
  ['partial globstar', c => { c.scopes[0].paths = ['src/a**'] }],
  ['escaping check scope', c => { c.checks[0].inputScopes = ['../outside'] }],
  ['escaping generator output', c => { c.generators[0].outputPaths = ['../outside'] }],
  ['invalid timeout', c => { c.checks[0].command.timeoutMs = 0 }],
  ['aggregate validator', c => { c.checks[0].command.args = ['repo-audit.mjs', 'evidence', 'validate'] }],
  ['aggregate docs checker', c => { c.checks[0].command.args = ['repo-audit.mjs', 'docs', 'check'] }],
  ['standalone aggregate', c => { c.checks[0].command.args = ['.bstack/bin/bstack-check.mjs'] }],
  ['version aggregate', c => { c.checks[0].command.versionArgs = ['repo-audit.mjs', 'evidence', 'validate'] }],
  ['copied standards', c => { c.rules[0].text = 'Use modules.' }]
]) {
  test(`${name} rejects the contract`, async t => {
    const f = await maintenanceRepo(t)
    mutate(f.contract)
    await f.save()
    assert.notEqual(run('contract validate', f.repo).exit, 0)
  })
}

for (const collection of ['documents', 'scopes', 'rules', 'checks', 'generators', 'acceptanceSources']) {
  test(`duplicate ${collection} IDs fail`, async t => {
    const f = await maintenanceRepo(t)
    f.contract[collection].push(f.contract[collection][0])
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0].code, 'duplicate-id')
  })
}

for (const [name, scripts, exit] of [
  ['valid chain', { check: 'node --check src/change.mjs && npm run leaf', leaf: 'node --check src/old.mjs' }, 0],
  ['indirect aggregate', { check: 'npm run leaf', leaf: 'node repo-audit.mjs evidence validate' }, 1],
  ['script cycle', { check: 'npm run leaf', leaf: 'npm run check' }, 1],
  ['lifecycle aggregate', { check: 'node --check src/change.mjs', precheck: 'node .bstack/bin/bstack-check.mjs' }, 1],
  ['post lifecycle aggregate', { check: 'node --check src/change.mjs', postcheck: 'node repo-audit.mjs docs check' }, 1],
  ['missing script', { leaf: 'node --version' }, 1],
  ['unsupported shell control', { check: 'node --version || true' }, 1]
]) {
  test(`package script ${name}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
    f.contract.checks[0].command = { executable: 'npm', args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).exit, exit)
  })
}

test('unsupported existing format reports the standalone-contract prerequisite', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'existing.yaml'), 'version: 1\n')
  const result = run('contract validate', f.repo, process.env, ['--contract', 'existing.yaml'])
  assert.equal(result.exit, 2)
  assert.match(result.problems[0].message, /reviewed standalone contract/)
})
