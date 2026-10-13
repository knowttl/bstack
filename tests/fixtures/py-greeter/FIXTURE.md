# Python greeter

Requires Node 24 or later for the builder, Git, Python 3 and Ruff on PATH.
Run `node tests/fixtures/py-greeter/sanity.mjs <built-folder>`.

greeter/server.py is a small HTTP service with a health endpoint and a greeting endpoint.
pyproject.toml enables the Python mappings of slop-baseline constraints SL-1, SL-2, SL-4, SL-5 and SL-6.
check.py is the maintained check command: native lint, the formatter check and the generated comment-ban checker at scripts/check-comments.py, which the verification tests add.
Sanity executes Ruff and imports the greeting module; it does not start the service.

Serves the verification skill's fixture acceptance.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
