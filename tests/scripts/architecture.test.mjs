import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { emptyRepo, git, runArchitecture } from './discovery-fixture.mjs'

// The skill is driven only through its installed entry point, as the user's agent would.
const entry = join(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), 'skills/architecture/scripts/architecture.mjs')

function commit(repo, message) {
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture author', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', message)
  return git(repo, 'rev-parse', 'HEAD')
}

test('the architecture skill ships only the commands its procedure runs', () => {
  const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()).sort(),
    ['apply', 'baseline check', 'cite-check', 'findings validate', 'measure', 'overlap', 'rule-proof', 'state show'])
})

test('a maintain pass finds the module added since the design was reviewed, its shared registry and a provable rule', async t => {
  const { directory, repo } = await emptyRepo(t)
  const env = { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  await mkdir(join(repo, 'src/core'), { recursive: true })
  await writeFile(join(repo, 'DESIGN.md'), '# Design\n\nThe core module owns pricing.\n')
  await writeFile(join(repo, 'src/core/price.mjs'), 'export const price = 1\n')
  await writeFile(join(repo, 'src/registry.mjs'), 'export const modules = ["core"]\n')
  const baseline = commit(repo, 'design reviewed')
  assert.equal(git(repo, 'log', '-1', '--format=%H', '--', 'DESIGN.md'), baseline)

  await mkdir(join(repo, 'src/billing'))
  await writeFile(join(repo, 'src/billing/invoice.mjs'), 'import { price } from "../core/price.mjs"\nexport const invoice = price\n')
  await writeFile(join(repo, 'src/registry.mjs'), 'export const modules = ["core", "billing"]\n')
  const added = commit(repo, 'add billing')
  await writeFile(join(repo, 'src/registry.mjs'), 'export const modules = ["core", "billing", "audit"]\n')
  const edited = commit(repo, 'register audit')

  const measured = runArchitecture('measure', repo, env, ['--range', `${baseline}..HEAD`])
  assert.equal(measured.exit, 0, JSON.stringify(measured))
  assert.deepEqual(measured.data.files.find(file => file.path === 'src/billing/invoice.mjs').commits, [added])
  assert.deepEqual(measured.data.files.find(file => file.path === 'src/registry.mjs').commits, [edited, added])
  assert.deepEqual(measured.data.files.find(file => file.path === 'src/core/price.mjs').commits, [])

  const plans = ['billing', 'audit'].map(id => join(directory, `${id}.json`))
  await writeFile(plans[0], JSON.stringify({ schemaVersion: 1, id: 'billing', writePaths: ['src/billing/**', 'src/registry.mjs'], contracts: [] }))
  await writeFile(plans[1], JSON.stringify({ schemaVersion: 1, id: 'audit', writePaths: ['src/audit/**', 'src/registry.mjs'], contracts: [] }))
  const overlap = runArchitecture('overlap', repo, env, ['--plans', ...plans])
  assert.equal(overlap.exit, 0, JSON.stringify(overlap))
  assert.deepEqual(overlap.data.sharedPaths.map(shared => shared.examplePath), ['src/registry.mjs'])

  // The new boundary is a rule only once a clean copy passes and a seeded private import fails it.
  const valid = join(directory, 'valid')
  const violation = join(directory, 'violation')
  for (const [root, source] of [[valid, 'import "./public.mjs"'], [violation, 'import "../core/private.mjs"']]) {
    await mkdir(root)
    await writeFile(join(root, 'source.mjs'), source)
  }
  const checkPlan = join(directory, 'check-plan.json')
  const rule = 'const source = require("node:fs").readFileSync("source.mjs", "utf8"); if (source.includes("/private")) { console.error("private import"); process.exit(1) }'
  await writeFile(checkPlan, JSON.stringify({ schemaVersion: 1, changeKind: 'feature', acceptanceSources: [{ id: 'design', path: 'DESIGN.md', contentHash: '0'.repeat(64) }],
    acceptanceCases: [{ id: 'boundary', sourceId: 'design', pointer: 'core', outcome: 'Private imports fail.', userJourney: false }],
    checks: [{ id: 'boundary', role: 'outcome', required: true, acceptanceCases: ['boundary'], inputScopes: ['**'],
      command: { executable: 'node', args: ['-e', rule], cwd: '.', versionArgs: ['--version'] } }] }))
  const proof = runArchitecture('rule-proof', repo, env, ['--check-plan', checkPlan, '--check-id', 'boundary', '--valid', valid, '--violation', violation, '--expect', 'private import'])
  assert.equal(proof.exit, 0, JSON.stringify(proof))
  assert.deepEqual(proof.data.cases.map(item => item.execution.exitCode), [0, 1])

  // Debt that predates the rule stays visible, and a new violation is rejected.
  const debt = { rule: 'private-import', path: 'src/billing/invoice.mjs', key: 'core/price', reason: 'Billing predates the public pricing interface.', removalCondition: 'Import the public pricing interface.' }
  await writeFile(join(repo, 'baseline.json'), JSON.stringify({ schemaVersion: 1, entries: [debt] }))
  const violations = join(directory, 'violations.json')
  await writeFile(violations, JSON.stringify([{ rule: debt.rule, path: debt.path, key: debt.key }]))
  const retained = runArchitecture('baseline check', repo, env, ['--baseline', 'baseline.json', '--violations', violations])
  assert.equal(retained.exit, 0, JSON.stringify(retained))
  assert.deepEqual(retained.data.debt, [debt])
  await writeFile(violations, JSON.stringify([{ rule: debt.rule, path: debt.path, key: debt.key }, { rule: debt.rule, path: 'src/audit/log.mjs', key: 'core/price' }]))
  const rejected = runArchitecture('baseline check', repo, env, ['--baseline', 'baseline.json', '--violations', violations])
  assert.equal(rejected.exit, 1)
  assert.equal(rejected.problems[0].code, 'new-debt')
})
