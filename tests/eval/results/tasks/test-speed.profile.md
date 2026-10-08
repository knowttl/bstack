# Full-suite file profile

Baseline: Node v24.17.0, Linux x64, 12 available CPUs, native default file concurrency, 24 suite files.
All 834 tests passed with zero failures, skips, cancellations or todos in 58.89 seconds.
Durations below come from Node's per-file `test:summary` events in one full execution, not sums of individual test timings.

| File under tests/scripts | Tests | Seconds |
| --- | ---: | ---: |
| apply.test.mjs | 240 | 58.60 |
| measure.test.mjs | 32 | 56.77 |
| eval.test.mjs | 77 | 49.42 |
| fixtures.test.mjs | 13 | 30.03 |
| run-checks.test.mjs | 82 | 24.84 |
| project.test.mjs | 45 | 17.72 |
| probe.test.mjs | 18 | 13.99 |
| child-contract.test.mjs | 47 | 11.65 |
| findings.test.mjs | 42 | 10.19 |
| package-check.test.mjs | 55 | 9.15 |
| inventory.test.mjs | 10 | 7.03 |
| overlap.test.mjs | 36 | 4.51 |
| vision-runtime.test.mjs | 1 | 4.13 |
| acceptance.test.mjs | 23 | 4.08 |
| vision-review.test.mjs | 15 | 3.48 |
| existing-repo.test.mjs | 1 | 3.21 |
| command-contract.test.mjs | 26 | 2.67 |
| cite-check.test.mjs | 22 | 2.62 |
| inspect.test.mjs | 6 | 1.86 |
| vision-board.test.mjs | 12 | 1.46 |
| schema-contract.test.mjs | 16 | 1.37 |
| upstream.test.mjs | 6 | 1.02 |
| bootstrap.test.mjs | 4 | 0.74 |
| skill-skeleton.test.mjs | 5 | 0.27 |

The longest file occupies 58.60 of the 58.89 seconds of wall time.
The two longest files already execute concurrently and dominate the critical path.
This profile provides no clear scheduling win from raising file concurrency; more simultaneous child processes could instead increase CPU contention.
Concurrency therefore remains at Node's native default, with all suite discovery and isolation unchanged.
This is a single-run profile, not a claimed speedup or a flakiness study.
Final gate counts and timing are recorded in the adjacent generated test-speed evidence.
