import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { build, run, git, snapshot } from './discovery-fixture.mjs'

const hash = text => text === null ? null : createHash('sha256').update(text).digest('hex')
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function findings(repo, paths, category = 'missing-protection') {
  const record = JSON.parse(await readFile(new URL('../inputs/findings-audit.json', import.meta.url), 'utf8'))
  record.target = { mode: 'repo', root: repo, revision: git(repo, 'rev-parse', 'HEAD') }
  record.reviewedScope = paths
  Object.assign(record.findings[0], { files: paths, scope: paths, category })
  const file = join(repo, '.git', 'findings.json')
  await writeFile(file, JSON.stringify(record))
  return { record, file }
}

async function apply(repo, contents, category = 'missing-protection', scope = Object.keys(contents)) {
  const { record, file } = await findings(repo, scope, category)
  const edits = []
  for (const [path, proposed] of Object.entries(contents)) {
    const original = await readFile(join(repo, path), 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return null })
    edits.push({ id: path, findingId: 'F-001', path, originalHash: hash(original), proposedHash: hash(proposed),
      operation: original === null ? 'create' : 'replace-file', payload: { content: proposed }, proposedContent: proposed })
  }
  const plan = { schemaVersion: 1, target: record.target, findings: file, findingsDigest: hash(canonical(record)),
    selectedFindingIds: ['F-001'], reviewedScope: scope.map(path => ({ path, resolvedPath: join(repo, path) })), edits }
  plan.planDigest = hash(canonical(plan))
  const path = join(repo, '.git', 'apply.json')
  await writeFile(path, JSON.stringify(plan))
  assert.equal(run('apply', repo, process.env, ['--plan', path, '--dry-run']).exit, 0)
  const result = run('apply', repo, process.env, ['--plan', path])
  assert.equal(result.exit, 0, JSON.stringify(result))
}

test('ts-shop maintained command accepts documented debt and core imports but rejects new web debt in disposable copies', async t => {
  const repo = build(t, 'ts-shop')
  // Keep the fixture's native TypeScript resolver and complete graph analysis.
  let checker = await readFile(join(repo, 'boundaries.mjs'), 'utf8')
  checker = "import { readFileSync } from 'node:fs'\n" + checker
    .replace('const violations = new Set()', 'const violations = []; const add = (rule, file, key) => violations.push({ rule, path: relative(process.cwd(), file).split(sep).join("/"), key })')
    .replace("violations.add(specifier.startsWith('@storage/') ? 'alias' : 'private')", "add(specifier.startsWith('@storage/') ? 'alias' : 'private', from, specifier)")
    .replace("if ([...edges.keys()].some(file => cycle(file, new Set()))) violations.add('cycle')", "for (const file of edges.keys()) if (cycle(file, new Set())) add('cycle', file, 'dependency-cycle')")
    .replace("console.log(JSON.stringify([...violations].sort()))\nprocess.exitCode = violations.size ? 1 : 0", `
if (process.argv.includes('--report')) console.log(JSON.stringify(violations))
else {
  const baseline = JSON.parse(readFileSync('baseline.json', 'utf8')).entries
  const identity = entry => JSON.stringify([entry.rule, entry.path, entry.key])
  const current = new Set(violations.map(identity))
  const known = new Set(baseline.map(identity))
  const added = violations.filter(entry => !known.has(identity(entry)))
  const removed = baseline.filter(entry => !current.has(identity(entry)))
  console.log(JSON.stringify({ debt: baseline, newDebt: added, removedDebt: removed }))
  process.exitCode = added.length || removed.length ? 1 : 0
}`)
  await apply(repo, { 'boundaries.mjs': checker, 'baseline.json': '{"schemaVersion":1,"entries":[]}' })
  const report = spawnSync(process.execPath, ['boundaries.mjs', '--report'], { cwd: repo, encoding: 'utf8' })
  assert.equal(report.status, 0, report.stderr)
  const violations = JSON.parse(report.stdout)
  const violationsFile = join(repo, '.git', 'violations.json')
  await writeFile(violationsFile, report.stdout)
  const entries = violations.map(violation => ({ ...violation,
    reason: 'Existing audited fixture debt, selected for temporary retention.',
    removalCondition: 'Replace private imports with the public interface and remove the dependency cycle.' }))
  // Initial debt is a complete, reviewed foundation edit, not a refresh of partial diagnostics.
  await apply(repo, { 'baseline.json': JSON.stringify({ schemaVersion: 1, entries }) }, 'debt',
    ['baseline.json', ...new Set(violations.map(item => item.path))])
  assert.equal(run('baseline check', repo, process.env, ['--baseline', 'baseline.json', '--violations', violationsFile]).exit, 0)
  const manifest = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'))
  manifest.scripts.check += ' && node boundaries.mjs'
  await apply(repo, { 'package.json': JSON.stringify(manifest, null, 2) + '\n',
    'packages/core/allowed.ts': "import { price } from './internal/database.ts'; export const permitted = price\n" })
  const before = await snapshot(repo)
  const command = { executable: 'npm', args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
  const plan = { schemaVersion: 1, changeKind: 'feature', acceptanceSources: [{ id: 'design', path: 'DESIGN.md', contentHash: '0'.repeat(64) }],
    acceptanceCases: [{ id: 'scope', sourceId: 'design', pointer: 'UI', outcome: 'New web private imports fail, core private imports pass.', userJourney: false }],
    checks: [{ id: 'maintained', role: 'outcome', required: true, acceptanceCases: ['scope'], inputScopes: ['**'], command }] }
  const planFile = join(repo, '.git', 'proof-plan.json')
  await writeFile(planFile, JSON.stringify(plan))
  const violation = build(t, 'ts-shop')
  // Each source retains its own installed native dependencies and Git identity.
  await cp(repo, violation, { recursive: true, filter: source =>
    source !== join(repo, 'node_modules') && source !== join(repo, '.git') })
  await writeFile(join(violation, 'packages/web/new.ts'), "import { price } from '../core/internal/database.ts'; export const forbidden = price\n")
  const result = run('rule-proof', repo, process.env, ['--check-plan', planFile, '--check-id', 'maintained', '--valid', repo,
    '--violation', violation, '--expect', 'packages/web/new.ts'])
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.cases.map(item => item.execution.exitCode), [0, 1])
  assert.deepEqual(result.data.command, command)
  assert.deepEqual((await snapshot(repo)).packages, before.packages)
  t.diagnostic(JSON.stringify(result.data))
})
