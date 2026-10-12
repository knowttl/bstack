import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import '../ts-shop/sanity.mjs'

// Selection must not silently repair the original fixture's defects.
const [repo] = process.argv.slice(2)
assert.match(await readFile(join(repo, 'selected-findings.md'), 'utf8'), /F-001/)
assert.match(await readFile(join(repo, 'approved-plan.md'), 'utf8'), /not approval of a generated exact diff/)
assert.match(await readFile(join(repo, 'DESIGN.md'), 'utf8'), /User note: receipt wording remains a future owner decision\./)
assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).stdout, ' M DESIGN.md\n')
