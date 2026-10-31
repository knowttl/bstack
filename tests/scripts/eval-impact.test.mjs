import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { repositoryFixture, git } from './discovery-fixture.mjs'

// Impact tests use the real command in a disposable checkout, without agent hosts.
const root = fileURLToPath(new URL('../..', import.meta.url))
const definitions = JSON.parse(await readFile(join(root, 'tests/eval/scenarios/scenarios.json'), 'utf8')).scenarios
const skillNames = Object.keys(JSON.parse(await readFile(join(root, 'runtime/skills.json'), 'utf8')))
// Scenarios that stage a skill, so a change to that skill selects exactly these.
const staging = skill => definitions.filter(item => item.mode !== 'without' &&
  (item.checkpoints.at(-1) === 'final' || item.skills.includes(skill))).map(item => item.id)

async function checkout(t) {
  return repositoryFixture(t, ['scripts', 'runtime', 'skills', 'tests/eval/scenarios', 'tests/fixtures', 'tests/acceptance/cases.json'])
}

function affected(repo, base = 'HEAD') {
  const result = spawnSync(process.execPath, [join(repo, 'scripts/eval.mjs'), 'affected', '--base', base, '--json'], { encoding: 'utf8', cwd: repo })
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

async function edit(repo, path, change) {
  await writeFile(join(repo, path), change(await readFile(join(repo, path), 'utf8')))
}

test('every runtime input selects scenarios without an unmapped fallback', async t => {
  const repo = await checkout(t)
  const keys = []
  for (const directory of ['schemas', 'scripts/commands', 'assets', 'references']) {
    for (const file of await readdir(join(repo, 'runtime', directory), { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue
      const path = resolve(file.parentPath, file.name).slice(resolve(repo, 'runtime').length + 1).replaceAll('\\', '/')
      keys.push(path)
      await edit(repo, `runtime/${path}`, source => source + '\n')
    }
  }
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, keys.sort())
  assert.deepEqual(result.data.unmapped, [])
  assert.deepEqual(result.data.scenarios, definitions.filter(item => item.mode !== 'without').map(item => item.id))
})

test('skill changes select final runs and exclude skill-free runs', async t => {
  const repo = await checkout(t)
  for (const skill of skillNames) await edit(repo, `skills/${skill}/SKILL.md`, source => source + '\n')
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.unmapped, [])
  assert.deepEqual(result.data.scenarios, definitions.filter(item => item.mode !== 'without').map(item => item.id))
})

test('missing bundled runtime sources block impact selection', async t => {
  const repo = await checkout(t)
  await rm(join(repo, 'runtime/scripts/commands/vision-board-build.mjs'))
  const result = affected(repo)
  assert.equal(result.exit, 2, JSON.stringify(result))
  assert.equal(result.status, 'blocked')
})

test('earlier checkpoints depend only on the named skills', async t => {
  const repo = await checkout(t)
  const registry = JSON.parse(await readFile(join(repo, 'tests/eval/scenarios/scenarios.json'), 'utf8'))
  registry.scenarios.find(item => item.id === 'clear-goals').checkpoints = ['foundation']
  await writeFile(join(repo, 'tests/eval/scenarios/scenarios.json'), JSON.stringify(registry))
  git(repo, 'add', 'tests')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Earlier checkpoint')
  await edit(repo, 'skills/vision/SKILL.md', source => source + '\n')
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.unmapped, [])
  assert.deepEqual(result.data.scenarios, staging('vision').filter(id => id !== 'clear-goals'))
})

for (const path of ['runtime/scripts/lib/new-helper.mjs', 'references/maintenance-contract.md']) {
  test(`an unmapped untracked file selects every scenario: ${path}`, async t => {
    const repo = await checkout(t)
    await mkdir(resolve(repo, path, '..'), { recursive: true })
    await writeFile(join(repo, path), 'New guidance.\n')
    const result = affected(repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.unmapped, [path.replace('runtime/', '')])
    assert.deepEqual(result.data.scenarios, definitions.map(item => item.id))
  })
}

test('a new file in a skill folder selects only the scenarios staging that skill', async t => {
  const repo = await checkout(t)
  await writeFile(join(repo, 'skills/glossary/new-guidance.md'), 'New guidance.\n')
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, ['glossary/new-guidance.md'])
  assert.deepEqual(result.data.unmapped, [])
  assert.deepEqual(result.data.scenarios, staging('glossary'))
})

test('skill hunks select their enclosing heading and the scenarios staging that skill', async t => {
  const repo = await checkout(t)
  await edit(repo, 'skills/repo-audit/SKILL.md', source => source.replace('### Step 3: Research the documents\n', '### Step 3: Research the documents\nClarified research guidance.\n'))
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, ['repo-audit/SKILL.md#step-3-research-the-documents'])
  assert.deepEqual(result.data.scenarios, staging('repo-audit'))
})

test('the same heading in two skills maps to separate keys', async t => {
  const repo = await checkout(t)
  for (const skill of ['vision', 'glossary']) await edit(repo, `skills/${skill}/SKILL.md`, source => source.replace('## Scope\n', '## Scope\nClarified scope.\n'))
  const result = affected(repo)
  assert.deepEqual(result.data.keys, ['glossary/SKILL.md#scope', 'vision/SKILL.md#scope'])
  assert.deepEqual(result.data.scenarios, definitions.filter(item => staging('vision').includes(item.id) || staging('glossary').includes(item.id)).map(item => item.id))
})

