// Node 24 provides RegExp.escape; this declaration predates its inclusion in TypeScript's libraries.
interface RegExpConstructor {
  escape(value: string): string
}
