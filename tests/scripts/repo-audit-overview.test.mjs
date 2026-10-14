import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { build, run, snapshot } from './discovery-fixture.mjs'

// The overview audit is read-only, so its evidence commands run against disposable fixtures and the checklists are read from the installed skill.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit')
// The maintainer's order of skills for each path.
const checklists = {
  'New idea:': ['/vision', '/glossary', '/architecture', '/foundation', '/verification create', '/maintenance', '/agents-md'],
  'Existing repo:': ['/repo-audit', '/vision', '/glossary', '/architecture', '/verification create', '/maintenance', '/agents-md']
}

test('inspect and inventory leave an existing repo byte-identical and list its documents', async t => {
  const repo = build(t, 'clear-goals')
  const before = await snapshot(repo)
  assert.equal(run('inspect', repo).exit, 0)
  const inventory = run('inventory', repo)
  assert.equal(inventory.exit, 0)
  assert.ok(inventory.data.files.some(file => file.path === 'VISION.md' && file.kind === 'vision'))
  assert.deepEqual(await snapshot(repo), before)
})

test('inventory leaves a new-idea workspace byte-identical and reports absent kinds', async t => {
  const workspace = build(t, 'new-idea')
  const before = await snapshot(workspace)
  const result = spawnSync(process.execPath, [join(skill, 'scripts/repo-audit.mjs'), 'inventory', '--workspace', workspace, '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(JSON.parse(result.stdout).data.absent.includes('vision'))
  assert.deepEqual(await snapshot(workspace), before)
})

test('each checklist names its skills in the maintainer order with a reason on every line', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  for (const [heading, order] of Object.entries(checklists)) {
    const lines = document.split(`\n${heading}\n\n`)[1].split('\n\n')[0].split('\n')
    assert.deepEqual(lines.map(line => line.match(/^- \[ \] `([^`]+)`/)[1]), order)
    assert.ok(lines.every(line => / - \S/.test(line)), heading)
  }
})
