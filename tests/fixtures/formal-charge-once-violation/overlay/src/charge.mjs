export function charge(store, orderId, gateway) {
  if (store.get(orderId) !== 'pending') return false
  store.set(orderId, 'charging')
  gateway.charge(orderId)
  store.set(orderId, 'charged')
  return true
}
