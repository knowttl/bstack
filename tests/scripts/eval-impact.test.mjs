import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { emptyRepo, git } from './discovery-fixture.mjs'

// Impact tests use the real command in a disposable checkout, without agent hosts.
const root = fileURLToPath(new URL('../..', import.meta.url))
// These five scenarios exercise maintenance guidance, including both final paths.
const maintenance = ['final-maintained-maintenance', 'final-new-project', 'final-existing-repo', 'maintenance', 'representative-extension']

async function checkout(t) {
  const { repo } = await emptyRepo(t)
  for (const path of ['scripts', 'skills/repo-audit', 'tests/eval/scenarios', 'tests/fixtures', 'tests/acceptance/cases.json']) {
    await mkdir(resolve(repo, path, '..'), { recursive: true })
    await cp(join(root, path), join(repo, path), { recursive: true, filter: source => !source.split(/[\\/]/).includes('node_modules') })
  }
  await symlink(join(root, 'node_modules'), join(repo, 'node_modules'), 'dir')
  await writeFile(join(repo, '.git/info/exclude'), 'node_modules\n')
  git(repo, 'add', 'scripts', 'skills', 'tests')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Impact base')
  return repo
}

function affected(repo, base = 'HEAD') {
  const result = spawnSync(process.execPath, [join(repo, 'scripts/eval.mjs'), 'affected', '--base', base, '--json'], { encoding: 'utf8', cwd: repo })
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

test('impact map covers every skill heading and required file with valid keys', async () => {
  const definitions = JSON.parse(await readFile(join(root, 'tests/eval/scenarios/scenarios.json'), 'utf8')).scenarios
  const skill = await readFile(join(root, 'skills/repo-audit/SKILL.md'), 'utf8')
  const headings = [...skill.matchAll(/^#{2,3} (.+)$/gm)].map(match =>
    `SKILL.md#${match[1].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')}`)
  const keys = definitions.flatMap(item => {
    assert.ok(item.covers.length, item.id)
    assert.equal(new Set(item.covers).size, item.covers.length, item.id)
    return item.covers
  })
  for (const key of keys) {
    if (key.startsWith('SKILL.md#')) assert.ok(headings.includes(key), key)
    else {
      assert.ok(!key.startsWith('/') && !key.split('/').includes('..'), key)
      const info = await stat(join(root, key.startsWith('install/') ? key : `skills/repo-audit/${key}`))
      assert.equal(info.isDirectory(), key.endsWith('/'), key)
    }
  }
  for (const heading of headings) assert.ok(keys.includes(heading), heading)
  for (const directory of ['references', 'schemas', 'scripts/commands', 'install']) {
    const prefix = directory === 'install' ? '' : 'skills/repo-audit/'
    for (const file of await readdir(join(root, prefix, directory), { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue
      const path = resolve(file.parentPath, file.name).slice(resolve(root, prefix).length + 1).replaceAll('\\', '/')
      assert.ok(keys.some(key => key === path || (key.endsWith('/') && path.startsWith(key))), path)
    }
  }
})

test('maintenance reference changes select only the five maintenance scenarios', async t => {
  const repo = await checkout(t)
  const path = join(repo, 'skills/repo-audit/references/maintenance-contract.md')
  await writeFile(path, (await readFile(path, 'utf8')) + '\nClarified maintenance guidance.\n')
  git(repo, 'add', 'skills')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Maintenance guidance')
  const result = affected(repo, 'HEAD^')
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.scenarios, maintenance)
  assert.deepEqual(result.data.unmapped, [])
})

for (const path of ['skills/repo-audit/new-guidance.md', 'references/maintenance-contract.md']) {
  test(`an unmapped untracked file selects every scenario: ${path}`, async t => {
    const repo = await checkout(t)
    await mkdir(resolve(repo, path, '..'), { recursive: true })
    await writeFile(join(repo, path), 'New guidance.\n')
    const result = affected(repo)
    const definitions = JSON.parse(await readFile(join(repo, 'tests/eval/scenarios/scenarios.json'), 'utf8')).scenarios
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.unmapped, [path.replace('skills/repo-audit/', '')])
    assert.deepEqual(result.data.scenarios, definitions.map(item => item.id))
  })
}

test('skill hunks select their enclosing heading instead of invalidating the whole skill', async t => {
  const repo = await checkout(t)
  const path = join(repo, 'skills/repo-audit/SKILL.md')
  await writeFile(path, (await readFile(path, 'utf8')).replace('## Research rules\n', '## Research rules\nClarified research guidance.\n'))
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, ['SKILL.md#research-rules'])
  assert.ok(result.data.scenarios.includes('research-main-typescript'))
  assert.ok(!result.data.scenarios.includes('maintenance'))
})

test('deleted headings retain their old impact key and unknown replacement headings select all', async t => {
  const repo = await checkout(t)
  const path = join(repo, 'skills/repo-audit/SKILL.md')
  await writeFile(path, (await readFile(path, 'utf8')).replace('## Research rules', '## Different research rules'))
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.keys, ['SKILL.md#different-research-rules', 'SKILL.md#research-rules'])
  assert.deepEqual(result.data.unmapped, ['SKILL.md#different-research-rules'])
  assert.equal(result.data.scenarios.length, 21)
})

