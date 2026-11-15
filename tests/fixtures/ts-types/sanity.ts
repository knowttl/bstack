import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { selectCommand } from '../../../runtime/scripts/lib/run.ts'
const [path] = process.argv.slice(2)
let npm
try {
  npm = await selectCommand('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'])
} catch (error) {
  if ((error as { status?: string }).status !== 'blocked') throw error
  console.error('Blocked: install npm')
  process.exit(2)
}
const installed = spawnSync(npm.executable, npm.args, { cwd: path, encoding: 'utf8' })
assert.equal(installed.status, 0, installed.stdout + installed.stderr)
const checked = spawnSync(npm.executable, ['run', 'check'], { cwd: path, encoding: 'utf8' })
assert.equal(checked.status, 0, checked.stdout + checked.stderr)
const version = spawnSync(npm.executable, ['exec', '--no', '--', 'tsc', '--version'], { cwd: path, encoding: 'utf8' })
assert.match(version.stdout, /7\.0\.2/, version.stdout + version.stderr)
console.error('ts-types: npm ci installed the pinned compiler and the clean control passes')
