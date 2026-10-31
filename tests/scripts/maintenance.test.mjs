import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { emptyRepo, git, snapshot } from './discovery-fixture.mjs'

// The skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = join(root, 'skills/maintenance/scripts/maintenance.mjs')
const checker = join(root, 'skills/maintenance/scripts/bstack-check.mjs')
const hash = value => value === null ? null : createHash('sha256').update(value).digest('hex')
// The documented digest algorithm is implemented here independently of production.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function maintenance(directory, args) {
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

for (const context of [
  '`npm start`',
  '`<a href="missing-inline.md">example</a>`',
  '# Using `node`',
  'An unmatched ` delimiter',
  'An escaped \\` delimiter',
  '``sample ` [ignored](missing-inline.md)``',
  '`multi\n[ignored](missing-inline.md)`',
  '``example\n[label`]: missing-inline.md\nend``',
  String.raw`Escaped \* punctuation and \[ignored](missing-escaped.md)`,
  '```md\n[ignored](missing-fenced.md)\n```\n`[ignored](missing-inline.md)`'
]) {
  test('docs-only checker verifies local links beside code and escapes: ' + context, async t => {
    const f = await emptyRepo(t)
    await mkdir(join(f.repo, '.bstack'))
    await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify({ ...contract,
      documents: [{ id: 'readme', path: 'README.md' }], scopes: [] }))
    await writeFile(join(f.repo, 'README.md'), context + '\n\n[Guide](guide.md)\n')
    const check = () => {
      const result = spawnSync(process.execPath, [checker, '--repo', f.repo, '--docs-only', '--json'], { encoding: 'utf8' })
      return { exit: result.status, ...JSON.parse(result.stdout) }
    }
    const broken = check()
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.code), ['broken-local-link'])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const fixed = check()
    assert.equal(fixed.exit, 0, JSON.stringify(fixed))
    assert.deepEqual(fixed.problems, [])
    assert.deepEqual(fixed.data.coverageLimits, [])
  })
}

// Writes the findings and change set an agent records in scratch after the user approves the exact bytes.
async function approvedPlan(directory, target, edits) {
  const paths = edits.map(edit => edit.path)
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  Object.assign(findings, { target, reviewedScope: paths, requiredOutcomes: ['starting-checks'] })
  Object.assign(findings.findings[0], { scope: paths, files: paths })
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

const contract = {
  schemaVersion: 1,
  documents: [
    { id: 'terms', path: 'GLOSSARY.md', glossary: { context: 'shop', format: 'markdown-bold' } },
    { id: 'design', path: 'docs/design.md' },
    { id: 'vision', path: 'VISION.md' }
  ],
  scopes: [{ id: 'code', paths: ['src/**'], documentIds: ['terms', 'design'], ruleIds: [] }],
  rules: [], checks: [], generators: [], acceptanceSources: []
}
const gate = `document:
  instructions: |
    GLOSSARY.md owns domain terms. docs/design.md owns module boundaries and responsibilities. VISION.md owns purpose, users and non-goals.
    When a change adds, renames or redefines a domain term, update GLOSSARY.md in the same change.
gates:
  - name: docs
    after: document
    command: node .bstack/bin/bstack-check.mjs --repo . --docs-only
`
const pointer = '# Agent instructions\n\nBefore finishing a change, review the documents it affects against the contract in [.bstack/project.json](.bstack/project.json).\n'

async function documentedRepo(t) {
  const f = await emptyRepo(t)
  await mkdir(join(f.repo, 'docs'))
  await mkdir(join(f.repo, 'src'))
  await writeFile(join(f.repo, 'GLOSSARY.md'), '# Shop\n\n**Order**:\nA customer request for products.\n')
  await writeFile(join(f.repo, 'docs/design.md'), '# Design\n\nOrders are priced in [src/a.mjs](../src/a.mjs).\n')
  await writeFile(join(f.repo, 'VISION.md'), '# Vision\n\nA simple shop.\n')
  await writeFile(join(f.repo, 'src/a.mjs'), 'export const a = 1\n')
  f.commit = message => {
    git(f.repo, 'add', '.')
    git(f.repo, '-c', 'user.name=Fixture author', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message)
  }
  return f
}

test('create installs a checker and a docs gate that pass on a true tree and stop a broken link', async t => {
  const f = await documentedRepo(t)
  const target = { mode: 'repo', root: f.repo, revision: null }
  const plan = await approvedPlan(f.directory, target, [
    { path: '.bstack/project.json', original: null, proposed: JSON.stringify(contract, null, 2) + '\n' },
    { path: '.bstack/bin/bstack-check.mjs', original: null, proposed: await readFile(checker, 'utf8') },
    { path: '.no-mistakes.yaml', original: null, proposed: gate },
    { path: 'AGENTS.md', original: null, proposed: pointer }
  ])
  const before = await snapshot(f.repo)
  assert.equal(maintenance(f.directory, ['apply', '--repo', f.repo, '--plan', plan, '--dry-run']).exit, 0)
  assert.deepEqual(await snapshot(f.repo), before)
  const applied = maintenance(f.directory, ['apply', '--repo', f.repo, '--plan', plan])
  assert.equal(applied.exit, 0, JSON.stringify(applied))

  // The gate runs the written command in the worktree through the shell, as no-mistakes does.
  const { command, after } = parse(await readFile(join(f.repo, '.no-mistakes.yaml'), 'utf8')).gates.find(entry => entry.name === 'docs')
  assert.equal(after, 'document')
  const runGate = () => spawnSync('sh', ['-c', command], { cwd: f.repo, encoding: 'utf8' })
  const passed = runGate()
  assert.equal(passed.status, 0, passed.stdout + passed.stderr)

  await writeFile(join(f.repo, 'docs/design.md'), '# Design\n\nOrders are priced in [src/a.mjs](../src/missing.mjs).\n')
  const failed = runGate()
  assert.equal(failed.status, 1, failed.stdout + failed.stderr)
  assert.match(failed.stdout, /broken-local-link/)
})

test('the docs-only checker needs no base or assessment and rejects them', async t => {
  const f = await documentedRepo(t)
  await mkdir(join(f.repo, '.bstack'))
  await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(contract))
  const call = extra => spawnSync(process.execPath, [checker, '--repo', f.repo, '--docs-only', '--json', ...extra], { encoding: 'utf8' })
  assert.equal(call([]).status, 0)
  const rejected = call(['--base', 'HEAD'])
  assert.equal(rejected.status, 3)
  assert.equal(JSON.parse(rejected.stdout).problems[0].code, 'docs-only-input')
})

