import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { marked } from 'marked'

// Read the installed-folder contract independently of the caller's directory.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit')

test('skill metadata permits only user invocation in the documented hosts', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  assert.ok(frontmatter)
  const metadata = parse(frontmatter[1])
  assert.equal(metadata.name, 'repo-audit')
  assert.equal(typeof metadata.description, 'string')
  assert.ok(metadata.description.trim().length > 0)
  assert.equal(metadata['disable-model-invocation'], true)
  const policy = parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8'))
  assert.equal(policy.policy?.allow_implicit_invocation, false)
})

test('load when table resolves all eight bundled references', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  const tokens = marked.lexer(document)
  const heading = tokens.findIndex(token => token.type === 'heading' && token.text === 'Load when')
  assert.ok(heading >= 0)
  const section = tokens.slice(heading + 1)
  const end = section.findIndex(token => token.type === 'heading')
  const tables = (end < 0 ? section : section.slice(0, end)).filter(token => token.type === 'table')
  const paths = tables.flatMap(table => table.rows.flat().flatMap(cell => cell.tokens
    .filter(token => token.type === 'codespan' || token.type === 'link')
    .map(token => token.type === 'link' ? token.href : token.text)))
    .filter(path => path.startsWith('references/'))
  assert.deepEqual(new Set(paths), new Set([
    'references/intent-interview.md', 'references/grilling.md', 'references/domain-language.md', 'references/vision.md',
    'references/enforcement.md', 'references/architecture.md', 'references/research-briefs.md', 'references/maintenance-contract.md'
  ]))
  for (const path of paths) {
    assert.ok((await stat(join(skill, path))).isFile(), path)
  }
})

test('no arguments prints planned commands and returns usage exit 3', () => {
  const result = spawnSync(process.execPath, [join(skill, 'scripts', 'repo-audit.mjs')], { encoding: 'utf8' })
  assert.equal(result.status, 3, result.stderr)
  assert.match(result.stdout, /Usage:/)
  assert.match(result.stdout, /not implemented yet/)
  for (const command of ['vision-board', 'cite-check', 'inspect', 'inventory', 'measure', 'overlap', 'findings validate', 'findings render', 'apply', 'state show', 'run-checks', 'probe record', 'probe compare', 'rule-proof', 'baseline check', 'contract validate', 'evidence collect', 'evidence validate', 'docs generate', 'docs check']) {
    assert.ok(result.stdout.split('\n').includes(`  ${command}`), command)
  }
  assert.match(result.stdout, /usage error \(exit 3\)/)
})

test('explicit help succeeds', () => {
  const result = spawnSync(process.execPath, [join(skill, 'scripts', 'repo-audit.mjs'), '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Planned commands/)
})

test('an unimplemented command returns usage exit 3', () => {
  const result = spawnSync(process.execPath, [join(skill, 'scripts', 'repo-audit.mjs'), 'inspect'], { encoding: 'utf8' })
  assert.equal(result.status, 3, result.stderr)
  assert.match(result.stdout, /not implemented yet/)
})
