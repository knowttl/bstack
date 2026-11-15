export type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`)
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.side ** 2
    default:
      return assertNever(shape)
  }
}
