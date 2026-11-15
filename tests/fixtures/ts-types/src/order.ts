import { parseCustomerId, parseOrderId } from './ids.ts'
import type { CustomerId, OrderId } from './ids.ts'

export function shipment(order: OrderId, customer: CustomerId): string {
  return `${order} ships to ${customer}`
}

export function initial(name: string | null): string {
  return name === null ? '' : name.charAt(0)
}

export const first = shipment(parseOrderId('order-1'), parseCustomerId('customer-1'))
