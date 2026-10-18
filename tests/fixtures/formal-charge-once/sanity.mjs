import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const [path] = process.argv.slice(2)
const violation = basename(dirname(process.argv[1])).endsWith('-violation')
const read = file => readFile(join(path, file), 'utf8')
const code = await read('src/charge.mjs')
const model = await read('formal/ChargeOnce.tla')

assert.equal(code.includes('compareAndSet'), !violation)
assert.equal(model.includes('Claim(w) =='), true)
assert.equal(model.includes('Read(w) =='), violation)
assert.match(model, /^NoDoubleCharge == charges <= 1$/m)
assert.match(await read('formal/ChargeOnce.cfg'), /^INVARIANT NoDoubleCharge$/m)

// The plan binds its acceptance source by hash, so a changed property file fails here before any proof runs.
const plan = JSON.parse(await read('check-plan.json'))
const [source] = plan.acceptanceSources
assert.equal(createHash('sha256').update(await readFile(join(path, source.path))).digest('hex'), source.contentHash)
assert.deepEqual(plan.checks.map(check => [check.id, check.role, check.command.cwd, check.command.timeoutMs]),
  [['tlc-charge-once', 'protection', 'formal', 120000]])
