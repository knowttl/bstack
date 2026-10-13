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

## TypeScript

Use the applicable rules of [anti-slop](https://github.com/dmmulroy/anti-slop/tree/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b) as pinned here; its documentation says the rules are meant to be copied in and edited.
Not generalised: `no-conditional-empty-object-spread` is TypeScript-specific, and the Effect group is library-specific, so enable it only when that library is a direct dependency.
Dropped: `require-safety-comment-for-type-assertion`, which conflicts with the comment ban; SL-1 instead bans assertions outside the parse boundary.

## What is proven and what is not

- Python SL-1, SL-2, SL-4, SL-5, SL-6 and SL-8 were proven on this skill's disposable fixture with ruff 0.15.20, through one maintained command that rejected a seeded violation of each with its diagnostic. In the bstack source checkout, the configuration lives in `tests/fixtures/py-greeter/pyproject.toml`. Prove it again on every project, since versions, rule sets and existing code differ.
- Python SL-3 and SL-7, and Go SL-2, SL-6 and SL-7, have no native rule in this mapping and need a custom check if enabled.
- Go SL-1, SL-3, SL-4 and SL-5 are verified by rule name in the golangci-lint reference only; golangci-lint itself was not run, so each Go mapping needs a project-specific configuration and proof. `gofmt` for SL-8 ships with the Go toolchain.
- No Go or TypeScript slop rule was proven by this skill's tests. The comment-ban checkers were tested for Python, Go and TypeScript.

## The comment ban

Ban all prose comments.
Exempt only machine-read directives that name a specific rule or code, and legally required license headers.
No mainstream linter bans every comment: the Python rules `ERA001` and `FIX002` and the Go linter `godox` cover parts only, so they do not establish the ban.

| Exempt | Examples |
|---|---|
| Shebang on line 1 | `#!/usr/bin/env python3` |
| Build and generate directives | `//go:build linux`, `//go:generate`, `/// <reference types="node" />` |
| Suppressions that name a rule or code | `# type: ignore[assignment]`, `# noqa: E501`, `# pylint: disable=E1101`, `# pylint: disable-next=no-member`, `# pylint: enable=no-member`, `//nolint:unused`, `// eslint-disable-next-line no-var` |
| License header | A comment group at the top of a file carrying `SPDX-License-Identifier`, `Copyright`, `Licensed under` or `All rights reserved` |

A bare `# type: ignore`, `# noqa` or a suppression without a rule name is a prose comment; SL-6 requires suppressions to be narrow.
Blanket selectors such as `all` and Pylint group or category selectors such as `typecheck` or `C` are not exemptions.
An explanation after `--` does not replace the required rule name.

Generate the checker with `comment-check generate --repo <target> --language python|go|typescript --json`.
It uses the language's own tokenizer, so comment-like text inside strings, regular expressions and templates is never flagged.
It is self-contained, contains no comments itself, runs without bstack and exits 1 with `path:line:column: no-prose-comments: prose comment: <text>` for each violation.
Propose it as a selected `create` edit at the returned suggested path and wire it into the maintained check command.
The TypeScript checker imports the project's `typescript` package; add that development dependency as a selected edit when the project lacks it.
For another language, write the same check with that language's tokenizer and prove it the same way.

Existing prose comments go into the shrinking baseline and are removed only through selected fixes:

- `--list` prints the current violations as rule, path and key objects. Keys hash the comment text and include a per-file occurrence number, so they survive moved lines but not a move to another file.
- List output contains identities only; add the reason and removal condition required by `schemas/baseline.schema.json` before adopting entries as a baseline.
- `--baseline <file>` accepts entries following `schemas/baseline.schema.json`, fails on any violation not listed, and fails on any listed entry that no longer matches a comment so the baseline shrinks.

Before removing a warning comment such as "do not remove", encode the requirement it protects as a type, test or lint constraint, then delete the comment.
If the user declines an encoding, delete the comment and report the constraint as unenforced.
The user's own global agent rules may allow rationale comments; inside a repo that adopts this ban, the repo's lint wins.
