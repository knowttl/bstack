import { setTimeout as delay } from 'node:timers/promises'

export async function seedDatabase() {
  await delay(400)
  return [
    { id: 1, lines: [{ price: 5, quantity: 2 }] },
    { id: 2, lines: [{ price: 3, quantity: 7 }, { price: 1, quantity: 1 }] }
  ]
}
