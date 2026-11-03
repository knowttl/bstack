import '../slow-suite/sanity.ts'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const [path] = process.argv.slice(2)
const entry = fileURLToPath(new URL('../../../skills/verification/scripts/verification.mjs', import.meta.url))
const result = spawnSync(process.execPath, [entry, 'kit', 'check', '--repo', path, '--app', 'orders', '--json'], { encoding: 'utf8' })
assert.equal(result.status, 0, result.stdout + result.stderr)
assert.deepEqual(JSON.parse(result.stdout).data.features, ['orders'])