test('sweep names the mode that fixes each seeded drift, and writes nothing', async t => {
  const f = await documentedRepo(t)
  await mkdir(join(f.repo, '.bstack'))
  await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(contract))
  f.commit('baseline')
  const clean = maintenance(f.directory, ['sweep', '--repo', f.repo])
  assert.equal(clean.exit, 0, JSON.stringify(clean))

  await writeFile(join(f.repo, 'src/b.mjs'), 'export const b = 2\n')
  f.commit('add module')
  await writeFile(join(f.repo, 'GLOSSARY.md'), '# Shop\n\n**Order**:\nA customer request for products, see [pricing](missing.md).\n')
  f.commit('refresh glossary')
  await writeFile(join(f.repo, 'AGENTS.md'), '# Agent instructions\n\nUse the terms in [GLOSSARY.md](GLOSSARY.md) and the rules in [RULES.md](RULES.md).\n')
  // A kit whose plan cannot be read is drift the verification skill repairs.
  await mkdir(join(f.repo, '.agents/skills/verify-shop'), { recursive: true })
  await writeFile(join(f.repo, '.agents/skills/verify-shop/kit.json'), '{}')

  const before = await snapshot(f.repo)
  const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
  assert.equal(swept.exit, 1)
  assert.deepEqual(await snapshot(f.repo), before)
  const fix = (code, path) => swept.problems.filter(problem => problem.code === code && problem.path === path).map(problem => problem.fix)
  assert.deepEqual(fix('broken-local-link', 'GLOSSARY.md'), ['Run /glossary maintain.'])
  assert.deepEqual(fix('broken-local-link', 'AGENTS.md'), ['Run /agents-md.'])
  const kit = swept.problems.filter(problem => problem.fix === 'Run /verification maintain.')
  assert.ok(kit.length > 0, JSON.stringify(swept.problems))
  assert.equal(swept.problems.length, 2 + kit.length)
})

test('sweep passes after a code refactor with current documents and writes nothing', async t => {
  const f = await documentedRepo(t)
  await mkdir(join(f.repo, '.bstack'))
  await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(contract))
  f.commit('baseline')
  await writeFile(join(f.repo, 'src/a.mjs'), 'const value = 1\nexport { value as a }\n')
  f.commit('refactor implementation')
  const before = await snapshot(f.repo)
  const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
  assert.equal(swept.exit, 0, JSON.stringify(swept))
  assert.equal(swept.status, 'passed')
  assert.deepEqual(swept.problems, [])
  assert.deepEqual(await snapshot(f.repo), before)
})

