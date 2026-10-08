import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { checkout } from './packages/web/ui.ts'
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ price: 12 }))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
try {
  const order = await checkout(`http://127.0.0.1:${server.address().port}/price`)
  console.log(JSON.stringify({ expectedTotal: 10, order }))
  assert.deepEqual(order, { status: 201, total: 10 }, 'agreed checkout total is 10')
} finally {
  await new Promise(resolve => server.close(resolve))
}
