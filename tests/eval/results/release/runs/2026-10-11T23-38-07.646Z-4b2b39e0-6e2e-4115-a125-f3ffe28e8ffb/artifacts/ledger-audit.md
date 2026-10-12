# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: be5906f640a5f7fc7f2fcd1939dd8785bbb45cde
Stated next change: Foundation recommendations for balanced postings through the public ledger package, preserving the native Python journey and existing standards; recommendations only.
Reviewed scope: CONTRIBUTING.md, pyproject.toml, uv.lock, app.py, startup.py, boundaries.py, test_ledger.py, ledger/__init__.py, ledger/book.py, ledger/_internal.py, check.py
Current fingerprint: db630232bb4423bf13dbc96a843b4a44498dcc7e368c58d0a6591c4b52da4e8f

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: foundation-review.
- Unresolved finding: F-001.
- Unresolved finding: F-004.

## Documented intent

- standards: Public ledger access, ledger-owned entries and calculations, native Python checks, balanced postings. (CONTRIBUTING.md:3-5)

## Observed behaviour

- app: Opening balance imports amount from ledger._internal and returns cash balance. (app.py:1-8)
- owner: One cohesive Ledger domain owner performs posting validation, calculations, transfers, reversals and import/export. (ledger/book.py:15-90)
- boundary: Only app and ledger are scanned; two exact app import names are checked. startup and other external callers are omitted. (boundaries.py:8-30)
- tests: Two public API tests cover basic balance and negative value rejection only. (test_ledger.py:8-16)
- startup: Native startup posts Decimal(10), exports CSV stdout and writes JSON to the requested path. (startup.py:11-18)
- native: Python 3.12 and pinned Ruff 0.14.0 lint rules; no type checker, aggregate check command or CI configuration. (pyproject.toml:4-13)

## Inferred intent

- cohesion: Ledger ownership matches standards; no split, service or public helper wrapper is justified by this scope. (ledger/book.py:16)

## Observed debt

### F-001: app uses a private ledger helper; the native boundary check fails with ["private"].

Status: proposed. Resolved: false. Blocks next change: true.
Files: app.py, CONTRIBUTING.md. Command: python -B boundaries.py.
Principle: Existing rule: external modules use the public ledger package; Ledger owns normalization and calculations. No private-import exception is needed.
Consequence: App is coupled to private amount conversion, so internal changes can break the caller despite a stable public Ledger.
Fix: Pass the existing string input "10" directly to Ledger.post and remove the private helper import; preserve the Decimal result of opening_balance. Keep Ledger as the domain owner; do not introduce a public-looking bridge or duplicate normalization.
Scope: app.py
Verification: Boundary check exits zero; opening_balance remains Decimal(10); existing posting tests and startup CSV/JSON journey still pass. Check values through public methods only.
Sources: standards, app, owner, cohesion


## Missing protections

### F-002: The existing boundary checker covers app and ledger only and recognizes literal private/bridge imports only for app.

Status: proposed. Resolved: false. Blocks next change: false.
Files: boundaries.py, boundaries.py, startup.py. Command: none.
Principle: Existing public-package rule needs enforcement over external production callers, while internal ledger imports remain permitted. Exceptions must name scope, reason and removal condition; no broad exclusion.
Consequence: A new external caller or intermediate private re-export can evade the intended contract while the checker reports success.
Fix: Extend the existing Python AST checker to the actual production callers including startup, resolve project-local aliases/re-exports and dependency direction, and retain cycle detection. Declare dynamic import limits explicitly. Keep a single repo-owned checker.
Scope: boundaries.py
Verification: Disposable public Ledger imports and permitted ledger internal imports pass; direct private imports from app and startup, an aliased private import, an intermediate bridge and a forbidden cycle independently fail with expected diagnostics. An unrelated package remains permitted; unresolved analysis fails explicitly.
Sources: standards, boundary, startup

### F-003: The maintained tests lack the native application/startup journey and rejection-without-mutation protection.

