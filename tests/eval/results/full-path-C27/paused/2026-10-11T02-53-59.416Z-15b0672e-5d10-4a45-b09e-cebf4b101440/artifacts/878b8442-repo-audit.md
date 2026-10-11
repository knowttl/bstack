# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Re-audit after a user edit, then a representative extension through approved public core interface and maintained checks.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/internal/orders.ts, packages/web/alias.ts, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs
Current fingerprint: b4e67d8d627961c51235ad9c60c29062df411111333d147ddb9e941725aaa722

## Readiness evidence

- Missing required outcome: journey.
- Missing required outcome: boundary-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: portable-maintenance.
- Missing required outcome: clean-clone-checker.
- Outcome starting-checks is failed.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- starting-checks: failed. Method: run-checks --phase before; types and units pass, boundaries and real HTTP journey fail. Artifact: ./072aaf20-checks.json. Fingerprint: b4e67d8d627961c51235ad9c60c29062df411111333d147ddb9e941725aaa722.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10 at line 4. (DESIGN.md:3)
- interface: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order has two incompatible definitions. (glossary.md:3)

## Observed behaviour

- implementation: Private/alias storage edges, in-memory order storage in web routes, and core cycle exist. (packages/web/ui.ts:1)
- checks: Types and mocked tests pass; native boundary and live journey captures fail. (package.json:12)

## Inferred intent

- next: A subsequent extension needs portable authoritative guidance and maintained checks. Specific extension is not yet defined. (user request: final checkpoint)

## Observed debt

### F-001: Web directly imports private storage, resolves an alias into it, and stores orders in routes.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI never touches storage; use public core interface.
Consequence: Extensions can bypass the approved boundary.
Fix: Expose servicePrice and order creation via the existing core index; move order storage into core; make web adapters use that interface. Retain public.ts as the representative example and document it in DESIGN.md.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/core/internal/orders.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/web/public.ts, DESIGN.md
Verification: Native boundaries and types pass; valid public/sibling imports pass; deliberate private and alias violations fail; checkout remains 10.
Sources: design, interface, implementation

### F-002: Core a and b call each other recursively.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed: core dependency graph must remain acyclic, enforced by the existing native check.
Consequence: Calling either helper never terminates and boundary checks fail.
Fix: Retain both exports and filenames; make b a terminating leaf (proposed result 12), with a delegating to b. Record this rule and its scope in DESIGN.md.
Scope: packages/core/a.ts, packages/core/b.ts, DESIGN.md, unit.test.mjs
Verification: Native cycle proof fails only on seeded cycle; helper calls terminate with selected result.
Sources: implementation, checks

### F-003: Real journey price server supplies 12, conflicting with checkout acceptance total 10.

Status: proposed. Resolved: false. Blocks next change: true.
Files: journey.mjs, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: The agreed checkout total is 10.
Consequence: Mocked unit success masks the failed user journey.
Fix: Set the journey test server price to 10; preserve its expected total 10 and production quote 12. Add representative public-interface checkout coverage. Do not hardcode a 10 result in production.
Scope: journey.mjs, unit.test.mjs
Verification: Captured failing before reproduction and passing after real local HTTP journey using unchanged expected total.
Sources: design, checks


## Missing protections

### F-005: Maintained check excludes boundaries and journey; no portable maintenance contract/checker or assessed audit record exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, AGENTS.md. Command: none.
Principle (proposed new principle): Maintain the approved interface and journey with repo-owned enforcement and explicit change assessment.
Consequence: Future work can pass check while violating design; clean-clone review cannot reproduce maintenance evidence.
Fix: Extend existing npm run check with fail-fast types, boundaries, units and journey; retain separate scripts. Add selected .bstack contract, installed standalone checker and portable assessment; point AGENTS.md to existing design/glossary/example and commands; create docs/repo-audit.md only after final assessment. Preserve CLAUDE.md import stub.
Scope: package.json, AGENTS.md, DESIGN.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Maintained-command valid/violation proof; native final checks; contract/docs/evidence validation; committed portable assessment; fresh checker in working tree and different-root clean clone with isolated home/cache. Every changed/unmapped path assessed.
Sources: design, interface, checks, next


## Design decisions

### F-004: Order names both a customer purchase and UI panel sequence.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md, glossary.md. Command: none.
Principle (proposed new principle): Use one unambiguous canonical term per concept.
Consequence: Extension authors cannot identify the intended domain meaning.
Fix: Keep Order for customer purchase; rename the UI sequencing concept to Panel order in existing glossary.md.
Scope: glossary.md
Verification: Owner selects the terminology; final docs checker and impact assessment cite unchanged purchase meaning.
Sources: terms


## Proposed new principles

- F-002: Proposed: core dependency graph must remain acyclic, enforced by the existing native check. (proposed)
- F-004: Use one unambiguous canonical term per concept. (proposed)
- F-005: Maintain the approved interface and journey with repo-owned enforcement and explicit change assessment. (proposed)

## Selected findings


## Limitations

- Selection and exact-byte approval are pending; no project writes have occurred.
- Starting boundaries and real journey fail; repo is not ready.
- Only one historical commit exists; co-change signals are not useful architecture evidence.
- No external production dependency is observed; journey uses a real local HTTP server. No deployed service behavior is claimed.
- Native checker currently covers static import/export resolution and cycles; dynamic imports are a stated limit.
- Relevant research briefs ran sequentially in main thread because this fixture is small; no external tooling recommendation or instruction consolidation is proposed.
- Final path proof, portable assessment and clean-clone checker remain pending approved writes.
