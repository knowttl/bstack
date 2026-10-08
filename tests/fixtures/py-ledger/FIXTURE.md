# Python ledger

Requires Node 24 or later for the builder, Git, Python 3.12 and uv.
The fixture-local uv.lock pins Ruff 0.14.0.
Run `node tests/fixtures/py-ledger/sanity.mjs <built-folder> py-ledger`.

ledger/book.py is a large cohesive entry and balance owner.
startup.py is thin wiring with many imports.
app.py imports ledger's private _internal module.
CONTRIBUTING.md supplies standards without a CODING_STANDARDS.md.
Sanity executes native Ruff, unittest and Python's AST and importlib resolution.

Serves AC-11, AC-14, AC-51, AC-52, AC-60, AC-62 and AC-66.
These are inputs for later acceptance procedures, not evidence that those behaviours pass.
