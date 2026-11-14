import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
const [path] = process.argv.slice(2)
function run(args: readonly string[]) {
  const result = spawnSync('python3', ['-B', ...args], { cwd: path, encoding: 'utf8' })
  if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') { console.error('Blocked: install python3'); process.exit(2) }
  assert.equal(result.status, 0, result.stdout + result.stderr)
  console.error(`py-layout: python3 ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
assert.equal(run(['layout.py']), '')
assert.equal(run(['-m', 'app.main']).trim(), 'Paid 24')
