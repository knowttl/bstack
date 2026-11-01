export function charge<OrderId>(store: { get(id: OrderId): unknown; set(id: OrderId, state: string): void }, orderId: OrderId, gateway: { charge(id: OrderId): void }) {
  if (store.get(orderId) !== 'pending') return false
  store.set(orderId, 'charging')
  gateway.charge(orderId)
  store.set(orderId, 'charged')
  return true
}
