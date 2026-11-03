import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
const [path] = process.argv.slice(2)
const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'))
assert.match(manifest.devDependencies.typescript, /^\^7\./, 'the project pins TypeScript 7')
console.error('ts7-comments: manifest pins TypeScript 7')
