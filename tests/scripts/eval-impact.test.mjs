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

test('an unchanged checkout selects no scenarios and an inaccessible base is blocked', async t => {
  const repo = await checkout(t)
  const result = affected(repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.scenarios, [])
  assert.equal(affected(repo, 'missing-base').exit, 2)
})
