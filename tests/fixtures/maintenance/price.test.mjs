import test from 'node:test'
import assert from 'node:assert/strict'
import { quote } from './price.mjs'
test('agreed public quote', () => assert.equal(quote(3), 36))
