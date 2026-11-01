// Product JavaScript remains an untyped boundary for the development tooling.
declare module '*.mjs'

// Node 24 provides RegExp.escape; this declaration predates its inclusion in TypeScript's libraries.
interface RegExpConstructor {
  escape(value: string): string
}
