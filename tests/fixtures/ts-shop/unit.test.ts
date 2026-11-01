import test from 'node:test'
import assert from 'node:assert/strict'
import { quote } from './packages/web/public.ts'
import { checkout } from './packages/web/ui.ts'
test('public price', () => assert.equal(quote(), 12))
test('checkout HTTP mock', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ price: 10 })))
  assert.deepEqual(await checkout('https://price.example.invalid/price'), { status: 201, total: 10 })
})
