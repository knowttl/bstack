import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
const [path] = process.argv.slice(2)
const name = basename(dirname(process.argv[1]))
const tests = (await readdir(join(path, 'test'))).filter(file => file.endsWith('.test.js'))
assert.ok(tests.length >= 3, 'several test files')
for (const file of tests) assert.match(await readFile(join(path, 'test', file), 'utf8'), /await seedDatabase\(\)/, `${file} repeats the shared setup`)
const manifest = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'))
assert.doesNotMatch(manifest.scripts.test, /timeout/, 'the suite has no per-test timeout')
assert.equal(existsSync(join(path, '.no-mistakes.yaml')), name === 'gated-slow-suite')
const result = spawnSync('npm', ['test', '--silent'], { cwd: path, encoding: 'utf8', shell: process.platform === 'win32' })
assert.equal(result.status, 0, result.stdout + result.stderr)
console.error(`${name}: npm test exited ${result.status}`)
