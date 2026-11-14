export type Order = { id: string; quantity: number }

export function total(order: Order, unitPrice: number): number {
  return order.quantity * unitPrice
}
