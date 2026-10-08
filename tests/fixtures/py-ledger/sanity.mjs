import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
const [path, name = 'py-ledger'] = process.argv.slice(2)
function run(executable, args, expected = 0) {
  const result = spawnSync(executable, args, { cwd: path, encoding: 'utf8', env: { ...process.env, UV_PYTHON_DOWNLOADS: 'never' } })
  if (result.error?.code === 'ENOENT') { console.error(`Blocked: install ${executable}`); process.exit(2) }
  if (executable === 'uv' && result.status !== expected && /No interpreter found|No Python installation found/.test(result.stderr)) {
    console.error('Blocked: install Python 3.12'); process.exit(2)
  }
  assert.equal(result.status, expected, result.stdout + result.stderr)
  console.error(`${name}: ${executable} ${args.join(' ')} exited ${result.status}`)
  return result.stdout
}
run('uv', ['sync', '--locked', '--python', '3.12'])
run('uv', ['run', '--no-sync', 'ruff', 'check', '.'])
run('uv', ['run', '--no-sync', 'python', '-m', 'unittest'])
run('uv', ['run', '--no-sync', 'python', '-c', 'from app import opening_balance; assert opening_balance() == 10'])
const expected = name === 'py-ledger' || name.endsWith('-private') ? ['private'] : name.endsWith('-alias') ? ['alias'] : name.endsWith('-cycle') ? ['cycle'] : []
assert.deepEqual(JSON.parse(run('uv', ['run', '--no-sync', 'python', 'boundaries.py'], expected.length ? 1 : 0)), expected)
if (name === 'py-ledger') {
  assert.match(await readFile(join(path, 'CONTRIBUTING.md'), 'utf8'), /External modules use the public ledger package/)
  run('uv', ['run', '--no-sync', 'python', 'startup.py', 'startup-output.json'])
  assert.deepEqual(JSON.parse(await readFile(join(path, 'startup-output.json'), 'utf8')), [['cash', '10.00', '0', ''], ['equity', '0', '10.00', '']])
  await rm(join(path, 'startup-output.json'))
}
