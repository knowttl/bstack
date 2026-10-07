import test from 'node:test'
import assert from 'node:assert/strict'

test('planted fixture failure must never be discovered', () => {
  assert.fail('Fixture sources are not bstack test suites')
})