Status: proposed. Resolved: false. Blocks next change: false.
Files: test_ledger.py, startup.py, ledger/book.py, ledger/book.py. Command: none.
Principle: Existing balanced-posting rule supplies the acceptance outcome; tests should protect the public Ledger and native Python user journey. No exemption from balance preservation.
Consequence: Unit tests can pass while native outputs, caller behavior or import/rejection behavior regress. The scratch journey passed now but is not maintained in the repo.
Fix: Extend native unittest coverage with one application/startup journey: opening balance, CSV stdout, JSON output into a temporary directory, public re-import and equal debit/credit totals. Add one table-driven rejection case checking zero/negative values, identical accounts and unbalanced imported rows leave prior public balances/exports unchanged. Derive amounts from the test input and balanced-posting standard; preserve current export bytes as compatibility evidence.
Scope: test_ledger.py
Verification: Run unittest with Python 3.12 against public ledger imports and the real startup subprocess; deliberate output or balance regressions must fail. No _entries inspection and no external service mocks.
Sources: standards, tests, startup, owner

### F-004: CONTRIBUTING states standards but names neither setup/check commands nor the evidence that completes a change.

Status: proposed. Resolved: false. Blocks next change: false.
Files: CONTRIBUTING.md, pyproject.toml. Command: none.
Principle (proposed new principle): Proposed review principle: completion requires affected public journeys on final inputs plus native lint and boundary checks. Automated checks and human acceptance review have distinct roles; this does not impose a universal development sequence. Any temporary exception needs a reason, narrow scope and removal condition.
Consequence: Contributors can treat two green unit tests as sufficient while the existing public-boundary rule fails.
Fix: Add a short section to CONTRIBUTING linking acceptance cases and the maintained native journey. Document uv sync --locked and one repo-owned fail-fast native check entry point combining unittest, Ruff lint and boundaries; preserve known failures. Keep format check diagnostic until formatter adoption is explicitly selected. Keep the current Python range and Ruff rules; no type checker or hosted CI is justified by this scoped audit.
Scope: CONTRIBUTING.md, check.py
Verification: Review against CONTRIBUTING requirements; the selected native entry point must pass a clean disposable control and fail a seeded private import or broken posting journey with a specific diagnostic. Hosted CI remains unverified unless selected and run.
Sources: standards, native, tests, boundary


## Design decisions


## Proposed new principles

- F-004: Proposed review principle: completion requires affected public journeys on final inputs plus native lint and boundary checks. Automated checks and human acceptance review have distinct roles; this does not impose a universal development sequence. Any temporary exception needs a reason, narrow scope and removal condition. (proposed)

## Selected findings


## Limitations

- Recommendations only: no finding selected, no project edit or audit record applied; steps 10 and post-apply 11 are outside requested scope.
- Single initial commit: measure ran over HEAD..HEAD with zero history changes; no co-change or conflict inference is supported. No two declared plans were supplied, so overlap was not run.
- Research ran in the main thread because the few small files made hand-off wasteful. No outside dependency or external-language practice was recommended; outside research and probes were not needed.
- Prepared .venv used: Python 3.12.15, Ruff 0.14.0, uv 0.12.22. Setup was not rerun and no dependency downloads were required.
- Native unittest (2 tests) and Ruff lint passed; boundaries failed ["private"]; Ruff format --check reports boundaries.py and ledger/book.py. Formatter adoption is not stated by the repo, so this is a diagnostic limitation, not an approved formatting violation.
- The recorder succeeded using Python/Ruff commands resolved through prepared .venv PATH, after rejecting direct symlink and inline-code command paths. The native journey was captured separately in scratch; findings has not validated that artifact as readiness evidence.
- No rule-proof or integration proof has run for proposed checker changes. Static source review cannot establish dynamic import coverage.
- No VISION, design, README, glossary, prior audit, CI or repo instruction files were found. CONTRIBUTING plus the requested scoped goal supplies sufficient intent; no product or vision change is proposed.
- Passing current unit tests does not establish readiness: F-001 is current debt; F-002 through F-004 are proposed protections/review standards, with no selected changes.
