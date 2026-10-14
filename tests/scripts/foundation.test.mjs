import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Each skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function commands(skill) {
  const result = spawnSync(process.execPath, [join(root, 'skills', skill, 'scripts', `${skill}.mjs`), '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim())
}

test('the foundation skill ships only the commands its procedure runs', () => {
  assert.deepEqual(commands('foundation').sort(), ['apply', 'project create', 'rule-proof', 'run-checks'])
})

test('repo-audit no longer creates projects', () => {
  assert.ok(!commands('repo-audit').includes('project create'))
})
