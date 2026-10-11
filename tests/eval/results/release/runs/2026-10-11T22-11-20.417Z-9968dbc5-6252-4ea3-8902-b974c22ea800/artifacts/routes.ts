import { price } from '../core/index.ts'
const orders: number[] = []
export function postOrder(quantity: number, unitPrice = price()) {
  const undiscountedTotal = unitPrice * quantity
  const total = undiscountedTotal * (quantity > 5 ? 0.9 : 1)
  orders.push(total)
  return { status: 201, total }
}
