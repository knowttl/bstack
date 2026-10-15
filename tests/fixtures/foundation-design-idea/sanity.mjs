import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

assert.deepEqual(await readdir(process.argv[2]), ['VISION.md', 'design.md'])
assert.match(await readFile(join(process.argv[2], 'VISION.md'), 'utf8'), /Status: approved by the owner\./)
assert.match(await readFile(join(process.argv[2], 'design.md'), 'utf8'), /TypeScript and local storage/)
