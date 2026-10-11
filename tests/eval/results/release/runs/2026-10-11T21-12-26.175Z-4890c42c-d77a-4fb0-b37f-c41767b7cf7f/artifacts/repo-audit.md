# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: be5906f640a5f7fc7f2fcd1939dd8785bbb45cde
Stated next change: Recommendations for balanced postings through the public ledger package while preserving the native Python journey and existing standards.
Reviewed scope: CONTRIBUTING.md, app.py, startup.py, boundaries.py, ledger/__init__.py, ledger/book.py, ledger/_internal.py, test_ledger.py, pyproject.toml, uv.lock, check.py
Current fingerprint: 59e44abbdf59e11c22d116118bf1c8288c7e4a312eee79c682a3b34c146d4a26

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: foundation-review.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.

## Documented intent

- standards: Public ledger boundary, ledger-owned entries and balance calculations, native Python checks preserving balanced postings. (CONTRIBUTING.md:3-5)
- tools: Python 3.12 with Ruff 0.14.0 and existing lint selections. (pyproject.toml:4-13)

## Observed behaviour

- caller: Direct private amount import and redundant caller-side conversion. (app.py:1-8)
- owner: Paired posting, reporting, transfer/reversal and staged balanced import are owned by Ledger. (ledger/book.py:21-90)
- checker: Native AST checker scans app and immediate ledger modules; private/alias checks are literal and app-specific. (boundaries.py:8-30)
- tests: Public package tests cover one successful posting and a negative posting; no persisted startup or round-trip checks. (test_ledger.py:4-16)
- journey: Native CSV/JSON startup calls Ledger; scratch execution succeeds, including public import and both balances. (startup.py:8-18)
- checks: Captured native checks: tests/lint pass; boundary fails private; optional formatting reports two files. ([isolated-home][scratch-path]

## Inferred intent

- cohesion: One cohesive ledger owner is proportionate; no evidence supports splitting calculations into callers or a forwarding layer. (ledger/book.py:15-90)

## Observed debt

### F-001: app.py imports ledger._internal.amount; the native boundary check fails with [private].

Status: proposed. Resolved: false. Blocks next change: true.
Files: app.py, app.py, ledger/book.py. Command: python3 -B boundaries.py.
Principle: Existing standard: external callers use ledger and ledger owns calculations; scope is external callers; no permanent private-import exception.
Consequence: The application depends on a private conversion policy and violates its current standard.
Fix: Remove caller-side amount import/conversion; pass the existing string value to Ledger.post. Keep Ledger, Decimal conversion, CLI and output responsibilities in their current owners.
Scope: app.py
Verification: Native boundary checker passes; opening_balance remains Decimal(10); existing public posting tests and startup output/semantic round-trip remain unchanged.
Sources: standards, caller, owner, checks


## Missing protections

### F-002: The checker ignores startup and future external modules and accepts ledger.book imports because its prohibitions are app-specific literals.

Status: proposed. Resolved: false. Blocks next change: true.
Files: boundaries.py, boundaries.py, startup.py. Command: none.
Principle: Existing public-boundary standard; scope all external repo modules, with ledger-internal imports allowed. Enforcement: native Python AST resolution; unsupported dynamic imports remain a stated limit.
Consequence: A caller can bypass the public facade while a clean boundary check passes.
Fix: Extend the existing checker to relevant external Python callers and reject resolved ledger implementation imports, including public-looking bridges; preserve valid package exports and dependency direction. Avoid another dependency engine.
Scope: boundaries.py, test_ledger.py
Verification: Before adoption, disposable native rule-proof controls must accept public imports and reject direct/aliased private imports, ledger.book access, bridge bypass and cycles with specific diagnostics. Include startup and a future-caller fixture; document dynamic-import limits.
Sources: standards, checker

### F-003: Durable checks do not cover the startup JSON journey, both sides of a posting, or rejected mutations leaving the public ledger unchanged.

Status: proposed. Resolved: false. Blocks next change: true.
Files: test_ledger.py, ledger/book.py, ledger/book.py, startup.py. Command: none.
Principle (proposed new principle): Existing balanced-posting standard; proposed refinement: affected public journeys must pass on final inputs. Enforce via native unittest plus real CLI subprocess checks; no private-state assertions. Any temporary omission needs scope, reason and removal condition.
Consequence: Current two tests may remain green while the CLI, import path or credit-side balance breaks.
Fix: Retain unittest. Add minimal public cases for paired debit/credit balances and zero total, failed posting/import with unchanged entries/balances, and startup CSV/JSON followed by semantic public import/export round-trip. Take balancing outcomes from CONTRIBUTING; confirm exception/serialization details against the intended contract before expanding compatibility promises.
Scope: test_ledger.py, CONTRIBUTING.md
Verification: Run public cases on Python 3.12 and the real startup subprocess using temporary output. Seed representative boundary or balance regressions to ensure checks fail. Assert accounting values, not incidental zero-string normalization.
Sources: standards, tests, journey, owner

### F-004: CONTRIBUTING states native checks but names no setup/check command or completion evidence; no aggregate entry point exists.

Status: proposed. Resolved: false. Blocks next change: false.
Files: CONTRIBUTING.md, pyproject.toml. Command: none.
Principle (proposed new principle): Proposed workflow refinement: one repo-owned fail-fast native verification entry point, linked from the existing standards; no installed audit skill required. Retain current language and lint selections.
Consequence: Contributors can run only the two unit tests and overlook boundary failures or the public journey.
Fix: Document locked Python 3.12 setup (candidate uv sync --locked) and a repo-owned native check entry point combining unittest, existing Ruff lint and the strengthened boundary checker; make CLI journey coverage part of unittest. Add one short completion-evidence section to CONTRIBUTING. Treat formatter adoption as separate selection because two files currently fail; leave type checking unselected without a demonstrated need. No CI selection is implied.
Scope: CONTRIBUTING.md, check.py
Verification: Verify locked setup in scratch, then prove the same fail-fast maintained command on valid and seeded-violation fixtures. Keep existing failures visible; no blanket suppression or baseline refresh. Hosted CI remains unverified unless separately selected and executed.
Sources: standards, tools, checks


## Design decisions


## Proposed new principles

- F-003: Existing balanced-posting standard; proposed refinement: affected public journeys must pass on final inputs. Enforce via native unittest plus real CLI subprocess checks; no private-state assertions. Any temporary omission needs scope, reason and removal condition. (proposed)
- F-004: Proposed workflow refinement: one repo-owned fail-fast native verification entry point, linked from the existing standards; no installed audit skill required. Retain current language and lint selections. (proposed)

## Selected findings


## Limitations

- Recommendations only: no findings selected, no project changes or rule/integration proof applied.
- Native run-checks evidence and manual journey artifacts are linked as sources; they are not findings-fingerprint validated readiness evidence.
- One commit only: frequency/co-change are unsupported; declared-plan overlap is advisory.
- Formatting is not an existing adopted requirement; two files fail its optional check.
- No configured type checker or CI. No new installation or hosted check executed.
- Serial main-thread research: this small repo makes delegation wasteful despite available subagents.
- Public exception and serialization details lack written acceptance cases; confirm only if expanding those contracts.
