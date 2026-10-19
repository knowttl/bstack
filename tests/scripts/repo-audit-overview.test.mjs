import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { marked } from 'marked'
import { build, run, snapshot } from './discovery-fixture.mjs'

const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit')

test('installed repo-audit prompt emits both checklist orders with plan last', async t => {
  const workspace = build(t, 'new-idea')
  const installed = spawnSync(process.execPath, [resolve(skill, '../../install/install.mjs'),
    '--scope', 'project', '--project', workspace, '--host', 'agents', '--skill', 'repo-audit', '--json'], { encoding: 'utf8' })
  assert.equal(installed.status, 0, installed.stdout + installed.stderr)
  const prompt = await readFile(join(workspace, '.agents/skills/repo-audit/SKILL.md'), 'utf8')
  const blocks = marked.lexer(prompt).filter(token => token.type !== 'space')
  for (const [label, expected] of [
    ['New idea:', ['/vision', '/glossary', '/architecture', '/foundation', '/verification create', '/formal-verification create', '/maintenance', '/agents-md', '/plan']],
    ['Existing repo:', ['/repo-audit', '/vision', '/glossary', '/architecture', '/verification create', '/formal-verification create', '/maintenance', '/agents-md', '/plan']]
  ]) {
    const index = blocks.findIndex(token => token.type === 'paragraph' && token.text === label)
    assert.ok(index >= 0, label)
    const checklist = blocks[index + 1]
    assert.equal(checklist.type, 'list', label)
    assert.ok(checklist.items.every(item => item.task), label)
    assert.deepEqual(checklist.items.map(item => item.tokens.flatMap(block => block.tokens ?? []).find(token => token.type === 'codespan')?.text), expected, label)
  }
})

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

