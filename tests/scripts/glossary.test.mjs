import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { maintenanceRepo } from './maintenance-fixture.mjs'

// The skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = join(root, 'skills/glossary/scripts/glossary.mjs')
const hash = value => value === null ? null : createHash('sha256').update(value).digest('hex')
// The documented digest algorithm is implemented here independently of production.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function glossary(directory, args) {
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

// Writes the findings and change set an agent records in scratch after the user approves the exact bytes.
async function approvedPlan(directory, target, edits) {
  const paths = edits.map(edit => edit.path)
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  findings.target = target
  findings.reviewedScope = paths
  findings.findings[0].scope = paths
  findings.findings[0].files = paths
  findings.requiredOutcomes = ['starting-checks']
  await writeFile(join(directory, 'findings.json'), JSON.stringify(findings))
  const plan = {
    schemaVersion: 1, target, findings: 'findings.json', findingsDigest: hash(canonical(findings)), selectedFindingIds: ['F-001'],
    reviewedScope: paths.map(path => ({ path, resolvedPath: join(target.root, path) })),
    edits: edits.map((edit, index) => ({ id: `E-${index + 1}`, findingId: 'F-001', path: edit.path, originalHash: hash(edit.original),
      proposedHash: hash(edit.proposed), operation: edit.original === null ? 'create' : 'replace-file', payload: { content: edit.proposed }, proposedContent: edit.proposed })),
    planDigest: ''
  }
  const { planDigest, ...reviewed } = plan
  plan.planDigest = hash(canonical(reviewed))
  const file = join(directory, `plan-${plan.planDigest}.json`)
  await writeFile(file, JSON.stringify(plan))
  return file
}

test('the glossary skill ships only the commands its procedure runs', () => {
  const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()), ['docs check', 'apply', 'state show', 'cite-check'])
})

test('a new idea gets its approved glossary and nothing else, and only after the exact bytes are approved', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bstack glossary '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const workspace = join(directory, 'idea')
  await mkdir(workspace)
  const proposed = '# Pantry\n\n**Item**:\nA named pantry supply.\nAvoid: Product\n'
  const plan = await approvedPlan(directory, { mode: 'workspace', root: workspace, revision: null }, [{ path: 'GLOSSARY.md', original: null, proposed }])
  const preview = glossary(directory, ['apply', '--workspace', workspace, '--plan', plan, '--dry-run'])
  assert.equal(preview.exit, 0, JSON.stringify(preview))
  assert.deepEqual(await readdir(workspace), [])
  const applied = glossary(directory, ['apply', '--workspace', workspace, '--plan', plan])
  assert.equal(applied.exit, 0, JSON.stringify(applied))
  assert.deepEqual(await readdir(workspace), ['GLOSSARY.md'])
  assert.equal(await readFile(join(workspace, 'GLOSSARY.md'), 'utf8'), proposed)
})

test('an existing repo registers its new glossary, maintains it, and the check catches a repeated term', async t => {
  const f = await maintenanceRepo(t)
  const target = { mode: 'repo', root: f.repo, revision: null }
  const created = '# Ordering\n\n**Order**:\nA customer\'s request for a set of products.\nAvoid: Purchase\n'
  const registered = JSON.stringify({ ...f.contract, documents: [...f.contract.documents, { id: 'terms', path: 'GLOSSARY.md', glossary: { context: 'ordering', format: 'markdown-bold' } }] })
  const create = await approvedPlan(f.directory, target, [{ path: 'GLOSSARY.md', original: null, proposed: created },
    { path: '.bstack/project.json', original: await readFile(join(f.repo, '.bstack/project.json'), 'utf8'), proposed: registered }])
  const applied = glossary(f.directory, ['apply', '--repo', f.repo, '--plan', create])
  assert.equal(applied.exit, 0, JSON.stringify(applied))
  const state = glossary(f.directory, ['state', 'show', '--repo', f.repo, '--run', applied.data.runId])
  assert.equal(state.exit, 0, JSON.stringify(state))
  const checked = glossary(f.directory, ['docs', 'check', '--repo', f.repo])
  assert.equal(checked.exit, 0, JSON.stringify(checked))
  assert.ok(checked.data.documents.some(document => document.path === 'GLOSSARY.md'))
  // The format the guide teaches must be fully checkable, not skipped as a coverage limit.
  assert.deepEqual(checked.data.coverageLimits, [])

  const maintained = created + '\n**Customer**:\nA person or organisation that places orders.\nAvoid: Client\n'
  const maintain = await approvedPlan(f.directory, target, [{ path: 'GLOSSARY.md', original: created, proposed: maintained }])
  assert.equal(glossary(f.directory, ['apply', '--repo', f.repo, '--plan', maintain]).exit, 0)
  assert.equal(await readFile(join(f.repo, 'GLOSSARY.md'), 'utf8'), maintained)
  assert.equal(glossary(f.directory, ['docs', 'check', '--repo', f.repo]).exit, 0)

  const repeated = maintained + '\n**order**:\nA second meaning.\n'
  const repeat = await approvedPlan(f.directory, target, [{ path: 'GLOSSARY.md', original: maintained, proposed: repeated }])
  assert.equal(glossary(f.directory, ['apply', '--repo', f.repo, '--plan', repeat]).exit, 0)
  const failed = glossary(f.directory, ['docs', 'check', '--repo', f.repo])
  assert.equal(failed.exit, 1)
  assert.equal(failed.problems[0].code, 'duplicate-term')
})
