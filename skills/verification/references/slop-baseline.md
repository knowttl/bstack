# Slop baseline and comment ban

Use this reference to select the default constraints for a project's language and to ban prose comments.
The baseline is a set of language-agnostic principles; each language implements them with its own native tools.
Research the project's language and tools first, because a rule name alone never proves equivalent enforcement.

## Contents

- [The baseline](#the-baseline)
- [Per-language mapping](#per-language-mapping)
- [TypeScript](#typescript)
- [What is proven and what is not](#what-is-proven-and-what-is-not)
- [The comment ban](#the-comment-ban)

## The baseline

Default on, adopted with each rule proven by `rule-proof` and existing violations placed in the shrinking baseline so new code complies from day one.

| ID | Principle |
|---|---|
| SL-1 | No fabricated type evidence: parse instead of cast; assertions are banned outside the parse boundary |
| SL-2 | No escape-hatch types in contracts |
| SL-3 | Parse at the boundary, do not probe |
| SL-4 | Real seams, not module patching |
| SL-5 | No accidental extra passes or copies |
| SL-6 | Suppressions are narrow |
| SL-7 | Names describe the domain |
| SL-8 | Layout belongs to the formatter |
| SL-9 | Tests wait on a condition, not on the clock: no sleep-based waits, polling loops or unreasoned skips |
| SL-10 | Closed variants are handled exhaustively: adding a variant fails the check until every branch handles it |
| SL-11 | Identifiers that share a primitive have distinct types, so one cannot be passed where another is expected |
| SL-12 | The compiler's or type checker's strict mode is enabled and runs inside the maintained command |

SL-9 is unproven in every language, and SL-10 to SL-12 are unproven outside the TypeScript proofs recorded below: each ships as a default candidate that stays off until a project proves it with `rule-proof`.
SL-10 to SL-12 are the top-rung type candidates: each makes a mistake unrepresentable, so its proof seeds the mistake, such as an unhandled variant or a swapped identifier, and expects the type check to fail inside the maintained command.
Treat a reasoned skip as one whose reason is recorded where the checker can read it, such as the skip call's reason argument.

## Per-language mapping

These are research candidates, not proven equivalents.
"Custom check" means no native rule was found when this mapping was written; research the language again for each project, and write a syntax-tree check only for a demonstrated gap.

| ID | anti-slop TypeScript rule | Python | Go |
|---|---|---|---|
| SL-1 | `no-chained-type-assertions`, `no-widen-then-assert` | ruff `TID251` banned-api on `typing.cast` | golangci-lint `forcetypeassert` |
| SL-2 | `no-unknown-parameters`, `no-unknown-returns`, `no-unknown-type-aliases`, `no-object-parameters`, `no-unsafe-dictionary-type`, `no-known-value-widening` | ruff `ANN401` | custom check |
| SL-3 | `no-runtime-typeof`, `no-reflect-get`, `no-reflect-apply` | custom check | `forbidigo` on `reflect.*` |
| SL-4 | `no-module-mocking` | ruff `TID251` on `unittest.mock.patch` | `depguard` |
| SL-5 | `no-array-filter-map`, `no-reduce-accumulator-copy` | ruff `PERF401` | `prealloc` |
| SL-6 | not in anti-slop | ruff `PGH003`, `PGH004` | custom check on bare `//nolint` |
| SL-7 | `no-shape-in-symbol-names` | custom check | custom check |
| SL-8 | `require-readable-spacing` | `ruff format` | `gofmt` |
| SL-9 | not in anti-slop; ESLint `no-restricted-properties` on timer calls and custom checks for polling loops and skips | ruff `TID251` banned-api on `time.sleep`; custom checks for polling loops and skips | `forbidigo` on `time.Sleep`; custom checks for polling loops and skips |
| SL-10 | not in anti-slop; typescript-eslint `switch-exhaustiveness-check`, or a `never`-typed default branch checked by `tsc` | `typing.assert_never` in the final branch, checked by mypy | golangci-lint `exhaustive` |
| SL-11 | not in anti-slop; branded types checked by `tsc`, with a custom check for identifier parameters typed as a bare primitive | `typing.NewType`, checked by mypy | defined types such as `type OrderID string`, checked by the compiler |
| SL-12 | not in anti-slop; `strict` in `tsconfig.json` with `tsc --noEmit` in the maintained command | mypy `--strict` in the maintained command | `go vet ./...` in the maintained command; the compiler has no strict mode to enable |

## TypeScript

Use the applicable rules of [anti-slop](https://github.com/dmmulroy/anti-slop/tree/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b) as pinned here; its documentation says the rules are meant to be copied in and edited.
Not generalised: `no-conditional-empty-object-spread` is TypeScript-specific, and the Effect group is library-specific, so enable it only when that library is a direct dependency.
Dropped: `require-safety-comment-for-type-assertion`, which conflicts with the comment ban; SL-1 instead bans assertions outside the parse boundary.

## What is proven and what is not

- Python SL-1, SL-2, SL-4, SL-5, SL-6 and SL-8 were proven on this skill's disposable fixture with ruff 0.15.20, through one maintained command that rejected a seeded violation of each with its diagnostic. In the bstack source checkout, the configuration lives in `tests/fixtures/py-greeter/pyproject.toml`. Prove it again on every project, since versions, rule sets and existing code differ.
- TypeScript SL-1, SL-2 and SL-3 were proven on a disposable fixture with Oxlint 1.90.0 and the anti-slop rules at the pin above, through one maintained command that rejected a seeded violation of each of the eleven rules in those three rows with its diagnostic. In the bstack source checkout, the configuration lives in `tests/fixtures/ts-slop/lint.json`. The rules read one file's syntax tree and scopes without a type checker, so imported type definitions and cross-file call signatures are a coverage limit. Prove it again on every project.
- Python SL-3 and SL-7, and Go SL-2, SL-6 and SL-7, have no native rule in this mapping and need a custom check if enabled.
- Go SL-1, SL-3, SL-4 and SL-5 are verified by rule name in the golangci-lint reference only; golangci-lint itself was not run, so each Go mapping needs a project-specific configuration and proof. `gofmt` for SL-8 ships with the Go toolchain.
- SL-9 has no proof in any language: every mapping in its row is a candidate by name only, and polling loops and skips need custom checks in each mapping.
The named timer checks do not cover every sleep-based wait, including bare `setTimeout`, `asyncio.sleep` and `time.After`; those paths remain unproven in TypeScript, Python and Go respectively.
Prove coverage of sleep-based waits, polling loops and unreasoned skips before treating SL-9 as proven.
- TypeScript SL-10, SL-11 and SL-12 were proven in part on a disposable fixture with `tsc` 7.0.2 and `strict` enabled in `tsconfig.json`, through one maintained command (`npm run check`) that rejected each seeded mistake. In the bstack source checkout, the configuration lives in `tests/fixtures/ts-types`. `tsc` names no replacement, so the fixture's `check.ts` rewrites each diagnostic to `path:line: TSnnnn: what is wrong.`, appending `Use OrderId.` or `Use CustomerId.` for the identifier mistakes; the SL-10 and SL-12 proofs use `--no-replacement`, since the fix adds a branch, annotation or null check rather than naming something to use. Prove it again on every project.
  - SL-10: adding a variant to a union whose `switch` ends in a call that takes a `never` parameter fails with `not assignable to parameter of type 'never'`. Only a `switch` written that way is covered: a `switch` with no `never` branch is flagged only when its return type forces a value (`TS2366`), so one in a function returning nothing is not seen. The typescript-eslint rule `switch-exhaustiveness-check` was not run and stays unproven.
  - SL-11: passing a `CustomerId` for an `OrderId`, the reverse, or a bare string to a parameter typed with the brand fails with `not assignable to parameter of type`. Unproven: the custom check for identifier parameters typed as a bare `string`. `tsc` accepts two such parameters in either order, so a mistake the types never encode stays invisible. The brands are made by a cast in their parse functions, which SL-1 allows only at the parse boundary.
  - SL-12: an implicit `any` (`TS7006`) and an unchecked `null` (`TS18047`), both errors only under `strict`, fail inside the command. Unproven: that turning `strict` off is detected. With `"strict": false` the command passes the same code, so a check on `tsconfig.json` itself would need a custom check.
- Python and Go SL-10, SL-11 and SL-12, and every other TypeScript mapping in their rows, have no proof: those mappings are candidates by name only.
- No Go slop rule, and no TypeScript slop rule outside SL-1, SL-2, SL-3 and the parts of SL-10, SL-11 and SL-12 above, was proven by this skill's tests. The comment-ban checkers were tested for Python, Go and TypeScript.

## The comment ban

Ban prose comments except the checker-verifiable keep-list below.
The public API documentation-comment and linked-constraint comment exemptions apply only to projects without the no-comments rule.
For projects that adopt that rule, use its policy and proof requirements instead.
No mainstream linter bans every comment: the Python rules `ERA001` and `FIX002` and the Go linter `godox` cover parts only, so they do not establish the ban.

| Exempt | Examples |
|---|---|
| Shebang on line 1 | `#!/usr/bin/env python3` |
| Build and generate directives | `//go:build linux`, `//go:generate`, `/// <reference types="node" />` |
| Suppressions that name a rule or code | `# type: ignore[assignment]`, `# noqa: E501`, `# pylint: disable=E1101`, `# pylint: disable-next=no-member`, `# pylint: enable=no-member`, `//nolint:unused`, `// eslint-disable-next-line no-var` |
| License header | A comment group at the top of a file carrying `SPDX-License-Identifier`, `Copyright`, `Licensed under` or `All rights reserved` |
| Public API doc comments | TypeScript JSDoc attached to exported declarations or their public members; Go doc groups attached to exported declarations or exported members of exported types |
| Linked external constraint | A comment carrying an HTTP(S) link to an issue, RFC or vendor documentation explaining an external constraint |

Public doc exemptions use syntax position, not a declaration name found in comment text.
For TypeScript variable declarations, the exemption extends into the type annotation and initializer only for a simple identifier that is exported directly or separately, including a separate default export.
Visibility is checked per declaration, so exporting one variable does not expose its siblings in the same statement.
For every destructuring declaration, documentation inside its type annotation or initializer is checked as private, without inferring exported binding paths.
This includes object, array, nested, aliased and rest bindings in root and namespace scopes, including separate default exports; declaration-level doc comments can still qualify.
Docs for local declarations, private members and comments inside function bodies remain violations.
Python docstrings are string tokens and already pass.
The checker detects links; review must still establish that the linked source explains an external constraint.

A bare `# type: ignore`, `# noqa` or a suppression without a rule name is a prose comment; SL-6 requires suppressions to be narrow.
Blanket selectors such as `all` and Pylint group or category selectors such as `typecheck` or `C` are not exemptions.
Documentation position or a link cannot exempt an otherwise invalid suppression.
An explanation after `--` does not replace the required rule name.

Generate the checker with `comment-check generate --repo <target> --language python|go|typescript --json`.
This generator retains the public API documentation-comment and linked-constraint comment exemptions, so its output does not establish enforcement of the no-comments rule.
It uses the language's own tokenizer, so comment-like text inside strings, regular expressions and templates is never flagged.
It is self-contained, contains no comments itself, runs without bstack and exits 1 with `path:line: no-prose-comments: prose comment: <text>. Use a name, type or test that expresses it.` for each violation.
Propose it as a selected `create` edit at the returned suggested path and wire it into the maintained check command.
The TypeScript checker uses the project's `typescript` compiler API for versions before 7; add that development dependency as a selected edit when the project lacks it.
For TypeScript 7 and later, which ship no compiler API, the checker resolves the side-by-side TypeScript 6 package `@typescript/typescript6`; add it as a development dependency in the selected edits.
For another language, write the same check with that language's tokenizer and prove it the same way.

Before baselining, inspect `--list` identities alongside the source comments and classify each as a selected finding:

| Class | Action |
|---|---|
| Delete | Propose removing narration or stale text |
| Reshape | Name the symbol to rename, extract or type so the code expresses the knowledge; report the product change without performing it |
| Encode | Identify the type, test or lint constraint preserving the requirement; obtain approval before encoding and removal |
| Keep-exempt | Name the keep-list exemption and verify its syntax position or linked external constraint |

Investigate warning and do-not-remove claims against the code and history before judging them.
Only unresolved violations enter the shrinking baseline; each removal or encoding requires a selected, reviewed fix.
Report constraints left without enforcement as unenforced.

The generated command supports the shrinking baseline:

- `--list` prints the current violations as rule, path and key objects. Keys hash the comment text and include a per-file occurrence number, so they survive moved lines but not a move to another file.
- List output contains identities only; add the reason and removal condition required by `schemas/baseline.schema.json` before adopting entries as a baseline.
- `--baseline <file>` accepts entries following `schemas/baseline.schema.json`, fails on any violation not listed, and fails on any listed entry that no longer matches a comment so the baseline shrinks.

Before removing a warning comment such as "do not remove", encode the requirement it protects as a type, test or lint constraint, then delete the comment.
If the user declines an encoding, report the constraint as unenforced and leave any unselected removal in unresolved debt.
The user's own global agent rules may allow rationale comments; inside a repo that adopts this ban, the repo's lint wins.
