import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { emptyRepo, snapshot } from './discovery-fixture.mjs'

// The skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = join(root, 'skills/agents-md/scripts/agents-md.mjs')
const hash = value => value === null ? null : createHash('sha256').update(value).digest('hex')
// The documented digest algorithm is implemented here independently of production.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function agentsMd(directory, args) {
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

// Writes the findings and change set an agent records in scratch after the author approves the exact bytes.
async function approvedPlan(directory, repo, edits) {
  const paths = edits.map(edit => edit.path)
  const target = { mode: 'repo', root: repo, revision: null }
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  Object.assign(findings, { target, reviewedScope: paths, requiredOutcomes: ['starting-checks'] })
  Object.assign(findings.findings[0], { scope: paths, files: paths })
  await writeFile(join(directory, 'findings.json'), JSON.stringify(findings))
  const plan = {
    schemaVersion: 1, target, findings: 'findings.json', findingsDigest: hash(canonical(findings)), selectedFindingIds: ['F-001'],
    reviewedScope: paths.map(path => ({ path, resolvedPath: join(repo, path) })),
    edits: edits.map((edit, index) => ({ id: `E-${index + 1}`, findingId: 'F-001', path: edit.path, originalHash: hash(edit.original),
      proposedHash: hash(edit.proposed), operation: edit.proposed === null ? 'delete' : edit.original === null ? 'create' : 'replace-file',
      payload: edit.proposed === null ? {} : { content: edit.proposed }, proposedContent: edit.proposed })),
    planDigest: ''
  }
  const { planDigest, ...reviewed } = plan
  plan.planDigest = hash(canonical(reviewed))
  const file = join(directory, `plan-${plan.planDigest}.json`)
  await writeFile(file, JSON.stringify(plan))
  return file
}

test('the agents-md skill ships only the commands its procedure runs', () => {
  const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()).sort(), ['apply', 'inventory', 'state show'])
})

test('a selected merge folds the import stub into AGENTS.md and removes CLAUDE.md while scoped and local instructions stay untouched', async t => {
  const { directory, repo } = await emptyRepo(t)
  await mkdir(join(repo, 'packages/web'), { recursive: true })
  const stub = '@AGENTS.md\n'
  const agents = '# Agent instructions\n\nCheck product changes against the purpose and non-goals in [VISION.md](VISION.md).\n'
  const files = { 'AGENTS.md': agents, 'CLAUDE.md': stub, 'VISION.md': '# Vision\n', 'packages/web/CLAUDE.md': 'Distinct web guidance\n', 'CLAUDE.local.md': 'Local guidance\n' }
  for (const [path, content] of Object.entries(files)) await writeFile(join(repo, path), content)

  const inventory = agentsMd(directory, ['inventory', '--repo', repo])
  assert.equal(inventory.exit, 0, JSON.stringify(inventory))
  assert.deepEqual(inventory.data.candidates.map(candidate => candidate.path), ['CLAUDE.md'])
  assert.deepEqual(inventory.data.shadowing.map(file => file.path), ['CLAUDE.local.md'])

  const merged = agents + 'Run the maintained check with `npm run check`.\n'
  const plan = await approvedPlan(directory, repo, [{ path: 'AGENTS.md', original: agents, proposed: merged }, { path: 'CLAUDE.md', original: stub, proposed: null }])
  const before = await snapshot(repo)
  const preview = agentsMd(directory, ['apply', '--repo', repo, '--plan', plan, '--dry-run'])
  assert.equal(preview.exit, 0, JSON.stringify(preview))
  assert.deepEqual(await snapshot(repo), before)

  const applied = agentsMd(directory, ['apply', '--repo', repo, '--plan', plan])
  assert.equal(applied.exit, 0, JSON.stringify(applied))
  assert.equal(await readFile(join(repo, 'AGENTS.md'), 'utf8'), merged)
  const { 'CLAUDE.md': removed, ...expected } = before
  assert.deepEqual(await snapshot(repo), { ...expected, 'AGENTS.md': hash(merged) })
  assert.equal(agentsMd(directory, ['state', 'show', '--repo', repo, '--run', applied.data.runId]).exit, 0)

  const rechecked = agentsMd(directory, ['inventory', '--repo', repo])
  assert.deepEqual(rechecked.data.candidates, [])
  assert.deepEqual(rechecked.data.shadowing.map(file => file.path), ['CLAUDE.local.md'])
})
