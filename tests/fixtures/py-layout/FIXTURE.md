# Python layout convention

Requires Node 24 or later for the builder, Git and Python 3 on PATH.
Run `node tests/fixtures/py-layout/sanity.ts <built-folder>`.

Each feature is one folder under `app/features`, and `app/registry.py` is generated from those folders.
layout.py is the maintained check command, using the standard library only.
It prints `layout-convention` for a Python file outside the feature folders, naming the folder path it belongs under, and `registry-stale` when `app/registry.py` differs from the folders, naming `python3 layout.py --write`.
The fixture is the clean control; `tests/scripts/architecture.test.ts` seeds a misplaced file and an unregistered feature folder into disposable copies.
Sanity runs the check and the journey in `app/main.py`.

Serves the architecture and foundation skills' layout-convention proof as fixture inputs.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
