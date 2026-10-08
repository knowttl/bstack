# Local verification

Use the [current verification commands](../../../../README.md) with Node 24 or later and the [gate configuration](../../../../.no-mistakes.yaml) for final full-suite capture.
Run `node --test tests/scripts/bootstrap.test.mjs` for the executable evidence interface regression cases.
Verify successful attachment without another test execution, evidence-only descendants, stale source/new/deleted inputs, changed base/environment, corrupt output/identity artifacts, failed suite rejection and preservation of blocked acceptance.
The [baseline profile](test-speed.profile.md) owns the file-concurrency measurements and decision.

Follow the [task evidence contract](../../../../docs/implementation-plan.md#task-evidence-contract) for final capture and attachment, using task ID `test-speed`.
Record actual final test counts and suite times in the PR body, along with install and check results and timing.
The [gate configuration](../../../../.no-mistakes.yaml) owns review focus, repair prerequisites and automatic round budgets.
Verify the PR targets knowttl/bstack main, is ready and mergeable; the supervising firstmate merges it.

Earlier local validation at `202e1247910d678c2c3c58f1b3957ed83a1c2a72`, before subsequent review fixes:

- `npm ci --ignore-scripts`: exit 0, npm reported 434ms, wall 0.51s.
- `npm ci --omit=dev --prefix skills/repo-audit`: exit 0, npm reported 915ms, wall 0.98s.
- `npm run check`: exit 0, `check-package: passed`, wall 0.29s.
- `npm test`: exit 0, 850 passed, zero failures/skips/cancellations/todos, suite 63.81s, command wall 64.55s.
- `node --test tests/scripts/bootstrap.test.mjs`: 20 passed, zero failures, 9.02s.

These earlier local results are historical; the [attached evidence](test-speed.json) owns the selected full-suite counts and timing.
The optimization removes separate evidence-bookkeeping pipelines; concurrency and all original tests remain unchanged.
Publication requires the gate's final capture under the task evidence contract.
