import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { basename, dirname } from 'node:path'
const [path] = process.argv.slice(2)
const name = basename(dirname(process.argv[1]))
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: path, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  assert.equal(result.status, 0, result.stdout + result.stderr)
  console.error(`${name}: ${executable} ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
run('ruff', ['check', '--no-cache', '.'])
run('ruff', ['format', '--check', '--no-cache', '.'])
assert.equal(run('python3', ['-c', 'from greeter.greeting import greeting; print(greeting("Ada"))']).trim(), 'Hello, Ada!')
