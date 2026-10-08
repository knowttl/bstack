import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
const [path, name = 'ts-shop'] = process.argv.slice(2)
function run(executable, args, expected = 0) {
  const result = spawnSync(executable, args, { cwd: path, encoding: 'utf8', shell: process.platform === 'win32' && executable === 'npm' })
  if (result.error?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  assert.equal(result.status, expected, result.stdout + result.stderr)
  console.error(`${name}: ${executable} ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'])
run('npm', ['run', 'check'])
run('npm', ['test'])
const expected = name === 'ts-shop' ? ['alias', 'cycle', 'private'] : name.endsWith('-private') ? ['private'] : name.endsWith('-alias') ? ['alias'] : name.endsWith('-cycle') ? ['cycle'] : []
assert.deepEqual(JSON.parse(run(process.execPath, ['boundaries.mjs'], expected.length ? 1 : 0)), expected)
if (name === 'ts-shop') {
  assert.equal(await readFile(join(path, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n')
  assert.match(await readFile(join(path, 'DESIGN.md'), 'utf8'), /The UI never touches storage/)
  assert.equal(await readFile(join(path, 'glossary.md'), 'utf8'), '# Glossary\n\nOrder: a customer purchase.\nOrder: the sequence in which UI panels appear.\n')
  run(process.execPath, ['--input-type=module', '-e', "import { checkout } from './packages/web/ui.ts'; import { postOrder } from './packages/web/routes.ts'; if (checkout() !== 12 || postOrder(6).total !== 64.8) process.exit(1)"])
  const output = run(process.execPath, ['journey.mjs'], 1)
  assert.deepEqual(JSON.parse(output.trim()), { mockPrice: 10, livePrice: 12 })
}
