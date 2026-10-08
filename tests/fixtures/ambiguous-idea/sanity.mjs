import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

assert.deepEqual(await readdir(process.argv[2]), ['brief.md'])
// The copied brief must retain the unresolved choice and both stack alternatives.
const brief = await readFile(join(process.argv[2], 'brief.md'), 'utf8')
assert.match(brief, /One decision remains unresolved: must inspectors work without network access\?/)
assert.match(brief, /If yes, use an offline mobile app/)
assert.match(brief, /If no, use a browser app backed by a server database/)
