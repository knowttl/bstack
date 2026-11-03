import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { total } from '../src/orders.js'
import { seedDatabase } from '../support/database.js'

let orders
before(async () => { orders = await seedDatabase() })

test('total adds every line of a multi-line order', () => {
  assert.equal(total(orders[1].lines), 22)
})
