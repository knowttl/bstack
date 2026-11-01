export function charge<OrderId>(store: { compareAndSet(id: OrderId, from: string, to: string): boolean; set(id: OrderId, state: string): void }, orderId: OrderId, gateway: { charge(id: OrderId): void }) {
  if (!store.compareAndSet(orderId, 'pending', 'charging')) return false
  gateway.charge(orderId)
  store.set(orderId, 'charged')
  return true
}
