import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { total } from '../src/orders.js'
import { seedDatabase } from '../support/database.js'

let orders
before(async () => { orders = await seedDatabase() })

test('total sums price times quantity', () => {
  assert.equal(total(orders[0].lines), 10)
})