const planDocument = (design, condition) => `# Shop plan\n\n## How to read this\n\nA unit is done only when its evidence passes.\n${condition}\n\n### U1 Price an order\n\nDesign: \`${design}\`\n`

for (const { name, plan, removeSpec, removeDesign, brokenCondition, expected } of [
  { name: 'passes a plan whose condition does not hold yet', plan: planDocument('docs/spec.md:1', 'Remove this plan when `src/done.mjs` exists.'), expected: [] },
  { name: 'reports a plan whose condition holds as finished', plan: planDocument('docs/spec.md:1', 'Remove this plan when `src/a.mjs` exists.'), expected: ['plan-finished'] },
  { name: 'reports a plan that cites a missing design as orphaned', plan: planDocument('docs/spec.md:1', 'Remove this plan when `src/done.mjs` exists.'), removeSpec: true, expected: ['plan-orphaned'] },
  { name: 'reports a plan that cites a missing registered design as orphaned', plan: planDocument('docs/design.md:1', 'Remove this plan when `src/done.mjs` exists.'), removeDesign: true, expected: ['plan-orphaned'] },
  { name: 'reports a finished plan despite a missing registered source', plan: planDocument('docs/spec.md:1', 'Remove this plan when `src/a.mjs` exists.'), removeDesign: true, expected: ['plan-finished'] },
  { name: 'reports a broken condition link as orphaned', plan: planDocument('docs/spec.md:1', 'Remove this plan when `src/done.mjs` exists.'), brokenCondition: true, expected: ['plan-orphaned'] },
  { name: 'reports an unsafe condition as orphaned', plan: planDocument('docs/spec.md:1', 'Remove this plan when `../done.mjs` exists.'), expected: ['plan-orphaned'] },
  { name: 'reports a condition beneath a file as orphaned', plan: planDocument('docs/spec.md:1', 'Remove this plan when `src/a.mjs/done` exists.'), expected: ['plan-orphaned'] },
  { name: 'reports a plan with no readable condition as orphaned', plan: planDocument('docs/spec.md:1', 'Remove it when the work is done.'), expected: ['plan-orphaned'] }
]) {
  test(`sweep ${name} and writes nothing`, async t => {
    const f = await documentedRepo(t)
    await mkdir(join(f.repo, '.bstack'))
    await writeFile(join(f.repo, 'docs/spec.md'), '# Spec\n')
    await writeFile(join(f.repo, 'docs/plan.md'), plan)
    await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify({ ...contract, documents: [...contract.documents, { id: 'plan', path: 'docs/plan.md' }] }))
    f.commit('baseline')
    if (removeSpec) await rm(join(f.repo, 'docs/spec.md'))
    if (removeDesign) await rm(join(f.repo, 'docs/design.md'))
    if (brokenCondition) await symlink('missing.mjs', join(f.repo, 'src/done.mjs'))
    const before = await snapshot(f.repo)
    const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
    assert.deepEqual(swept.problems.map(problem => [problem.code, problem.path]), [
      ...(removeDesign ? [['missing-path', 'docs/design.md']] : []),
      ...expected.map(code => [code, 'docs/plan.md'])
    ])
    assert.equal(swept.exit, expected.length ? 1 : 0, JSON.stringify(swept))
    assert.deepEqual(await snapshot(f.repo), before)
  })
}

for (const collection of ['documents', 'rules', 'acceptanceSources']) for (const { state, path, code } of [
  { state: 'missing', path: 'docs/missing.md', code: 'missing-path' },
  { state: 'broken link', path: 'docs/missing.md', code: 'unresolved-path' },
  { state: 'escaping link', path: 'docs/missing.md', code: 'escaping-path' },
  { state: 'non-file', path: 'docs', code: 'invalid-scope' },
  { state: 'unsafe', path: '../missing.md', code: 'invalid-glob' },
  { state: 'beneath a file', path: 'src/a.mjs/missing.md', code: 'unresolved-path' }
]) {
  test(`sweep inspects a plan despite a ${state} ${collection} source`, async t => {
    const f = await documentedRepo(t)
    await mkdir(join(f.repo, '.bstack'))
    const policy = { ...contract, documents: [...contract.documents, { id: 'plan', path: 'docs/plan.md' }] }
    policy[collection] = [...policy[collection], { id: 'missing', path,
      ...(collection === 'documents' ? {} : { pointer: 'Missing' }), ...(collection === 'rules' ? { checkIds: [] } : {}) }]
    if (state === 'broken link') {
      await writeFile(join(f.repo, 'docs/dependency.md'), '# Design\n')
      await symlink('dependency.md', join(f.repo, path))
      await rm(join(f.repo, 'docs/dependency.md'))
    }
    if (state === 'escaping link') await symlink('../..', join(f.repo, path))
    await writeFile(join(f.repo, 'docs/plan.md'), planDocument(`${path}:1`, 'Remove this plan when `src/done.mjs` exists.'))
    await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(policy))
    const before = await snapshot(f.repo)
    const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
    assert.equal(swept.exit, 1, JSON.stringify(swept))
    assert.deepEqual(swept.problems.map(problem => [problem.code, problem.path]), [
      [code, path], ...(state === 'non-file' ? [] : [['plan-orphaned', 'docs/plan.md']])
    ])
    assert.equal(swept.problems[0].fix, 'Run /maintenance create to correct the registration.')
    if (state !== 'non-file') assert.match(swept.problems[1].fix, /Delete the plan and its AGENTS.md pointer line/)
    const strict = maintenance(f.directory, ['docs', 'check', '--repo', f.repo])
    assert.notEqual(strict.exit, 0)
    assert.deepEqual(strict.problems.map(problem => [problem.code, problem.path]), [[code, path]])
    assert.deepEqual(await snapshot(f.repo), before)
  })
}

