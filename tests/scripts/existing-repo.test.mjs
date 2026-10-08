import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { emptyRepo, build, run, git, snapshot } from './discovery-fixture.mjs'

// The installed commands are exercised together without importing their internals.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function hash(bytes) { return bytes === null ? null : createHash('sha256').update(bytes).digest('hex') }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function plan(context, findings, edits) {
  const findingsFile = join(context.directory, 'findings.json')
  await writeFile(findingsFile, JSON.stringify(findings))
  const change = { schemaVersion: 1, target: findings.target, findings: 'findings.json', findingsDigest: hash(canonical(findings)),
    selectedFindingIds: findings.selectedFindingIds,
    reviewedScope: findings.reviewedScope.map(path => ({ path, resolvedPath: join(context.repo, path) })), edits }
  change.planDigest = hash(canonical(change))
  const path = join(context.directory, 'apply.json')
  await writeFile(path, JSON.stringify(change))
  return path
}

async function edit(repo, path, content, id, findingId) {
  let original = null
  try { original = await readFile(join(repo, path)) } catch (error) { if (error.code !== 'ENOENT') throw error }
  return { id, findingId, path, originalHash: hash(original), proposedHash: hash(content), proposedContent: content,
    operation: content === null ? 'delete' : original === null ? 'create' : 'replace-file', payload: content === null ? {} : { content } }
}

