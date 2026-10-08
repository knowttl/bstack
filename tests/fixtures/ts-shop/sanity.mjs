import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { selectCommand } from '../../../skills/repo-audit/scripts/lib/run.mjs'
const [path, name = 'ts-shop'] = process.argv.slice(2)
async function run(executable, args, expected = 0) {
  let command
  try {
    command = await selectCommand(executable, args)
  } catch (error) {
    if (error.status !== 'blocked') throw error
    console.error(`Blocked: install ${executable}`)
    process.exit(2)
  }
  const result = spawnSync(command.executable, command.args, { cwd: path, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  assert.equal(result.status, expected, result.stdout + result.stderr)
  console.error(`${name}: ${executable} ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'])
await run('npm', ['run', 'check'])
await run('npm', ['test'])
const expected = name === 'ts-shop' ? ['alias', 'cycle', 'private'] : name.endsWith('-private') ? ['private'] : name.endsWith('-alias') ? ['alias'] : name.endsWith('-cycle') ? ['cycle'] : []
assert.deepEqual(JSON.parse(await run(process.execPath, ['boundaries.mjs'], expected.length ? 1 : 0)), expected)
if (name === 'ts-shop') {
  assert.equal(await readFile(join(path, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n')
  assert.match(await readFile(join(path, 'DESIGN.md'), 'utf8'), /The UI never touches storage/)
  assert.equal(await readFile(join(path, 'glossary.md'), 'utf8'), '# Glossary\n\nOrder: a customer purchase.\nOrder: the sequence in which UI panels appear.\n')
  await run(process.execPath, ['--input-type=module', '-e', "import { checkout } from './packages/web/ui.ts'; import { postOrder } from './packages/web/routes.ts'; if (checkout() !== 12 || postOrder(6).total !== 64.8) process.exit(1)"])
  const output = await run(process.execPath, ['journey.mjs'], 1)
  assert.deepEqual(JSON.parse(output.trim()), { mockPrice: 10, livePrice: 12 })
}
