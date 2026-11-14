# TypeScript layout convention

Requires Node 24 or later and Git; it has no dependencies to install.
Run `node tests/fixtures/ts-layout/sanity.ts <built-folder>`.

Each feature is one folder under `src/features`, and `src/registry.ts` is generated from those folders.
layout.ts is the maintained check command behind `npm run check`.
It prints `layout-convention` for a file outside the feature folders, naming the folder path it belongs under, and `registry-stale` when `src/registry.ts` differs from the folders, naming `node layout.ts --write`.
The fixture is the clean control; `tests/scripts/architecture.test.ts` seeds a misplaced file and an unregistered feature folder into disposable copies.
Sanity runs the check and the journey in `src/main.ts`.

Serves the architecture and foundation skills' layout-convention proof as fixture inputs.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
