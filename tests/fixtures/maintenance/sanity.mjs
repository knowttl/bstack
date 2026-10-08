import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
const [path] = process.argv.slice(2)
const name = basename(dirname(process.argv[1]))
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: path, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout.trim()
}
run(process.execPath, ['--test', 'price.test.mjs'])
if (name === 'dirty-work') {
  assert.equal(run('git', ['status', '--porcelain', '--renames']), ' M notes.md\nM  price.mjs\n D remove.md\nR  rename.md -> renamed.md\n?? new.md'.trim())
  assert.equal(await readFile(join(path, 'notes.md'), 'utf8'), 'User edits must survive.\n')
} else if (name === 'refactor') {
  assert.equal(run('git', ['log', '--format=%s', '-1']), 'refactor: preserve public pricing')
  assert.equal(run('git', ['diff', '--name-status', 'HEAD~1', 'HEAD']), 'M\tprice.mjs')
  for (const revision of ['HEAD~1', 'HEAD']) {
    const source = run('git', ['show', `${revision}:price.mjs`])
    run(process.execPath, ['--input-type=module', '-e', "import assert from 'node:assert/strict'; const { quote } = await import(process.argv[1]); assert.deepEqual([quote(0), quote(1), quote(3)], [0, 12, 36])", `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`])
  }
} else if (name === 'contract-removal') {
  assert.deepEqual(JSON.parse(run('git', ['show', 'HEAD~1:project.json'])), { schemaVersion: 1, documents: ['DESIGN.md'], rules: ['public-price'] })
  assert.equal(run('git', ['diff', '--name-status', 'HEAD~1', 'HEAD']), 'D\tDESIGN.md\nD\tproject.json')
} else if (name === 'shallow-history') {
  assert.equal(run('git', ['rev-parse', '--is-shallow-repository']), 'true')
  const missing = spawnSync('git', ['rev-parse', '--verify', 'HEAD~1'], { cwd: path, encoding: 'utf8' })
  assert.notEqual(missing.status, 0)
}
