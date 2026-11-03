import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { largest } from '../src/orders.js'
import { seedDatabase } from '../support/database.js'

let orders
before(async () => { orders = await seedDatabase() })

test('largest picks the order with the highest total', () => {
  assert.equal(largest(orders).id, 2)
})
