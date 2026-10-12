# Selected command review

Before every Node suite, run node "$BSTACK_EVAL_PREFLIGHT" and continue only with exit zero, source host and permitted true (at least 8 GB available memory, 20 GB free disk, load below 36, at most two host-wide suites including proposed run). Runs are sequential.

Apply this unchanged implementation plan:
node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs apply --repo [fixture] --plan [isolated-home][scratch-path] --json

Capture final compatibility after the passing expected-failure before capture:
node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs run-checks --repo [fixture] --plan [isolated-home][scratch-path] --prior-run 05e8dc8b-23a6-4801-a546-0e5732e32c88 --json

Capture maintained aggregate on final proposed authoritative bytes:
node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs run-checks --repo [fixture] --plan [isolated-home][scratch-path] --json

Refresh independent rule-proof captures using final-proof-plan.json, check IDs native and aggregate, valid source [isolated-home][scratch-path] and one violation source proof-private, proof-alias, proof-reexport, proof-cycle, proof-nonpublic, proof-import-type, proof-dynamic, proof-unknown-dynamic. Expected diagnostics are respectively private, alias, private, cycle, private, private, private, dynamic. Use the documented rule-proof interface. Each suite has its own preflight and each proof must have valid exit zero and violation exit nonzero with matching diagnostic.

Run contract validate, docs check, docs generate --check through the installed entry point with explicit repo and .bstack/project.json. No generators are configured; no target writes from these commands.

Historical docs/repo-audit.md and .bstack/assessment.json will have separate exact protected-write reviews after actual target results; do not write them under this implementation approval. The historical record is not rewritten after final checker execution.

Portable verification requires committing selected implementation (including the preserved note), then collecting and reviewing the assessment, binding its fingerprint and committing the assessment separately. Use the explicit comparison base b6c59b7810f5155fd514c9db60e98b7dffce0cc0. Only selected files are staged; no global Git configuration changes.

Run the repo-owned standalone gate:
node [fixture]/.bstack/bin/bstack-check.mjs --repo [fixture] --base b6c59b7810f5155fd514c9db60e98b7dffce0cc0 --assessment [fixture]/.bstack/assessment.json --json

Clone selected committed tree with git clone --no-local --no-hardlinks [fixture] [isolated-home][scratch-path] Prepare a separate isolated home/cache/tmp under [isolated-home][scratch-path] Child environment uses this home, npm cache, XDG cache and TMPDIR; no host-home discovery. Install pinned native tools with npm ci --ignore-scripts --cache [isolated-home][scratch-path] inside the clean clone. This may download pinned dependencies and writes only inside the two allowed roots.

Run freshly with the same committed assessment and explicit base:
node [isolated-home][scratch-path] --repo [isolated-home][scratch-path] --base b6c59b7810f5155fd514c9db60e98b7dffce0cc0 --assessment [isolated-home][scratch-path] --json

Refresh current-head findings and actual readiness in scratch, rather than editing the historical audit. No hosted CI, publishing or delivery service.
