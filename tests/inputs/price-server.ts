import { createServer } from 'node:http'

const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ price: 12 }))
})
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/price`))