test('selected root instruction merge and audit apply preserve scoped instructions, dirty work and the native journey', async t => {
  const context = await emptyRepo(t)
  const repo = context.repo = build(t, 'dirty-work')
  const env = { ...process.env, XDG_CACHE_HOME: join(context.directory, 'cache'), LOCALAPPDATA: join(context.directory, 'cache') }
  delete env.NODE_TEST_CONTEXT
  const instructions = '# Instructions\nUse DESIGN.md for the pricing contract.\nRun node --test price.test.mjs.\n'
  await writeFile(join(repo, 'AGENTS.md'), instructions)
  await writeFile(join(repo, 'CLAUDE.md'), instructions)
  await mkdir(join(repo, 'scoped'))
  await writeFile(join(repo, 'scoped', 'CLAUDE.md'), '# Scoped\nKeep this distinct guidance.\n')
  await writeFile(join(repo, 'CLAUDE.local.md'), '# Local\nKeep this local guidance.\n')
  const before = await snapshot(repo)
  assert.equal(run('inspect', repo, env).exit, 0)
  const inventory = run('inventory', repo, env)
  assert.equal(inventory.exit, 0)
  assert.ok(inventory.data.candidates.some(candidate => candidate.path === 'CLAUDE.md'))
  const source = await readFile(join(repo, 'DESIGN.md'))
  const checks = { schemaVersion: 1, changeKind: 'document-config',
    acceptanceSources: [{ id: 'pricing', path: 'DESIGN.md', contentHash: hash(source) }],
    acceptanceCases: [{ id: 'quote', sourceId: 'pricing', pointer: 'A quote is quantity multiplied by 12.', outcome: 'Quote preserves quantity multiplied by 12.', userJourney: true }],
    checks: [{ id: 'quote', role: 'outcome', required: true, acceptanceCases: ['quote'], inputScopes: ['price.mjs', 'price.test.mjs'],
      command: { executable: 'node', args: ['--test', 'price.test.mjs'], cwd: '.', versionArgs: ['--version'] } }] }
  const checksFile = join(context.directory, 'checks.json')
  await writeFile(checksFile, JSON.stringify(checks))
  assert.equal(run('run-checks', repo, env, ['--plan', checksFile]).exit, 0)
  const originalPrice = await readFile(join(repo, 'price.mjs'))
  await writeFile(join(repo, 'price.mjs'), 'export function quote(quantity) { return quantity * 13 }\n')
  assert.equal(run('run-checks', repo, env, ['--plan', checksFile]).exit, 1)
  await writeFile(join(repo, 'price.mjs'), originalPrice)
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json')))
  findings.target = { mode: 'repo', root: repo, revision: git(repo, 'rev-parse', 'HEAD') }
  findings.nextChange = 'Consolidate equivalent root instructions and record the audit.'
  findings.reviewedScope = ['AGENTS.md', 'CLAUDE.md', 'docs/repo-audit.md']
  findings.sources = [{ id: 'contract', pointer: 'DESIGN.md:3', intent: 'documented', summary: 'Quotes multiply quantity by 12.' }]
  Object.assign(findings.findings[0], { problem: 'Root instructions are duplicated.', files: ['AGENTS.md', 'CLAUDE.md'],
    scope: findings.reviewedScope, sourceIds: ['contract'], blocksNextChange: false,
    principle: 'One source for root instructions', consequence: 'Copies can diverge.', fix: 'Retain AGENTS.md and remove the equivalent CLAUDE.md.',
    verification: 'Run the native quote journey and compare preserved instruction and dirty bytes.' })
  findings.requiredOutcomes = ['starting-checks', 'journey']
  findings.limitations = ['Maintained enforcement and portable maintenance are pending.']
  const changes = await plan(context, findings, [await edit(repo, 'AGENTS.md', instructions, 'E-001', 'F-001'),
    await edit(repo, 'CLAUDE.md', null, 'E-002', 'F-001')])
  const preview = run('apply', repo, env, ['--plan', changes, '--dry-run'])
  assert.equal(preview.exit, 0, JSON.stringify(preview))
  assert.deepEqual(await snapshot(repo), before)
  assert.equal(run('apply', repo, env, ['--plan', changes]).exit, 0)
  const captured = run('run-checks', repo, env, ['--plan', checksFile])
  assert.equal(captured.exit, 0)
  const findingsFile = join(context.directory, 'findings.json')
  findings.findings[0].resolved = true
  await writeFile(findingsFile, JSON.stringify(findings))
  const assessed = run('findings validate', repo, env, ['--findings', findingsFile])
  const artifact = captured.data.path
  const artifactHash = hash(await readFile(artifact))
  findings.execution = findings.requiredOutcomes.map((outcome, index) => ({ id: `evidence-${index}`, outcome, status: 'passed',
    fingerprint: assessed.data.fingerprint, artifact, artifactHash, method: 'Native quote check captured after instruction apply.' }))
  await writeFile(findingsFile, JSON.stringify(findings))
  const report = run('findings render', repo, env, ['--findings', findingsFile])
  assert.equal(report.data.result, 'ready for the stated next change')
  const content = await readFile(report.data.path, 'utf8')
  const auditPlan = await plan(context, findings, [await edit(repo, 'docs/repo-audit.md', content, 'E-003', 'F-001')])
  assert.equal(run('apply', repo, env, ['--plan', auditPlan, '--dry-run']).exit, 0)
  assert.equal(run('apply', repo, env, ['--plan', auditPlan]).exit, 0)
  assert.equal(await readFile(join(repo, 'docs/repo-audit.md'), 'utf8'), content)
  const finalChecks = run('run-checks', repo, env, ['--plan', checksFile])
  assert.equal(finalChecks.exit, 0)
  assert.equal(run('findings validate', repo, env, ['--findings', findingsFile]).data.result, 'verification blocked')
  const finalFingerprint = run('findings validate', repo, env, ['--findings', findingsFile]).data.fingerprint
  const finalHash = hash(await readFile(finalChecks.data.path))
  findings.execution = findings.execution.map(record => ({ ...record, fingerprint: finalFingerprint, artifact: finalChecks.data.path, artifactHash: finalHash }))
  await writeFile(findingsFile, JSON.stringify(findings))
  assert.equal(run('findings validate', repo, env, ['--findings', findingsFile]).data.result, 'ready for the stated next change')
  const after = await snapshot(repo)
  delete before['CLAUDE.md']
  delete after.docs
  assert.deepEqual(after, before)
})
