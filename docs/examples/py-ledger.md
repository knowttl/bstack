# Existing repo: Python ledger

Prepare with `node tests/fixtures/build.mjs py-ledger`, then follow the [install and invocation steps](README.md).

Request: Audit the ledger and recommend project-specific principles and checks while preserving balanced postings, the public package and native CSV/JSON journey.

Findings: `app.py` imports private normalization; the existing boundary checker misses alternative private imports and some external callers.
Disabling a caller's Decimal trap permits NaN to corrupt balance, while ambient rounding changes the same monetary input's result.
Two happy-path tests leave public mutation, import atomicity and native startup compatibility underprotected.
The cohesive ledger implementation was retained; size alone did not justify splitting it.

Selection: No recommendations were selected or applied.
Public access, boundary enforcement, finite-value protection and meaningful native tests were proposed; rounding, precision and float compatibility remained an explicit policy decision.
The existing `CONTRIBUTING.md`, pinned Ruff and unittest conventions remained the sources to extend.

Result: The native two-test suite, Ruff lint and opening-balance CSV/JSON journey passed, while the private-import boundary failed.
The optional formatter diagnostic also failed and was not silently adopted as a new project requirement.
Disposable probes exposed missed imports, NaN acceptance and rounding differences.
The target remained unchanged; these observations support recommendations, not post-change readiness.

Evidence: The [conversation](../../tests/eval/results/foundation-C17/python/conversation.txt), [findings](../../tests/eval/results/foundation-C17/python/findings.json), [command captures](../../tests/eval/results/foundation-C17/python/checks.json) and [scored summary](../../tests/eval/results/foundation-C17/python/summary.json) record package revision `7c5e754b948b7ab80a21bfe05de6940d26871fd3`, Linux 6.8.0-142-generic, Node v24.17.0, codex-cli 0.160.1 and gpt-6.1-sol with low reasoning.
The run used Python 3.12 and native Python checks, rather than a TypeScript preset.
This earlier foundation checkpoint has no selected protected writes, maintained enforcement or final clean-checkout proof; C27's completed shop path cannot supply those missing Python results.
