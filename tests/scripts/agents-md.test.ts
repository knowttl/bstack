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
    { path: '.agents/skills/beta/SKILL.md', kind: 'skill-description', bytes: 23 },
    { path: '.claude/skills/alpha/SKILL.md', kind: 'skill-description', bytes: 18 }
  ])
  assert.equal(result.data.total.bytes, 41)
})

for (const { name, content, total } of [
  { name: 'plain descriptions with comments', content: 'description: Useful. # note', total: { bytes: 7, lines: 1, tokens: 2 } },
  { name: 'single-quoted escapes', content: "description: 'It''s useful.' # note", total: { bytes: 12, lines: 1, tokens: 3 } },
  { name: 'double-quoted escapes', content: 'description: "Line\\nnext" # note', total: { bytes: 9, lines: 2, tokens: 3 } },
  { name: 'quoted comment characters', content: 'description: "Use # tags"', total: { bytes: 10, lines: 1, tokens: 3 } },
  { name: 'plain comment characters without whitespace', content: 'description: Use#tags', total: { bytes: 8, lines: 1, tokens: 2 } },
  { name: 'folded scalars with comments', content: 'description: > # note\n  First part\n  second part', total: { bytes: 23, lines: 1, tokens: 6 } },
  { name: 'stripped folded scalars', content: 'description: >-\n  First part\n  second part', total: { bytes: 22, lines: 1, tokens: 6 } },
  { name: 'literal scalars', content: 'description: |\n  First\n  second', total: { bytes: 13, lines: 2, tokens: 4 } },
  { name: 'literal scalars retaining blank lines', content: 'description: |+\n  First\n  second\n', total: { bytes: 14, lines: 3, tokens: 4 } },
  { name: 'commented invocation flags', content: 'description: Useful.\ndisable-model-invocation: true # user only', total: { bytes: 0, lines: 0, tokens: 0 } },
  { name: 'quoted invocation keys', content: 'description: Useful.\n"disable-model-invocation": true', total: { bytes: 0, lines: 0, tokens: 0 } },
  { name: 'explicit model invocation', content: 'description: Useful.\ndisable-model-invocation: false # callable', total: { bytes: 7, lines: 1, tokens: 2 } }
]) {
  for (const host of ['.agents', '.claude']) {
    test(`instructions measure decodes ${name} in ${host}`, async t => {
      const { directory, repo } = await emptyRepo(t)
      await writeFiles(repo, { [`${host}/skills/example/SKILL.md`]: `---\n${content}\n---\nBody\n` })
      const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.data.total, total)
    })
  }
}

test('instructions measure reports invalid skill frontmatter instead of returning a misleading total', async t => {
  const { directory, repo } = await emptyRepo(t)
  const path = '.agents/skills/example/SKILL.md'
  await writeFiles(repo, { [path]: '---\ndescription: "unterminated\n---\n' })
  const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.equal(result.status, 'failed')
  assert.deepEqual(result.problems.map(({ code, path }: { code: string; path: string }) => ({ code, path })), [{ code: 'invalid-skill-frontmatter', path }])
})

for (const host of ['.agents', '.claude']) {
  for (const { metadata, measured, total } of [
    { metadata: '', measured: { bytes: 39, lines: 4, tokens: 10 }, total: { bytes: 78, lines: 6, tokens: 21 } },
    { metadata: 'disable-model-invocation: true\n', measured: { bytes: 70, lines: 5, tokens: 18 }, total: { bytes: 109, lines: 7, tokens: 29 } }
  ]) {
    test(`instructions measure preserves whole imported skills in ${host} with metadata ${JSON.stringify(metadata)}`, async t => {
      const { directory, repo } = await emptyRepo(t)
      const path = `${host}/skills/example/SKILL.md`
      const rules = `${host}/skills/example/rules.md`
      await writeFiles(repo, {
        'CLAUDE.md': `@${path}\n`,
        [path]: `---\ndescription: Useful.\n${metadata}---\n@rules.md\n`,
        [rules]: 'Rules\n'
      })
      const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.data.sources, [
        { path: 'CLAUDE.md', kind: 'instructions', bytes: 33, lines: 1, tokens: 9, imports: [path] },
        { path, kind: 'import', ...measured, imports: [rules] },
        { path: rules, kind: 'import', bytes: 6, lines: 1, tokens: 2, imports: [] }
      ])
      assert.deepEqual(result.data.total, total)
    })
  }
}

test('instructions measure expands imports from an AGENTS.md already counted as a root', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFiles(repo, {
    'AGENTS.md': '@docs/rules.md\n',
    'CLAUDE.md': '@AGENTS.md\n',
    'docs/rules.md': 'Rules\n'
  })
  const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.sources.map((source: { path: string }) => source.path), ['AGENTS.md', 'CLAUDE.md', 'docs/rules.md'])
  assert.deepEqual(result.data.total, { bytes: 32, lines: 3, tokens: 9 })
})

