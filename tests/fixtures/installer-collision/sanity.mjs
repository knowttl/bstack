import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const [path] = process.argv.slice(2)
const read = file => readFile(join(path, 'home', ...file.split('/')), 'utf8')
assert.equal(await read('.agents/skills/repo-audit/SKILL.md'), '# User-owned repo audit\n\nKeep my local customisation.\n')
assert.equal(await read('.agents/skills/unrelated/SKILL.md'), '# Unrelated skill\n\nKeep this too.\n')
const installed = await read('.claude/skills/repo-audit/SKILL.md')
const manifest = JSON.parse(await read('.claude/skills/repo-audit/install-manifest.json'))
assert.notEqual(createHash('sha256').update(installed).digest('hex'), manifest.files['SKILL.md'])
