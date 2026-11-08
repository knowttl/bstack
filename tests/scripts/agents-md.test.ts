import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { emptyRepo, snapshot } from './discovery-fixture.ts'

// The skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = join(root, 'skills/agents-md/scripts/agents-md.mjs')
function hash(value: string | Buffer): string
function hash(value: null): null
function hash(value: string | Buffer | null): string | null
function hash(value: string | Buffer | null) { return value === null ? null : createHash('sha256').update(value).digest('hex') }
// The documented digest algorithm is implemented here independently of production.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)!
}

function agentsMd(directory: string, args: readonly string[]) {
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

// Writes the findings and change set an agent records in scratch after the author approves the exact bytes.
async function approvedPlan(directory: string, repo: string, edits: ({ path: string; original: string; proposed: string; } | { path: string; original: string; proposed: null; })[], mode: string) {
  const paths = edits.map((edit) => edit.path)
  const target = { mode, root: repo, revision: null }
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  Object.assign(findings, { target, reviewedScope: paths, requiredOutcomes: ['starting-checks'] })
  Object.assign(findings.findings[0], { scope: paths, files: paths })
  await writeFile(join(directory, 'findings.json'), JSON.stringify(findings))
  const plan = {
    schemaVersion: 1, target, findings: 'findings.json', findingsDigest: hash(canonical(findings)), selectedFindingIds: ['F-001'],
    reviewedScope: paths.map((path) => ({ path, resolvedPath: join(repo, path) })),
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
  assert.deepEqual(result.stdout.match(/^ {2}\S.*$/gm)!.map(line => line.trim()).sort(), ['apply', 'instructions measure', 'inventory', 'state show'])
})

for (const mode of ['repo', 'workspace']) {
  test(`a selected merge in a ${mode} folds the import stub into AGENTS.md and removes CLAUDE.md while scoped and local instructions stay untouched`, async t => {
    const { directory, repo } = await emptyRepo(t)
    if (mode === 'workspace') await rm(join(repo, '.git'), { recursive: true })
    const targetFlag = `--${mode}`
    await mkdir(join(repo, 'packages/web'), { recursive: true })
    const stub = '@AGENTS.md\n'
    const agents = '# Agent instructions\n\nCheck product changes against the purpose and non-goals in [VISION.md](VISION.md).\n'
    const files = { 'AGENTS.md': agents, 'CLAUDE.md': stub, 'VISION.md': '# Vision\n', 'packages/web/CLAUDE.md': 'Distinct web guidance\n', 'CLAUDE.local.md': 'Local guidance\n' }
    for (const [path, content] of Object.entries(files)) await writeFile(join(repo, path), content)

    const beforeInventory = await snapshot(repo)
    const inventory = agentsMd(directory, ['inventory', targetFlag, repo])
    assert.equal(inventory.exit, 0, JSON.stringify(inventory))
    assert.equal(inventory.data.root, repo)
    assert.deepEqual(await snapshot(repo), beforeInventory)
    assert.deepEqual(inventory.data.candidates.map((candidate: NonNullable<typeof inventory.data.candidates>[number]) => candidate.path), ['CLAUDE.md'])
    assert.deepEqual(inventory.data.shadowing.map((file: NonNullable<typeof inventory.data.shadowing>[number]) => file.path), ['CLAUDE.local.md'])

    const merged = agents + 'Run the maintained check with `npm run check`.\n'
    const plan = await approvedPlan(directory, repo, [{ path: 'AGENTS.md', original: agents, proposed: merged }, { path: 'CLAUDE.md', original: stub, proposed: null }], mode)
    const before = await snapshot(repo)
    const preview = agentsMd(directory, ['apply', targetFlag, repo, '--plan', plan, '--dry-run'])
    assert.equal(preview.exit, 0, JSON.stringify(preview))
    assert.deepEqual(await snapshot(repo), before)

    const applied = agentsMd(directory, ['apply', targetFlag, repo, '--plan', plan])
    assert.equal(applied.exit, 0, JSON.stringify(applied))
    assert.equal(await readFile(join(repo, 'AGENTS.md'), 'utf8'), merged)
    const { 'CLAUDE.md': removed, ...expected } = before
    assert.deepEqual(await snapshot(repo), { ...expected, 'AGENTS.md': hash(merged) })
    assert.equal(agentsMd(directory, ['state', 'show', targetFlag, repo, '--run', applied.data.runId]).exit, 0)

    const rechecked = agentsMd(directory, ['inventory', targetFlag, repo])
    assert.equal(rechecked.exit, 0, JSON.stringify(rechecked))
    assert.deepEqual(rechecked.data.candidates, [])
    assert.deepEqual(rechecked.data.shadowing.map((file: NonNullable<typeof rechecked.data.shadowing>[number]) => file.path), ['CLAUDE.local.md'])
  })
}

async function writeFiles(repo: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(repo, path)), { recursive: true })
    await writeFile(join(repo, path), content)
  }
}

