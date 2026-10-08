# Local verification

Run on the final source commit with Node 24 or later:

- `npm ci --ignore-scripts`
- `npm ci --omit=dev --prefix skills/repo-audit`
- `npm run check`
- `npm test -- --capture .cache/full-suite.json`

The last command is the full npm test suite, with retained output and identities; no suites are omitted.
Run `node --test tests/scripts/bootstrap.test.mjs` for the executable evidence interface regression cases.
Verify successful attachment without another test execution, evidence-only descendants, stale source/new/deleted inputs, changed base/environment, corrupt output/identity artifacts, failed suite rejection and preservation of blocked acceptance.
The baseline profile retained 834 passing tests in 58.89 seconds across 24 files.
File concurrency remains unchanged because the longest file already spans almost the entire suite wall time.

The gate must retain its own final full-suite capture after all review and documentation fixes.
Ordinary `npm test` now retains this capture too, because this PR's new gate-control YAML is trusted only after it lands on main.
For this PR the Test agent must attach its own final run using the command below, and Document must refresh it if any authored inputs change.
Document attaches it with `node scripts/task-evidence.mjs .cache/full-suite.json test-speed` before publication.
If input binding rejects attachment, rerun the configured full-suite command inside this pipeline and attach its fresh result.
Record actual final test counts and suite times in the PR body, along with install and check results and timing.
Review every functional, correctness, coverage, style, simplification and design finding and repair its invariant and sibling cases within the two automatic rounds.
Verify the PR targets knowttl/bstack main, is ready and mergeable; the supervising firstmate merges it.

Local final-source validation at `202e1247910d678c2c3c58f1b3957ed83a1c2a72`:

- `npm ci --ignore-scripts`: exit 0, npm reported 434ms, wall 0.51s.
- `npm ci --omit=dev --prefix skills/repo-audit`: exit 0, npm reported 915ms, wall 0.98s.
- `npm run check`: exit 0, `check-package: passed`, wall 0.29s.
- `npm test`: exit 0, 850 passed, zero failures/skips/cancellations/todos, suite 63.81s, command wall 64.55s.
- `node --test tests/scripts/bootstrap.test.mjs`: 20 passed, zero failures, 9.02s.

The before/after counts are 834/850 across the same 24 files; the added tests cover evidence behavior.
The before/after local suite times are 58.89s/63.81s; no per-suite speedup is claimed.
The optimization removes separate evidence-bookkeeping pipelines; concurrency and all original tests remain unchanged.
The attached local capture proves the interface works; replace it with the gate's own final capture before publishing this PR.
