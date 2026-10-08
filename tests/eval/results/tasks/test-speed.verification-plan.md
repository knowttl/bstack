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
Document attaches it with `node scripts/task-evidence.mjs .cache/full-suite.json test-speed` before publication.
If input binding rejects attachment, rerun the configured full-suite command inside this pipeline and attach its fresh result.
Record actual final test counts and suite times in the PR body, along with install and check results and timing.
Review every functional, correctness, coverage, style, simplification and design finding and repair its invariant and sibling cases within the two automatic rounds.
Verify the PR targets knowttl/bstack main, is ready and mergeable; the supervising firstmate merges it.
