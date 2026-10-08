import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const [path, name] = process.argv.slice(2)
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: path, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout.trim()
}
run(process.execPath, ['--test', 'price.test.mjs'])
if (name === 'dirty-work') {
  assert.equal(run('git', ['status', '--porcelain']), ' M notes.md\nM  price.mjs\n D remove.md\n D rename.md\n?? new.md\n?? renamed.md'.trim())
  assert.equal(await readFile(join(path, 'notes.md'), 'utf8'), 'User edits must survive.\n')
} else if (name === 'refactor') {
  assert.equal(run('git', ['log', '--format=%s', '-1']), 'refactor: preserve public pricing')
  assert.match(run('git', ['diff', 'HEAD~1', 'HEAD', '--', 'price.mjs']), /unitPrice/)
} else if (name === 'contract-removal') {
  assert.equal(run('git', ['show', 'HEAD~1:project.json']), '{"schemaVersion":1,"documents":["DESIGN.md"],"rules":["public-price"]}')
  assert.equal(run('git', ['diff', '--name-status', 'HEAD~1', 'HEAD']), 'D\tDESIGN.md\nD\tproject.json')
} else if (name === 'shallow-history') {
  assert.equal(run('git', ['rev-parse', '--is-shallow-repository']), 'true')
  const missing = spawnSync('git', ['rev-parse', '--verify', 'HEAD~1'], { cwd: path, encoding: 'utf8' })
  assert.notEqual(missing.status, 0)
}
