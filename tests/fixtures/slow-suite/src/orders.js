export function total(lines) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}

export function largest(orders) {
  return orders.reduce((best, order) => (total(order.lines) > total(best.lines) ? order : best))
}
