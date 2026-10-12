import test from 'node:test'
import assert from 'node:assert/strict'
import { quote, serviceQuote } from './packages/web/public.ts'
test('public quote', () => assert.equal(quote(), 12))
test('public service quote uses the supplied service URL', async (t) => {
  const url = 'https://prices.example/quote'
  const fetch = t.mock.method(globalThis, 'fetch', async (requestedUrl) => {
    assert.equal(requestedUrl, url)
    return new Response(JSON.stringify({ price: 27 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })
  assert.equal(await serviceQuote(url), 27)
  assert.equal(fetch.mock.callCount(), 1)
})
