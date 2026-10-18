export function charge(store, orderId, gateway) {
  if (!store.compareAndSet(orderId, 'pending', 'charging')) return false
  gateway.charge(orderId)
  store.set(orderId, 'charged')
  return true
}
