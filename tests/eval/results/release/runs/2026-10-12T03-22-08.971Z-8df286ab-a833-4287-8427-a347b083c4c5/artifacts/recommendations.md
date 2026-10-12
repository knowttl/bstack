# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: be5906f640a5f7fc7f2fcd1939dd8785bbb45cde
Stated next change: Foundation recommendations for balanced postings through public ledger; preserve native Python journey and standards; recommendations only.
Reviewed scope: CONTRIBUTING.md, pyproject.toml, uv.lock, app.py, startup.py, boundaries.py, test_ledger.py, ledger/__init__.py, ledger/book.py, ledger/_internal.py
Current fingerprint: 402db4910fd877ed87730568db9593351bf2f2d0047ff6f15cfc6b2450529011

## Readiness evidence

- Missing required outcome: starting-checks.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-004.

## Documented intent

- standards: Public package use, ledger ownership, native Python checks and balanced postings are existing standards. (CONTRIBUTING.md:3)
- toolchain: Python 3.12 and pinned Ruff lint; no type-checker, CI or maintained aggregate command declared. (pyproject.toml:4)

## Observed behaviour

- app: Private amount import duplicates normalization already performed by Ledger.post. (app.py:2)
- ledger: post validates then appends paired entries; imports validate the batch before extending. (ledger/book.py:21)
- tests: Only basic positive posting and negative rejection are maintained public tests. (test_ledger.py:8)
- boundary: Only app and immediate ledger Python files are scanned; private target checks are hard-coded to app. (boundaries.py:8)
- journey: Public Ledger posting exported as CSV and JSON; captured native journey passes. (startup.py:15)

## Inferred intent

- intent: Keep the existing Ledger responsibility intact; no evidence supports structural splitting. (ledger/book.py:16)

## Observed debt

### F-001: app imports ledger._internal.amount; native boundary check exits 1 with ["private"].

Status: proposed. Resolved: false. Blocks next change: true.
Files: app.py, ledger/book.py. Command: .venv/bin/python -B boundaries.py.
Principle: Existing public-package rule; Ledger owns normalization and balances.
Consequence: External caller couples to a private implementation and current standard is violated.
Fix: Pass "10" directly to Ledger.post and remove the private import. Keep Ledger public export and all balance logic in ledger; no new facade or bridge. No permanent exception recommended.
Scope: app.py
Verification: Native boundary check must pass; opening_balance remains Decimal("10"); startup CSV/JSON balances remain cash +10 and equity -10.
Sources: standards, app, ledger, journey


## Missing protections

### F-002: Maintained tests do not protect startup exports or state preservation on invalid postings/import batches.

Status: proposed. Resolved: false. Blocks next change: true.
Files: test_ledger.py, startup.py, ledger/book.py. Command: none.
Principle: Existing balanced-posting requirement, checked at public Ledger and native CLI.
Consequence: The two tests can pass while startup output or a populated ledger is corrupted.
Fix: Extend unittest with one real startup CSV/JSON journey and table-driven public rejection checks: zero/negative, same account and an unbalanced import batch. Verify unchanged entries and balances after failure; compare exported debit/credit totals and import round-trip balances. Use existing explicit ValueErrors as observed compatibility behavior, not a newly invented input policy. No private Entry/_entries assertions.
Scope: test_ledger.py, startup.py, ledger/book.py
Verification: Acceptance: CONTRIBUTING.md:4-5 for ownership/balance, startup.py:15-18 for observed journey, ledger/book.py:23-26 and 85-89 for observed rejection compatibility. Run unittest under prepared Python 3.12; corrupt output or partial mutation must fail these cases.
Sources: standards, tests, ledger, journey

### F-003: Import checker does not cover every external module or every non-public ledger submodule.

Status: proposed. Resolved: false. Blocks next change: false.
Files: boundaries.py, boundaries.py. Command: none.
Principle: Existing public-package boundary applies to external modules, including startup and future callers.
Consequence: A private import in startup or another external module can escape the current checker.
Fix: Extend existing Python AST checker over project-owned Python sources, excluding environment/generated paths; enforce imports through ledger for external modules and preserve permitted internal relative imports. Resolve import/re-export forms and provide file/target diagnostics; document dynamic import limits.
Scope: boundaries.py
Verification: Disposable controls: public Ledger imports and internal relative imports pass; direct private import and alias/re-export bypass from a second external module fail with specific diagnostics. Retain existing cycle checks and demonstrate a seeded cycle failure before claiming enforcement.
Sources: standards, boundary

### F-004: CONTRIBUTING gives standards but no maintained command or evidence completion criteria.

Status: proposed. Resolved: false. Blocks next change: false.
Files: CONTRIBUTING.md, pyproject.toml. Command: none.
Principle (proposed new principle): Proposed completion rule: affected public journeys pass on final inputs; unit tests alone do not establish completion.
Consequence: Contributors can report green unit/lint checks while omitting the failing boundary or CLI contract.
Fix: Add one short section to CONTRIBUTING naming unittest public acceptance cases, native startup journey and a fail-fast command using the existing prepared Python/Ruff tools and boundaries.py. Keep Python 3.12, uv.lock and Ruff 0.14.0; no new verifier dependency, Node runtime requirement, type-checker mandate or CI integration. Formatting stays an explicit optional choice. Human review keeps entry/balance logic in Ledger. Temporary boundary debt, if accepted, must name app.py and end when F-001 lands; never blanket-disable the rule.
Scope: CONTRIBUTING.md
Verification: The documented native command passes a clean disposable fixture and fails a seeded boundary violation; independent review confirms final-input journey evidence. Any exception names reason, scope and removal condition.
Sources: standards, toolchain, tests, boundary


## Design decisions


## Proposed new principles

- F-004: Proposed completion rule: affected public journeys pass on final inputs; unit tests alone do not establish completion. (proposed)

## Selected findings


## Limitations

- Recommendations only: no selected or applied edits; apply and post-apply readiness steps are not requested.
- Starting evidence: native-checks.json and checks.json in scratch; unittest 2/2 and Ruff lint pass, boundary fails [private], optional Ruff format check fails on boundaries.py and ledger/book.py; real startup/export/import journey passes.
- No formatting mandate is documented; formatting observations are not a blocker or a cosmetic rewrite recommendation.
- Single initial commit: measurements cannot establish meaningful change frequency or semantic coupling. No two declared plans exist, so overlap not run.
- Research ran main-thread because seven short Python files made delegation wasteful. No third-party service, language migration or outside recommendation needs external research.
- No vision document, but CONTRIBUTING and requested scope settle the bounded intent; no material vision gap or board needed.
- Initial inspect ran despite denied preflight in error; all subsequent Node commands freshly gated.
- run-checks fingerprint is not a findings fingerprint; no manually attached evidence is represented as validated readiness.
