import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'

// Read the installed-folder contract independently of the caller's directory.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit')

test('skill metadata declares its name, description and host policy', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  assert.ok(frontmatter)
  const metadata = parse(frontmatter[1])
  assert.equal(metadata.name, 'repo-audit')
  assert.equal(typeof metadata.description, 'string')
  assert.ok(metadata.description.trim().length > 0)
  const policy = parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8'))
  assert.equal(policy.policy?.allow_implicit_invocation, false)
})

test('no arguments prints usage and returns exit 3', () => {
  const result = spawnSync(process.execPath, [join(skill, 'scripts', 'repo-audit.mjs')], { encoding: 'utf8' })
  assert.equal(result.status, 3, result.stderr)
  assert.match(result.stdout, /Usage:/)
})

test('explicit help succeeds', () => {
  const result = spawnSync(process.execPath, [join(skill, 'scripts', 'repo-audit.mjs'), '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Available commands/)
})

test('an unimplemented command returns usage exit 3', () => {
  const result = spawnSync(process.execPath, [join(skill, 'scripts', 'repo-audit.mjs'), 'apply'], { encoding: 'utf8' })
  assert.equal(result.status, 3, result.stderr)
  assert.match(result.stdout, /not implemented yet/)
})
