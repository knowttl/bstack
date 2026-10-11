import test from 'node:test'
import assert from 'node:assert/strict'
import { quote } from './packages/web/public.ts'
import { checkout } from './packages/web/ui.ts'
test('public price', () => assert.equal(quote(), 12))
test('checkout HTTP mock', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ price: 10 })))
  assert.deepEqual(await checkout('https://price.example.invalid/price'), { status: 201, total: 10 })
})

import { price, postOrder } from '@shop/core'
import { a } from './packages/core/a.ts'
import { b } from './packages/core/b.ts'
test('public core order interface preserves totals', () => {
  assert.equal(price(), 12)
  assert.deepEqual(postOrder(1, 10), { status: 201, total: 10 })
  assert.deepEqual(postOrder(2), { status: 201, total: 24 })
  assert.deepEqual(postOrder(6, 10), { status: 201, total: 54 })
})
test('core helpers terminate with current quote price', () => {
  assert.equal(a(), 12)
  assert.equal(b(), 12)
})
