# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: be5906f640a5f7fc7f2fcd1939dd8785bbb45cde
Stated next change: Recommendations only for balanced postings through the public ledger package; preserve current native Python journey and standards.
Reviewed scope: CONTRIBUTING.md, pyproject.toml, uv.lock, app.py, startup.py, boundaries.py, test_ledger.py, ledger/__init__.py, ledger/book.py, ledger/_internal.py, check.py
Current fingerprint: a3076254d11110cc5c31805d366e5884116aa7deafc918875dd8c3fdc5f317f0

## Readiness evidence

- Missing required outcome: starting-checks.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.

## Documented intent

- standards: External modules use public ledger; ledger owns entries and balances; preserve native Python checks and balanced postings. (CONTRIBUTING.md:3)
- toolchain: Python 3.12 and Ruff 0.14.0 are declared; lint E4/E7/E9/F selected. (pyproject.toml:4)

## Observed behaviour

- public: Public package exports Ledger; post normalizes amounts internally and records paired entries. (ledger/__init__.py:1)
- caller: app imports and calls private amount although public post already performs conversion. (app.py:2)
- checker: Checker scans app and top-level ledger files only; exact names app/private and app/bridge are special-cased. (boundaries.py:8)
- tests: Two public interface tests cover a positive posting and negative rejection, without startup or balanced import rejection protection. (test_ledger.py:8)
- startup: Native startup posts through Ledger, prints CSV, and writes JSON. Manual current journey passed; no persistent journey check exists. (startup.py:15)

## Inferred intent

- cohesion: Entries, postings, balances and import/export serve one cohesive ledger responsibility; current evidence does not warrant splitting this owner. (ledger/book.py:15)

## Observed debt

### F-001: External app depends on private normalization; existing boundary check exits 1 with ["private"].

Status: proposed. Resolved: false. Blocks next change: true.
Files: app.py, app.py, ledger/book.py. Command: python -B boundaries.py.
Principle: Enforce the existing public-package standard. No private-helper exception is needed for this caller.
Consequence: Private normalization changes require caller coordination and violate the documented boundary.
Fix: Remove the private import and pass "10" directly to Ledger.post, keeping conversion inside ledger. Preserve opening_balance return value.
Scope: app.py
Verification: Boundary check exits 0; opening_balance remains Decimal("10"); same public posting and startup round-trip pass on final inputs.
Sources: standards, public, caller


## Missing protections

### F-002: Boundary enforcement omits startup, tests and nested modules; recognizes literal private and bridge names rather than resolved public-contract access.

Status: proposed. Resolved: false. Blocks next change: true.
Files: boundaries.py, boundaries.py, boundaries.py. Command: none.
Principle: External modules use the public ledger package; automate this existing rule with scoped native AST analysis. Cycle prohibition is a proposed additional principle, pending selection.
Consequence: New callers or equivalent import forms can bypass the intended package boundary. Current literal alias rejection does not prove general re-export resolution.
Fix: Extend the existing checker to repo-owned Python callers and package nesting, normalize import/from/alias forms, resolve approved public exports and relative package edges, and retain clear diagnostics. Keep dynamic imports explicitly outside proven coverage.
Scope: boundaries.py, CONTRIBUTING.md
Verification: Disposable valid public Ledger and unrelated permitted imports pass; separate private import, from-ledger submodule import, intermediary private-helper re-export, and any selected forbidden cycle fail with specific diagnostics. Prove nested resolution without executing imported application code.
Sources: standards, checker, public

### F-003: Balanced postings have only two small public tests; the real CSV/JSON journey and rejected import atomicity have no maintained executable protection.

Status: proposed. Resolved: false. Blocks next change: true.
Files: test_ledger.py, startup.py, ledger/book.py. Command: none.
Principle: Protect the documented balance invariant at the public Ledger boundary and preserve the observed native Python journey.
Consequence: Unit checks can stay green while startup output diverges or a failed import damages existing balances.
Fix: Retain unittest and add the fewest public acceptance checks: valid post checks both account balances and equal totals; subtests reject zero, negative and same-account posting without state change; import rejects unequal debit/credit totals without altering an existing ledger; one subprocess startup test parses CSV/JSON, compares rows, then imports via Ledger and checks balances. Use temporary output files.
Scope: test_ledger.py
Verification: Expected equal debit/credit outcomes come from CONTRIBUTING.md:5. Run native unittest with actual startup subprocess; assert public entries/balances before and after rejection, never _entries. The current manual startup run is observed compatibility evidence, not a maintained test.
Sources: standards, tests, startup, public

### F-004: Standards do not identify a maintained aggregate command or what evidence completes a change.

Status: proposed. Resolved: false. Blocks next change: false.
Files: CONTRIBUTING.md, pyproject.toml. Command: none.
Principle (proposed new principle): Proposed completion principle: affected public journeys and native checks pass on final inputs. Keep one standards authority and one repo-owned verification entry point.
Consequence: A contributor may run only lint or the two tests and miss the known boundary failure or an output regression.
Fix: Add a short verification section to CONTRIBUTING.md and a small repo-owned native Python check entry point that propagates failures from existing Ruff, boundaries and unittest, including the journey check. Document locked uv setup using the declared Python range. Retain current lint selection. Formatting remains a separate selection; no type checker or hosted CI is justified by this audit.
Scope: CONTRIBUTING.md, check.py
Verification: Prepared Python 3.12 and pinned Ruff run all checks; a seeded boundary violation and journey failure cause a nonzero aggregate exit. Capture baseline failure rather than suppressing it. Hosted CI remains unverified unless separately selected and observed.
Sources: standards, toolchain, checker, tests, startup


## Design decisions


## Proposed new principles

- F-004: Proposed completion principle: affected public journeys and native checks pass on final inputs. Keep one standards authority and one repo-owned verification entry point. (proposed)

## Selected findings


## Limitations

- Recommendations only; no project edits selected or applied. Existing-repo checklist: Step 7 audited, Step 8 no material policy conflicts, Step 9 proposals recorded; Steps 10 and 11 apply verification outside requested scope.
- Read-heavy briefs ran in main thread because the repository contains only a few small files. File citations passed cite-check. Official Python AST and Ruff sources opened 2026-10-12. No external service requires a live probe.
- Only one root commit exists. measure ran HEAD..HEAD with lockfile exclusion: endpoint sizes only; no change-frequency/co-change evidence. No two actual plans were supplied, so overlap is not applicable.
- run-checks captured Python 3.12.15: unittest passes (2 tests), Ruff 0.14.0 passes, boundaries fails exit 1 with private diagnostic. Startup CSV/JSON and public import round-trip independently captured in scratch journey.json; this manual artifact is not validated by findings.
- Execution is intentionally not attached as findings-bound readiness evidence: check-plan fingerprints cannot substitute for the findings fingerprint. No passing readiness claim is made.
- Formatting requirement and type-checking policy are absent; do not silently introduce either. Decimal edge policies beyond existing balanced-positive posting behavior are outside these recommendations.
- Optional visual helper executable was unavailable at the attempted in-scope path; visual rendering work stopped. The required repo-audit renderer remains available.
