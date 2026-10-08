# TypeScript shop

Requires Node 24 or later, npm and Git.
TypeScript 5.9.3 is pinned in the fixture-local lockfile.
Run `node tests/fixtures/ts-shop/sanity.mjs <built-folder> ts-shop`.

The two workspaces contain direct UI storage access, a route/pricing/persistence module, a cycle, a private import, a public import and a tsconfig storage alias.
AGENTS.md has a CLAUDE.md import stub.
DESIGN.md forbids UI storage access and glossary.md gives Order two meanings.
Unit tests pass, including an HTTP mock returning 10.
The local HTTP service returns 12, so the agreed checkout journey fails.
Sanity compiles with TypeScript, executes units and the live journey, and resolves the import graph using TypeScript's native resolver.

Serves AC-4, AC-5, AC-8, AC-10, AC-12, AC-14, AC-25 through AC-31, AC-49, AC-50, AC-52, AC-61 and AC-63.
These are inputs for later acceptance procedures, not evidence that those behaviours pass.
