import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

assert.deepEqual(await readdir(process.argv[2]), ['design.md'])
// The copied design is the fixture's complete input contract.
const design = await readFile(join(process.argv[2], 'design.md'), 'utf8')
assert.match(design, /Status: approved by the owner/)
assert.equal(design.match(/^### S\d /gm).length, 3)
assert.equal(design.match(/^- N\d: .*\d+ ms/gm).length, 1)
assert.match(design, /^- N2: After the first load, the app makes no network request\.$/m)
