import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Read the installed-folder contract independently of the caller's directory.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit')

test('skill metadata permits only user invocation in the documented hosts', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  const frontmatter = document.split('---\n')[1]
  const metadata = Object.fromEntries(frontmatter.trim().split('\n').map(line => {
    const colon = line.indexOf(':')
    return [line.slice(0, colon), line.slice(colon + 1).trim()]
  }))
  assert.equal(metadata.name, 'repo-audit')
  assert.ok(metadata.description.length > 0)
  assert.equal(metadata['disable-model-invocation'], 'true')
  const policy = await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8')
  const [section, setting] = policy.trim().split('\n').map(line => line.trim())
  assert.equal(section, 'policy:')
  const [key, value] = setting.split(':').map(part => part.trim())
  assert.equal(key, 'allow_implicit_invocation')
  assert.equal(value, 'false')
})

test('load when table resolves all eight bundled reference placeholders', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  const paths = [...document.matchAll(/\| `references\/([^`]+)` \|/g)].map(match => match[1])
  assert.deepEqual(paths, [
    'intent-interview.md', 'grilling.md', 'domain-language.md', 'vision.md',
    'enforcement.md', 'architecture.md', 'research-briefs.md', 'maintenance-contract.md'
  ])
  for (const path of paths) {
    const reference = await readFile(join(skill, 'references', path), 'utf8')
    assert.match(reference, /^# [^\n]+\n\n[^\n]+\n$/)
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
