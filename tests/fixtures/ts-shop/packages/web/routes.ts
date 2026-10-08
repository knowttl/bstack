import { price } from '../core/internal/database.ts'
const orders: number[] = []
export function postOrder(quantity: number, unitPrice = price()) {
  const total = unitPrice * quantity * (quantity > 5 ? 0.9 : 1)
  orders.push(total)
  return { status: 201, total }
}
