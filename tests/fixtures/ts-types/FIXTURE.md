# TypeScript type rungs

Requires Node 24 or later, npm and Git.
TypeScript 7.0.2 is pinned in the fixture-local lockfile.
Run `node tests/fixtures/ts-types/sanity.ts <built-folder>`.

`npm run check` is the maintained check command: `tsc --noEmit` with `strict` enabled in tsconfig.json.
It is the only tool; there is no linter.
The sources are the clean control for the slop baseline's SL-10, SL-11 and SL-12 in TypeScript:
`src/shape.ts` handles every variant of a closed union and ends its switch in a `never`-typed call,
`src/ids.ts` and `src/order.ts` give two identifiers that share `string` distinct branded types,
and `src/order.ts` also holds strict-only code, a `string | null` parameter that is narrowed before use.
`tests/scripts/verification-constraints.test.ts` seeds one violation per invocation into disposable copies: an added variant, a swapped or unbranded identifier, an implicit `any` and an unchecked `null`.

Serves the verification skill's TypeScript type-rung proof as fixture inputs.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
