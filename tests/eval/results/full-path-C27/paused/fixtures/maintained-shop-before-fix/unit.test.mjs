import test from 'node:test'
import assert from 'node:assert/strict'
import { quote } from './packages/web/public.ts'
import { checkout } from './packages/web/ui.ts'
test('public price', () => assert.equal(quote(), 12))
test('checkout HTTP mock', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ price: 10 })))
  assert.deepEqual(await checkout('https://price.example.invalid/price'), { status: 201, total: 10 })
})

// The cycle correction preserves both helper exports and the public quote.
import { a } from './packages/core/a.ts'
import { b } from './packages/core/b.ts'
test('core helpers terminate with the public price', () => {
  assert.equal(a(), quote())
  assert.equal(b(), quote())
})
