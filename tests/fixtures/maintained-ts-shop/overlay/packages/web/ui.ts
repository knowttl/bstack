import { servicePrice } from '../core/index.ts'
import { postOrder } from './routes.ts'
export async function checkout(url: string, quantity = 1) {
  return postOrder(quantity, await servicePrice(url))
}
