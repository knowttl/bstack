# Ledger audit: final recommendation checkpoint

Assessed clean revision `be5906f640a5f7fc7f2fcd1939dd8785bbb45cde`. Recommendations only; repository files unchanged.

- [x] Step 7: Audit starting state (unavailable supported-runtime checks explicitly recorded).
- [x] Step 8: Resolve material gaps (existing standards answer the scoped intent; no interview needed).
- [x] Step 9: Present evidenced findings (citations checked; findings validated and rendered).
- [ ] Step 10: Apply selected findings — outside this recommendations-only request.
- [ ] Step 11: Verify after apply — no changes applied; readiness remains unverified.

Retain `Ledger` as the owner of entries, monetary normalization and all balance calculations. Callers use `from ledger import Ledger`; startup retains CLI/file/stdout responsibilities. The native Python 3.12, unittest, pinned Ruff and uv lock remain the foundation. No new service, forwarding API, module split or type framework is justified by this audit.

## Actual execution evidence

| Captured command | Outcome |
| --- | --- |
| `python3 -B -m unittest discover -v` | Pass: 2 tests, Python 3.11.2 only. |
| `python3 -B boundaries.py` | Fail, exit 1: `["private"]`. |
| `python3 -B [isolated-home][scratch-path] | Pass: opening balance, balanced posting/transfer/reverse, rejection without mutation, semantic round trip, startup CSV/JSON. Supplemental scratch evidence only. |
| Python 3.12 lookup | Unavailable; supported-runtime checks stopped. |
| Ruff executable lookup | Unavailable; pinned lint/format checks unrun. |
| Skill inspect/inventory/cite-check/measure/overlap/findings validate/render | Executed; final proposal validation/render pass. Readiness remains verification blocked. |

[Captured native check results](ledger-check-results-final.json), [public probe](ledger-public-probe.py), [research report](ledger-research.json), [citation check](ledger-citations.json), [measurement](ledger-measure.json), [illustrative overlap](ledger-overlap.json), [findings JSON](ledger-findings.json), [artifact hashes](ledger-artifact-hashes.json).

Official [Python AST](https://docs.python.org/3.12/library/ast.html), [unittest](https://docs.python.org/3.12/library/unittest.html) and [Decimal](https://docs.python.org/3.12/library/decimal.html) documentation was opened on 2026-10-11. It supports using native parsing, public interface tests and semantic Decimal comparisons; documentation does not prove proposed rule coverage.

The initial scratch probe's exact text round-trip assertion was unsupported by the standards. It was corrected to compare public entries and balances. Decimal zero string scale changes on import are not reported as a product defect. Both captured runs are retained. No supported-runtime or full-readiness claim follows from these supplemental successes.

# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: be5906f640a5f7fc7f2fcd1939dd8785bbb45cde
Stated next change: Foundation recommendations for balanced postings through the public ledger package; preserve native Python journey and standards; recommendations only.
Reviewed scope: CONTRIBUTING.md, pyproject.toml, uv.lock, app.py, startup.py, boundaries.py, test_ledger.py, ledger/__init__.py, ledger/_internal.py, ledger/book.py
Current fingerprint: d2d7a252d224d97d3baf436b85e3f1e0301202c49ef6e657b5ad41e6197b59b9

## Readiness evidence

- Missing required outcome: starting-checks.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.

## Documented intent

- S-standards: External modules use public ledger; ledger owns entries and balance calculations; native Python checks preserve balanced postings. (CONTRIBUTING.md:3-5)
- S-toolchain: Python 3.12 range, Ruff 0.14.0 pin and E4/E7/E9/F rules are the native baseline. (pyproject.toml:4-13; uv.lock:1-20)

## Observed behaviour

- S-api: Ledger is the public export and cohesive owner of posting, transfer, reversal, reporting and atomic balanced row import. (ledger/__init__.py:1-3; ledger/book.py:15-90)
- S-app: Opening balance posts 10 through Ledger but imports private amount. (app.py:1-8)
- S-boundary: AST check scans only app and ledger, with exact app-only private/bridge predicates. (boundaries.py:8-30)
- S-tests: Two public tests protect posting/negative rejection. Startup exports CSV/JSON with no committed journey test. (test_ledger.py:8-16; startup.py:15-18)
- S-checks: Captured Python 3.11.2: two unit tests pass, boundary exits 1 with private, supplemental public and startup checks pass. Supported interpreter and Ruff unavailable. ([isolated-home][scratch-path]

## Inferred intent

- S-foundation: Keep the existing cohesive ledger owner and Python journey; no evidence supports splitting balance calculations or exposing a forwarding bridge. (ledger/book.py:15-16; CONTRIBUTING.md:4)

## Observed debt

### F-001: app.py imports ledger._internal.amount in violation of the existing public-package standard.

Status: proposed. Resolved: false. Blocks next change: true.
Files: app.py, ledger/__init__.py, ledger/book.py. Command: python3 -B boundaries.py.
Principle: Existing CONTRIBUTING.md:3-4: callers use public Ledger; ledger owns amount normalization and entries. No exception is needed for this caller.
Consequence: A caller depends on private normalization despite Ledger.post already owning it. The native boundary check currently fails.
Fix: Remove the private import and pass the existing string value "10" directly to Ledger.post. Preserve opening_balance result; keep amount private, and retain Ledger as the cohesive owner.
Scope: app.py
Verification: Capture opening_balance()==Decimal("10") before and after; run public posting tests and the existing boundaries.py check, expecting private violation removed and no cycle. No bridge or additional public amount export.
Sources: S-standards, S-app, S-api, S-checks


## Missing protections

### F-002: Boundary enforcement omits startup.py and tests and checks only two exact imports for app, leaving equivalent private-module imports unchecked.

Status: proposed. Resolved: false. Blocks next change: true.
Files: boundaries.py, boundaries.py, boundaries.py, startup.py. Command: none.
Principle: Existing public-package rule applies to external modules. Use the existing Python AST checker, resolving repo import paths and symbol origins where needed. Exceptions must be narrowly reviewed with reason and removal condition; dynamic imports are an explicit coverage limit.
Consequence: A startup/private import or a public-looking re-export can bypass the rule while the checker reports success.
Fix: Extend boundaries.py over the actual external Python callers, including startup and tests; reject access to ledger implementation modules through direct imports, from-package imports, aliases and an intermediate re-export; keep permitted ledger-internal imports and cycle detection. Resolve origins rather than adding only a bridge-name blacklist.
Scope: boundaries.py
Verification: Before adopting the extended rule, disposable public-import controls must pass; separate private, from-ledger-import, alias, intermediate bridge and cycle violations must fail with specific diagnostics. A clean public startup must pass. Document unresolved/dynamic syntax coverage instead of claiming completeness.
Sources: S-standards, S-boundary, S-tests

### F-003: Committed public tests cover only a happy posting and a negative amount, leaving startup/export and other balanced-entry mutation paths without durable acceptance protection.

Status: proposed. Resolved: false. Blocks next change: true.
Files: test_ledger.py, startup.py, ledger/book.py. Command: none.
Principle: Existing balanced-posting and ledger-ownership standards (CONTRIBUTING.md:4-5) supply acceptance. Public journeys and observable outcomes, not private storage, supply checks. No exception may silently waive balance invariants.
Consequence: The two tests can pass while startup output diverges or import/transfer/reverse changes break balance preservation. The scratch probe is evidence, not maintained coverage.
Fix: Extend existing unittest coverage with a small public posting/transfer/reverse scenario, rejection-without-state-change cases (zero, negative, same account and unbalanced import), semantic row round trip, and a subprocess startup test comparing CSV/JSON accounts and amounts. Preserve the existing positive and negative tests.
Scope: test_ledger.py
Verification: Use from ledger import Ledger and public entries/balances/export_rows; require equal debit/credit totals and unchanged state on rejection. Run startup with a temporary output file, assert CSV/JSON agree and cash/equity balances are +10/-10. Do not require Decimal textual scale equality or prescribe a new rounding policy. Run on Python 3.12.
Sources: S-standards, S-api, S-tests, S-checks

### F-004: CONTRIBUTING.md names native checks but documents neither setup nor one maintained check command nor what evidence completes a change.

Status: proposed. Resolved: false. Blocks next change: false.
Files: CONTRIBUTING.md, pyproject.toml. Command: none.
Principle (proposed new principle): Proposed completion principle: affected public acceptance journeys pass on final inputs; unit-only success does not establish the startup journey. Keep CONTRIBUTING.md as the authority and existing native configs as mechanical truth. Any temporary exception records scope, reason and removal condition.
Consequence: Contributors cannot reproduce the supported-runtime baseline or consistently retain boundary and public-journey failures. Python 3.12 and Ruff were unavailable in this audit.
Fix: Add a short setup/check/evidence section to CONTRIBUTING.md. Use uv sync --frozen and a fail-fast native sequence: uv run --frozen ruff check . && uv run --frozen python -m unittest discover -v && uv run --frozen python boundaries.py. Keep Python 3.12, locked Ruff rules and current package layout. No new type framework or hosted CI is necessary for this scope.
Scope: CONTRIBUTING.md
Verification: On an environment with Python 3.12 and locked Ruff installed, capture tool versions and all command exits. Extend this same command with selected journey checks through unittest. Seed a boundary violation to prove the maintained sequence fails. Formatter adoption is optional and unverified; no type checker is configured. Hosted CI remains outside scope.
Sources: S-standards, S-toolchain, S-tests


## Design decisions


## Proposed new principles

- F-004: Proposed completion principle: affected public acceptance journeys pass on final inputs; unit-only success does not establish the startup journey. Keep CONTRIBUTING.md as the authority and existing native configs as mechanical truth. Any temporary exception records scope, reason and removal condition. (proposed)

## Selected findings


## Limitations

- Recommendations only: no edits selected or applied; no post-change readiness claimed.
- Python 3.12 and Ruff unavailable: supported native lint/runtime checks are blocked; Python 3.11 checks are supplemental.
- Captured check evidence is retained in ledger-check-results-final.json and its returned checks.json; it is not represented as findings-validated execution or a findings fingerprint.
- Initial scratch probe required identical decimal text on round trip, an unsupported expectation. Final probe compares public Entry decimal values and balances; initial failed evidence is retained, not treated as a product defect.
- Only one Git commit exists. Measurement range HEAD..HEAD has no change/co-change history; sizes are advisory.
- Overlap compares two illustrative unselected plans, not real approved parallel work or predicted conflicts.
- No README, vision, design, glossary, instructions, CI, audit or third-party service is present. Existing standards suffice for this bounded audit; no new vision interview is warranted.
- AST rule extensions and seeded rule/integration proof are recommendations, not executed adopted rules.
- Scratch journey script is outside repo input scopes of run-checks; preserve its exact bytes/hash alongside the result for review.