test('instructions measure counts each instruction file and import once and skips code and local variants', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFiles(repo, {
    'AGENTS.md': 'Root rules\n',
    'CLAUDE.md': '@AGENTS.md\n',
    'packages/web/CLAUDE.md': 'Web rules\n@docs/web.md\n```\n@docs/ignored.md\n```\n',
    'packages/web/docs/web.md': 'Web import\n',
    'packages/web/docs/ignored.md': 'Ignored\n',
    'CLAUDE.local.md': 'Local\n'
  })
  const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.sources.map(({ path, kind, bytes, lines, tokens, imports }: NonNullable<typeof result.data.sources>[number]) => ({ path, kind, bytes, lines, tokens, imports })), [
    { path: 'AGENTS.md', kind: 'instructions', bytes: 11, lines: 1, tokens: 3, imports: [] },
    { path: 'CLAUDE.md', kind: 'instructions', bytes: 11, lines: 1, tokens: 3, imports: ['AGENTS.md'] },
    { path: 'packages/web/CLAUDE.md', kind: 'instructions', bytes: 48, lines: 5, tokens: 12, imports: ['packages/web/docs/web.md'] },
    { path: 'packages/web/docs/web.md', kind: 'import', bytes: 11, lines: 1, tokens: 3, imports: [] }
  ])
  assert.deepEqual(result.data.total, { bytes: 81, lines: 8, tokens: 21 })
})

test('instructions measure counts descriptions of model-invocable skills only', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFiles(repo, {
    '.claude/skills/alpha/SKILL.md': '---\nname: alpha\ndescription: Does alpha things.\n---\nBody\n',
    '.agents/skills/beta/SKILL.md': '---\nname: beta\ndescription: >\n  First part\n  second part\n---\nBody\n',
    '.claude/skills/gamma/SKILL.md': '---\nname: gamma\ndescription: User only.\ndisable-model-invocation: true\n---\nBody\n'
  })
  const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.sources.map(({ path, kind, bytes }: NonNullable<typeof result.data.sources>[number]) => ({ path, kind, bytes })), [
    { path: '.agents/skills/beta/SKILL.md', kind: 'skill-description', bytes: 22 },
    { path: '.claude/skills/alpha/SKILL.md', kind: 'skill-description', bytes: 18 }
  ])
  assert.equal(result.data.total.bytes, 40)
})

test('configured exclusions leave fixture trees out of inventory and measure', async t => {
  const { directory, repo } = await emptyRepo(t)
  const contract = { schemaVersion: 1, documents: [], scopes: [], rules: [], checks: [], generators: [], acceptanceSources: [], instructions: { exclude: ['tests/fixtures/**'] } }
  await writeFiles(repo, { 'AGENTS.md': 'Root rules\n', 'tests/fixtures/shop/AGENTS.md': 'Fixture rules\n', '.bstack/project.json': JSON.stringify(contract) })
  const inventory = agentsMd(directory, ['inventory', '--repo', repo])
  assert.deepEqual(inventory.data.files.map((file: NonNullable<typeof inventory.data.files>[number]) => file.path), ['AGENTS.md'])
  const measured = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.deepEqual(measured.data.sources.map((source: NonNullable<typeof measured.data.sources>[number]) => source.path), ['AGENTS.md'])
  assert.deepEqual(measured.data.exclude, ['tests/fixtures/**'])
})

test('without configuration inventory and measure include fixture trees', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFiles(repo, { 'AGENTS.md': 'Root rules\n', 'tests/fixtures/shop/AGENTS.md': 'Fixture rules\n' })
  const inventory = agentsMd(directory, ['inventory', '--repo', repo])
  assert.deepEqual(inventory.data.files.map((file: NonNullable<typeof inventory.data.files>[number]) => file.path), ['AGENTS.md', 'tests/fixtures/shop/AGENTS.md'])
  const measured = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.deepEqual(measured.data.sources.map((source: NonNullable<typeof measured.data.sources>[number]) => source.path), ['AGENTS.md', 'tests/fixtures/shop/AGENTS.md'])
})

test('an invalid project contract fails measure with its schema problem', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFiles(repo, { 'AGENTS.md': 'Root rules\n', '.bstack/project.json': JSON.stringify({ schemaVersion: 1, instructions: { exclude: 'tests/**' } }) })
  const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.equal(result.status, 'failed')
  assert.ok(result.problems.some((problem: { code: string }) => problem.code === 'invalid-type'))
})
