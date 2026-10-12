import { price } from '../core/index.ts'
export function quote(quantity = 1) { return price() * quantity }