test('sweep retains the diagnostic for an unresolvable plan without reading it', async t => {
  const f = await documentedRepo(t)
  await mkdir(join(f.repo, '.bstack'))
  await symlink('missing.md', join(f.repo, 'docs/plan.md'))
  await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify({ ...contract,
    documents: [...contract.documents, { id: 'plan', path: 'docs/plan.md' }] }))
  const before = await snapshot(f.repo)
  const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
  assert.equal(swept.exit, 1, JSON.stringify(swept))
  assert.deepEqual(swept.problems.map(problem => [problem.code, problem.path]), [['unresolved-path', 'docs/plan.md']])
  assert.deepEqual(await snapshot(f.repo), before)
})

test('sweep reports a repo with no contract as the first item for create', async t => {
  const f = await emptyRepo(t)
  const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
  assert.equal(swept.exit, 1)
  assert.deepEqual(swept.problems.map(problem => [problem.code, problem.fix]), [['contract-missing', 'Run /maintenance create.']])
})

for (const { name, path, text } of [
  { name: 'registered design fragment', path: 'docs/design.md', text: '[reference](../reference.md#heading)\n' },
  { name: 'agent pointer HTML', path: 'AGENTS.md', text: '<a href="missing.md">Missing</a>\n' },
  { name: 'agent pointer fragment', path: 'AGENTS.md', text: '[reference](reference.md#heading)\n' }
]) {
  test(`sweep reports incomplete coverage for ${name}`, async t => {
    const f = await documentedRepo(t)
    await mkdir(join(f.repo, '.bstack'))
    await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify({ ...contract,
      documents: [...contract.documents, { id: 'readme', path: 'README.md' }] }))
    await writeFile(join(f.repo, 'README.md'), '# Shop\n')
    await writeFile(join(f.repo, 'reference.md'), '# Heading with `code`\n')
    await writeFile(join(f.repo, path), text)
    f.commit('baseline')
    const before = await snapshot(f.repo)
    const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
    assert.equal(swept.exit, 0, JSON.stringify(swept))
    assert.equal(swept.status, 'passed')
    assert.deepEqual(swept.problems, [])
    assert.equal(swept.data.coverageLimits.length, 1)
    assert.deepEqual(Object.keys(swept.data.coverageLimits[0]).sort(), ['path', 'reason'])
    assert.equal(swept.data.coverageLimits[0].path, path)
    assert.match(swept.data.coverageLimits[0].reason, /review|coverage/)
    assert.deepEqual(await snapshot(f.repo), before)
  })
}

test('sweep fails on a broken link while retaining unchecked scope as data', async t => {
  const f = await documentedRepo(t)
  await mkdir(join(f.repo, '.bstack'))
  await writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(contract))
  await writeFile(join(f.repo, 'docs/design.md'), '[missing](missing.md)\n')
  await writeFile(join(f.repo, 'AGENTS.md'), '<a href="guide.md">Guide</a>\n')
  const swept = maintenance(f.directory, ['sweep', '--repo', f.repo])
  assert.equal(swept.exit, 1, JSON.stringify(swept))
  assert.equal(swept.status, 'failed')
  assert.deepEqual(swept.problems.map(problem => [problem.code, problem.path, problem.fix]),
    [['broken-local-link', 'docs/design.md', 'Run /architecture maintain.']])
  assert.deepEqual(swept.data.coverageLimits, [{ path: 'AGENTS.md', reason: 'HTML, entities and custom anchors require renderer review.' }])
})
