import { price, servicePrice } from '../core/index.ts'
export function quote() { return price() }
export async function serviceQuote(url: string) { return servicePrice(url) }
