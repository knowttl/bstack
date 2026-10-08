import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// The delta must be grounded in a later approved decision, with its baseline intact.
const repo = process.argv[2]
const vision = await readFile(join(repo, 'VISION.md'), 'utf8')
assert.match(vision, /Status: approved by the owner/)
assert.doesNotMatch(vision, /backup/)
assert.match(await readFile(join(repo, 'DESIGN.md'), 'utf8'), /owner approved local export/)
assert.equal(execFileSync('git', ['log', '-1', '--format=%s'], { cwd: repo, encoding: 'utf8' }).trim(), 'docs: approve personal backup boundary')
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }), '')
