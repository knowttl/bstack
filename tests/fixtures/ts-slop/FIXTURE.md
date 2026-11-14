# TypeScript slop baseline

Requires Node 24 or later, npm and Git.
Oxlint 1.90.0 and its plugin API package are pinned in the fixture-local lockfile.
Run `node tests/fixtures/ts-slop/sanity.ts <built-folder>`.

lint.json enables the eleven anti-slop rules that the slop baseline maps to SL-1, SL-2 and SL-3 for TypeScript.
It is not named `.oxlintrc.json`, because the bstack checkout's own lint run would load a nested file of that name.
`npm run check` is the maintained check command and passes lint.json explicitly.
The rules are not in the fixture: `tests/scripts/verification-constraints.test.ts` copies the pinned, unchanged `upstream/anti-slop/src` to `tools/oxlint/anti-slop` in the built folder, as a project that vendors them would.
Until then the check command cannot load its plugin, so sanity only installs from the lock and confirms the pinned linter version.
`src/order.ts` is the clean control, and the test seeds one violation per rule into disposable copies.

Serves the verification skill's TypeScript slop-baseline proof as fixture inputs.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