test('deleted headings retain their old impact key and replacement headings stay within the skill', async t => {
  const repo = await checkout(t)
  await edit(repo, 'skills/repo-audit/SKILL.md', source => source.replace('### Step 3: Research the documents', '### Step 3: Different research'))
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, ['repo-audit/SKILL.md#step-3-different-research', 'repo-audit/SKILL.md#step-3-research-the-documents'])
  assert.deepEqual(result.data.unmapped, [])
  assert.deepEqual(result.data.scenarios, staging('repo-audit'))
})

for (const [direction, heading, keys] of [
  ['deletion', '## Load when', ['repo-audit/SKILL.md#load-when', 'repo-audit/SKILL.md#step-4-print-the-checklist']],
  ['insertion', '## Load when', ['repo-audit/SKILL.md#load-when', 'repo-audit/SKILL.md#step-4-print-the-checklist']],
  ['deletion', '### Step 2: Inspect and inventory', ['repo-audit/SKILL.md#step-1-resolve-the-target-and-path', 'repo-audit/SKILL.md#step-2-inspect-and-inventory']],
  ['insertion', '### Step 2: Inspect and inventory', ['repo-audit/SKILL.md#step-1-resolve-the-target-and-path', 'repo-audit/SKILL.md#step-2-inspect-and-inventory']]
]) {
  test(`heading ${direction} selects the section containing surviving text: ${heading}`, async t => {
    const repo = await checkout(t)
    const path = join(repo, 'skills/repo-audit/SKILL.md')
    const original = await readFile(path, 'utf8')
    const merged = original.replace(`${heading}\n`, '')
    await writeFile(path, merged)
    if (direction === 'insertion') {
      git(repo, 'add', 'skills')
      git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Merged sections')
      await writeFile(path, original)
    }
    const result = affected(repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.keys, keys)
    assert.deepEqual(result.data.scenarios, staging('repo-audit'))
  })
}

// A runtime input selects the scenarios that stage a skill bundling it, however deeply a command imports it.
for (const [key, bundling] of [
  ['scripts/commands/apply.mjs', ['vision', 'glossary', 'architecture', 'foundation', 'maintenance', 'agents-md', 'verification', 'plan']],
  ['scripts/commands/cite-check.mjs', ['repo-audit', 'vision', 'glossary', 'architecture', 'plan']],
  ['scripts/commands/inspect.mjs', ['repo-audit']],
  ['scripts/commands/probe.mjs', ['verification', 'maintenance']],
  ['scripts/commands/vision-board-build.mjs', ['vision']],
  ['scripts/lib/vision-board.mjs', ['vision']],
  ['schemas/findings.schema.json', ['vision', 'glossary', 'architecture', 'foundation', 'verification', 'maintenance', 'agents-md', 'plan']],
  ['schemas/vision-proposals.json', ['vision']],
  ['assets/vision/review-template.html', ['vision']],
  ['references/grilling.md', ['vision', 'glossary', 'architecture', 'foundation', 'plan']]
]) {
  test(`runtime input selects the scenarios staging a skill that bundles it: ${key}`, async t => {
    const repo = await checkout(t)
    await edit(repo, `runtime/${key}`, source => source + '\n')
    const result = affected(repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.keys, [key])
    assert.deepEqual(result.data.unmapped, [])
    assert.deepEqual(result.data.scenarios, definitions.filter(item => bundling.some(skill => staging(skill).includes(item.id))).map(item => item.id))
  })
}

test('a regenerated skill file adds no key of its own to the change in its shared source', async t => {
  const repo = await checkout(t)
  for (const path of ['runtime/scripts/commands/cite-check.mjs', 'skills/repo-audit/scripts/repo-audit.mjs', 'skills/vision/scripts/vision.mjs',
    'runtime/schemas/research-report.json', 'skills/repo-audit/schemas/research-report.json', 'skills/glossary/references/grilling.md']) {
    await edit(repo, path, source => source + '\n')
  }
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, ['schemas/research-report.json', 'scripts/commands/cite-check.mjs'])
  assert.deepEqual(result.data.unmapped, [])
})

test('an unchanged checkout selects no scenarios and an inaccessible base is blocked', async t => {
  const repo = await checkout(t)
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.scenarios, [])
  assert.equal(affected(repo, 'missing-base').exit, 2)
})

test('seeded impact checkouts keep independently staged edits private', async t => {
  const first = await checkout(t)
  const second = await checkout(t)
  await edit(first, 'skills/glossary/SKILL.md', source => source + '\nFirst fixture\n')
  await edit(second, 'skills/vision/SKILL.md', source => source + '\nSecond fixture\n')
  git(first, 'add', 'skills')
  assert.equal(git(second, 'diff', '--cached', '--name-only'), '')
  for (const [repo, skill] of [[first, 'glossary'], [second, 'vision']]) {
    const result = affected(repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.scenarios, staging(skill))
  }
  const fresh = affected(await checkout(t))
  assert.equal(fresh.exit, 0, JSON.stringify(fresh))
  assert.deepEqual(fresh.data.scenarios, [])
})
