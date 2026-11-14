import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
const [path] = process.argv.slice(2)
function run(args: readonly string[]) {
  const result = spawnSync(process.execPath, args, { cwd: path, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  console.error(`ts-layout: node ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
assert.equal(run(['layout.ts']), '')
assert.equal(run(['src/main.ts']).trim(), 'Paid 24')
