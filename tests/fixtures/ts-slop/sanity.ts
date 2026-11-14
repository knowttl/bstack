import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
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
const version = spawnSync(process.execPath, [join('node_modules', 'oxlint', 'bin', 'oxlint'), '--version'], { cwd: path, encoding: 'utf8' })
assert.match(version.stdout, /1\.90\.0/, version.stdout + version.stderr)
console.error('ts-slop: npm ci installed the pinned linter')
