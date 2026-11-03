# Gated slow suite

The slow-suite fixture plus a `.no-mistakes.yaml` that already names the lint and test commands, so the repo has a no-mistakes gate.
A create run must wire the affected and full commands into that file without a pre-push hook.
Run `node tests/fixtures/gated-slow-suite/sanity.ts <built-folder>`.

Serves the fast-feedback acceptance for `/verification` create and maintain as fixture inputs.
These are inputs for acceptance procedures, not evidence that those behaviours pass.
