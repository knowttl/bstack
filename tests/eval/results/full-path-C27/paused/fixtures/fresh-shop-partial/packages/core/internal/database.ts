export function price() { return 12 }
export async function servicePrice(url: string) {
  return (await (await fetch(url)).json()).price
}
