import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
const [path] = process.argv.slice(2)
const name = basename(dirname(process.argv[1]))
assert.equal(existsSync(join(path, '.no-mistakes.yaml')), name === 'gated-slow-suite')
const result = spawnSync('npm', ['test', '--silent'], { cwd: path, encoding: 'utf8', shell: process.platform === 'win32' })
assert.equal(result.status, 0, result.stdout + result.stderr)
console.error(`${name}: npm test exited ${result.status}`)
