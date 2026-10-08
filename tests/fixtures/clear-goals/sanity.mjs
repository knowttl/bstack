import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// Sanity runs against the disposable build, never the source directory.
const path = process.argv[2]
assert.match(await readFile(join(path, 'VISION.md'), 'utf8'), /Status: approved by the owner/)
assert.match(await readFile(join(path, 'DESIGN.md'), 'utf8'), /no open design decisions/)
assert.match(await readFile(join(path, 'glossary.md'), 'utf8'), /Article: a saved title and address with a read status/)
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: path, encoding: 'utf8' }), '')
assert.equal(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: path, encoding: 'utf8' }).trim(), '2')
