import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { selectCommand } from '../../../runtime/scripts/lib/run.mjs'
const [path] = process.argv.slice(2)
const name = basename(dirname(process.argv[1]))
async function run(executable: string, args: readonly string[], expected = 0) {
  let command
  try {
    command = await selectCommand(executable, args)
  } catch (error) {
    if ((error as { status?: string }).status !== 'blocked') throw error
    console.error(`Blocked: install ${executable}`)
    process.exit(2)
  }
  const result = spawnSync(command.executable, command.args, { cwd: path, encoding: 'utf8' })
  if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  assert.equal(result.status, expected, result.stdout + result.stderr)
  console.error(`${name}: ${executable} ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'])
await run('npm', ['run', 'check'])
await run('npm', ['test'])
const expected = ['ts-shop', 'selected-ts-shop'].includes(name) ? ['alias', 'cycle', 'private'] : name.endsWith('-private') ? ['private'] : name.endsWith('-alias') ? ['alias'] : name.endsWith('-cycle') ? ['cycle'] : []
assert.deepEqual(JSON.parse(await run(process.execPath, ['boundaries.ts'], expected.length ? 1 : 0)), expected)
if (['ts-shop', 'selected-ts-shop'].includes(name)) {
  assert.equal(await readFile(join(path, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n')
  assert.match(await readFile(join(path, 'DESIGN.md'), 'utf8'), /The UI never touches storage/)
  assert.equal(await readFile(join(path, 'glossary.md'), 'utf8'), '# Glossary\n\nOrder: a customer purchase.\nOrder: the sequence in which UI panels appear.\n')
  await run(process.execPath, ['--input-type=module', '-e', "import { postOrder } from './packages/web/routes.ts'; if (postOrder(6).total !== 64.8) process.exit(1)"])
  const output = await run(process.execPath, ['journey.ts'], 1)
  assert.deepEqual(JSON.parse(output.trim()), { expectedTotal: 10, order: { status: 201, total: 12 } })
}
