// Product JavaScript remains an untyped boundary for the development tooling.
declare module '*.mjs'

// Node 24 implements RegExp.escape; TypeScript 5.9's library declarations predate it.
interface RegExpConstructor {
  escape(value: string): string
}
