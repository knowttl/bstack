# Slow suite

Requires Node 24 or later, npm and Git.
Run `node tests/fixtures/slow-suite/sanity.ts <built-folder>`.

A small order-total library whose three test files each rebuild the same read-only database in a `before` hook.
The setup is the dominant cost of the suite, and no test mutates what it seeds, so reusing it would be provably safe.
The test script is a bare `node --test` with no per-test timeout and no suite ceiling.
The repo has no no-mistakes gate and no hook, so a create run may offer the optional pre-push hook.
The repo ships no dependencies, so the suite runs offline.

Serves the fast-feedback acceptance for `/verification` create; maintained-slow-suite adds an applied kit for maintain.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