test('instructions measure revisits shared imports at shorter depths without exceeding five hops or counting cycles twice', async t => {
  const { directory, repo } = await emptyRepo(t)
  await writeFiles(repo, {
    'CLAUDE.md': '@one.md\n@shared.md\n',
    'one.md': '@two.md\n',
    'two.md': '@three.md\n',
    'three.md': '@four.md\n',
    'four.md': '@shared.md\n',
    'shared.md': '@leaf.md\n@CLAUDE.md\n',
    'leaf.md': '@end.md\n',
    'end.md': '@limit.md\n',
    'limit.md': '@fifth.md\n',
    'fifth.md': '@outside.md\n',
    'outside.md': 'Beyond five hops\n'
  })
  const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.sources.map((source: { path: string }) => source.path), [
    'CLAUDE.md', 'one.md', 'two.md', 'three.md', 'four.md', 'shared.md', 'leaf.md', 'end.md', 'limit.md', 'fifth.md'
  ])
  assert.deepEqual(result.data.sources.find((source: { path: string }) => source.path === 'shared.md').imports, ['leaf.md', 'CLAUDE.md'])
  assert.deepEqual(result.data.sources.find((source: { path: string }) => source.path === 'fifth.md').imports, [])
})

for (const { name, content, imported } of [
  { name: 'indented backtick fences', content: '   ```md\n@hidden.md\n   ```\n@visible.md\n', imported: ['visible.md'] },
  { name: 'indented tilde fences', content: '  ~~~md\n@hidden.md\n ~~~\n@visible.md\n', imported: ['visible.md'] },
  { name: 'shorter delimiters inside a longer fence', content: '````\n```\n@hidden.md\n````\n@visible.md\n', imported: ['visible.md'] },
  { name: 'shorter tilde delimiters inside a longer fence', content: '~~~~\n~~~\n@hidden.md\n~~~~\n@visible.md\n', imported: ['visible.md'] },
  { name: 'longer closing delimiters', content: '```\n@hidden.md\n`````\n@visible.md\n', imported: ['visible.md'] },
  { name: 'different delimiter characters', content: '```\n~~~\n@hidden.md\n```\n@visible.md\n', imported: ['visible.md'] },
  { name: 'closing delimiters with trailing text', content: '~~~\n~~~ text\n@hidden.md\n~~~\n@visible.md\n', imported: ['visible.md'] },
  { name: 'unclosed fences', content: '   ```\n@hidden.md\n@visible.md\n', imported: [] }
]) {
  test(`instructions measure skips imports in ${name}`, async t => {
    const { directory, repo } = await emptyRepo(t)
    await writeFiles(repo, { 'CLAUDE.md': content, 'hidden.md': 'Hidden\n', 'visible.md': 'Visible\n' })
    const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.sources.map((source: { path: string }) => source.path), ['CLAUDE.md', ...imported])
    assert.deepEqual(result.data.sources[0].imports, imported)
  })
}

for (const content of [
  'Example: ` @hidden.md `\n@visible.md\n',
  'Example: `` @hidden.md ``\n@visible.md\n',
  'Example: ``` @hidden.md ```\n@visible.md\n',
  'Example: `` first\n@hidden.md\nlast ``\n@visible.md\n',
  'Example: `` ` @hidden.md ` ``\n@visible.md\n',
  'Example: **`` @hidden.md ``**\n@visible.md\n',
  'Example: `` @hidden.md ` still code ``\n@visible.md\n',
  'Example: `` @hidden.md ``` still code ``\n@visible.md\n'
]) {
  test(`instructions measure skips inline code in ${JSON.stringify(content)}`, async t => {
    const { directory, repo } = await emptyRepo(t)
    await writeFiles(repo, { 'CLAUDE.md': content, 'hidden.md': 'Hidden\n', 'visible.md': 'Visible\n' })
    const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.sources.map((source: { path: string }) => source.path), ['CLAUDE.md', 'visible.md'])
    assert.deepEqual(result.data.sources[0].imports, ['visible.md'])
  })
}

for (const content of [
  '<instructions>\n@visible.md\n</instructions>\n',
  '<div>\n@visible.md\n</div>\n',
  '<!--\n@visible.md\n-->\n',
  '<instructions>\n`` @hidden.md ``\n@visible.md\n</instructions>\n',
  '<instructions>\n   ```md\n@hidden.md\n   ```\n@visible.md\n</instructions>\n',
  'Example: ` unmatched\n\n@visible.md\n`\n',
  'Example: \\` @visible.md \\`\n'
]) {
  for (const { path, sources } of [
    { path: 'CLAUDE.md', sources: ['CLAUDE.md', 'visible.md'] },
    { path: 'container.md', sources: ['CLAUDE.md', 'container.md', 'visible.md'] }
  ]) {
    test(`instructions measure preserves non-code imports in ${path}: ${JSON.stringify(content)}`, async t => {
      const { directory, repo } = await emptyRepo(t)
      await writeFiles(repo, { 'CLAUDE.md': '@container.md\n', [path]: content, 'visible.md': 'Visible\n', 'hidden.md': 'Hidden\n' })
      const result = agentsMd(directory, ['instructions', 'measure', '--repo', repo])
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.data.sources.map((source: { path: string }) => source.path), sources)
      assert.deepEqual(result.data.sources.find((source: { path: string }) => source.path === path).imports, ['visible.md'])
    })
  }
}

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
