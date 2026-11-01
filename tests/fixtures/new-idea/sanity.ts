import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

assert.deepEqual(await readdir(process.argv[2]), ['brief.md'])
// The copied brief is the fixture's complete input contract.
const brief = await readFile(join(process.argv[2], 'brief.md'), 'utf8')
assert.match(brief, /TypeScript and local storage/)
assert.match(brief, /no open decisions/)
assert.match(brief, /An item is one named pantry supply/)
