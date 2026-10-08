import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// T1.4 owns a literal packaging contract, not evidence of model interpretation.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit')

test('installed skill contains no external skill calls under the T1.4 search contract', async () => {
  const entries = await readdir(skill, { recursive: true, withFileTypes: true })
  for (const entry of entries.filter(entry => entry.isFile())) {
    const path = join(entry.parentPath, entry.name)
    const content = await readFile(path, 'utf8')
    assert.doesNotMatch(content, /Skill tool|invoke the/i, path)
    assert.doesNotMatch(content, /\b(?:call|invoke|run|use|load|dispatch|start)\s+(?:the\s+)?(?:["'`/])?(?:grill-me|grilling|grill-with-docs|domain-modeling|setup-matt-pocock-skills|improve-codebase-architecture)\b/i, path)
  }
})
