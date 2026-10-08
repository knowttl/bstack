import { servicePrice } from '../core/internal/database.ts'
import { postOrder } from './routes.ts'
export async function checkout(url: string, quantity = 1) {
  return postOrder(quantity, await servicePrice(url))
}
