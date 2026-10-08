import test from 'node:test'
import assert from 'node:assert/strict'
import { quote } from './packages/web/public.ts'
import { servicePrice } from './service.mjs'
test('public price', () => assert.equal(quote(), 12))
test('checkout HTTP mock', async () => assert.equal(await servicePrice(async () => ({ json: async () => ({ price: 10 }) })), 10))
