export async function servicePrice(request, url) {
  return (await (await request(url)).json()).price
}
