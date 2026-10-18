import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [path] = process.argv.slice(2)
const read = file => readFile(join(path, file), 'utf8')
const { charge } = await import(pathToFileURL(resolve(path, 'src/charge.mjs')))

for (const status of ['pending', 'charging', 'charged']) {
  const orders = new Map([['order-1', status]])
  const store = {
    get: id => orders.get(id),
    set: (id, value) => orders.set(id, value),
    compareAndSet(id, expected, value) {
      if (orders.get(id) !== expected) return false
      orders.set(id, value)
      return true
    }
  }
  const charges = []
  const gateway = { charge: id => charges.push(id) }

  assert.equal(charge(store, 'order-1', gateway), status === 'pending')
  assert.deepEqual(charges, status === 'pending' ? ['order-1'] : [])
  assert.equal(orders.get('order-1'), status === 'pending' ? 'charged' : status)
  assert.equal(charge(store, 'order-1', gateway), false)
  assert.deepEqual(charges, status === 'pending' ? ['order-1'] : [])
}

// The plan binds its acceptance source by hash, so a changed property file fails here before any proof runs.
const plan = JSON.parse(await read('check-plan.json'))
const [source] = plan.acceptanceSources
assert.equal(createHash('sha256').update(await readFile(join(path, source.path))).digest('hex'), source.contentHash)
assert.deepEqual(plan.checks.map(check => [check.id, check.role, check.command.cwd, check.command.timeoutMs]),
  [['tlc-charge-once', 'protection', 'formal', 120000]])
