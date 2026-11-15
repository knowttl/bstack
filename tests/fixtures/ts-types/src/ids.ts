export type OrderId = string & { readonly brand: 'OrderId' }
export type CustomerId = string & { readonly brand: 'CustomerId' }

export function parseOrderId(value: string): OrderId {
  return value as OrderId
}

export function parseCustomerId(value: string): CustomerId {
  return value as CustomerId
}