for (const [direction, heading, keys, scenarios] of [
  ['deletion', '## Research rules', ['SKILL.md#research-rules', 'SKILL.md#write-rules'], ['maintenance', 'final-maintained-maintenance']],
  ['insertion', '## Research rules', ['SKILL.md#research-rules', 'SKILL.md#write-rules'], ['maintenance', 'final-maintained-maintenance']],
  ['deletion', '### Step 2: Resolve project terms', ['SKILL.md#step-1-confirm-intent', 'SKILL.md#step-2-resolve-project-terms'], ['new-idea']],
  ['insertion', '### Step 2: Resolve project terms', ['SKILL.md#step-1-confirm-intent', 'SKILL.md#step-2-resolve-project-terms'], ['new-idea']]
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
    assert.ok(scenarios.every(id => result.data.scenarios.includes(id)), JSON.stringify(result.data.scenarios))
  })
}

for (const [key, scenarios] of [
  ['scripts/commands/apply.mjs', ['new-idea']],
  ['scripts/commands/findings.mjs', ['new-idea', 'maintenance', 'final-maintained-maintenance', 'representative-extension']],
  ['schemas/findings.schema.json', ['new-idea', 'maintenance', 'final-maintained-maintenance']],
  ['schemas/change-set.schema.json', ['new-idea']],
  ['schemas/resume-state.schema.json', ['new-idea']],
  ['SKILL.md#review-before-apply', ['new-idea']],
  ['SKILL.md#write-rules', ['new-idea']],
  ['SKILL.md#verification-rules', ['new-idea', 'existing-repo', 'existing-repo-python']],
  ['scripts/commands/run-checks.mjs', ['final-repeat-audit', 'existing-repo', 'existing-repo-python', 'verification-limitations', 'scope-and-prerequisites']],
  ['schemas/check-plan.json', ['final-repeat-audit', 'existing-repo', 'existing-repo-python', 'verification-limitations', 'scope-and-prerequisites']],
  ['scripts/commands/contract.mjs', ['final-repeat-audit', 'existing-repo', 'verification-limitations']],
  ['SKILL.md#step-3-review-the-vision', ['existing-vision-delta']],
  ['scripts/commands/vision-board-build.mjs', ['existing-vision-delta']],
  ['scripts/commands/vision-board-launch.mjs', ['existing-vision-delta']],
  ['scripts/commands/vision-board-verdicts.mjs', ['existing-vision-delta']],
  ['schemas/vision-proposals.json', ['existing-vision-delta']],
  ['schemas/vision-verdicts.json', ['existing-vision-delta']],
  ['assets/vision/review-template.html', ['existing-vision-delta']],
  ['assets/vision/review.css', ['existing-vision-delta']]
]) {
  test(`exercised input selects its dependent scenarios: ${key}`, async t => {
    const repo = await checkout(t)
    const path = join(repo, 'skills/repo-audit', key.startsWith('SKILL.md#') ? 'SKILL.md' : key)
    const source = await readFile(path, 'utf8')
    const headings = {
      'review-before-apply': '## Review before apply',
      'write-rules': '## Write rules',
      'verification-rules': '## Verification rules',
      'step-3-review-the-vision': '### Step 3: Review the vision'
    }
    const heading = headings[key.slice('SKILL.md#'.length)]
    await writeFile(path, heading ? source.replace(`${heading}\n`, `${heading}\nClarified guidance.\n`) : source + '\n')
    const result = affected(repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.keys, [key])
    assert.deepEqual(result.data.unmapped, [])
    assert.ok(scenarios.every(id => result.data.scenarios.includes(id)), JSON.stringify(result.data.scenarios))
  })
}

for (const key of [
  'scripts/commands/contract.mjs',
  'scripts/commands/evidence.mjs',
  'scripts/commands/evidence-validate.mjs',
  'scripts/commands/docs-check.mjs',
  'scripts/commands/docs-generate.mjs',
  'scripts/commands/run-checks.mjs',
  'scripts/commands/apply.mjs',
  'scripts/commands/findings.mjs',
  'schemas/project.schema.json',
  'schemas/evidence.schema.json',
  'schemas/impact-assessment.json',
  'schemas/check-plan.json',
  'schemas/findings.schema.json',
  'schemas/change-set.schema.json',
  'schemas/resume-state.schema.json'
]) {
  test(`required maintenance input selects all five maintenance flows: ${key}`, async t => {
    const repo = await checkout(t)
    const path = join(repo, 'skills/repo-audit', key)
    await writeFile(path, (await readFile(path, 'utf8')) + '\n')
    const result = affected(repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.keys, [key])
    assert.deepEqual(result.data.unmapped, [])
    assert.ok(maintenance.every(id => result.data.scenarios.includes(id)), JSON.stringify(result.data.scenarios))
  })
}

test('an unchanged checkout selects no scenarios and an inaccessible base is blocked', async t => {
  const repo = await checkout(t)
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.scenarios, [])
  assert.equal(affected(repo, 'missing-base').exit, 2)
})
