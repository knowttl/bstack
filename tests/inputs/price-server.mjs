import { createServer } from 'node:http'

// A live stand-in disagrees with ts-shop's unit mock for the same price service.
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ price: 12 }))
})
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/price`))
