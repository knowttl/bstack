# TypeScript 7 comments

Declares TypeScript 7 as the project's compiler and holds one prose comment in `src/index.ts`.
It has no lockfile and ships no `node_modules`; a test links a checkout that provides TypeScript 7 and its TypeScript 6 companion package.
The generated comment-ban checker must resolve the TypeScript 6 compiler API and report that comment.
Run `node tests/fixtures/ts7-comments/sanity.ts <built-folder>`.

Serves the TypeScript 7 checker fallback acceptance as fixture inputs.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
