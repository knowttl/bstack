import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// Sanity runs against the disposable build, never the source directory.
const path = process.argv[2]
assert.match(await readFile(join(path, 'VISION.md'), 'utf8'), /Status: approved by the owner/)
assert.match(await readFile(join(path, 'DESIGN.md'), 'utf8'), /The queue owns article state/)
const design = await readFile(join(path, 'docs/export-design.md'), 'utf8')
assert.match(design, /Status: approved by the owner/)
assert.equal(design.match(/^### S\d /gm).length, 2)
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: path, encoding: 'utf8' }), '')
assert.equal(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: path, encoding: 'utf8' }).trim(), '3')
