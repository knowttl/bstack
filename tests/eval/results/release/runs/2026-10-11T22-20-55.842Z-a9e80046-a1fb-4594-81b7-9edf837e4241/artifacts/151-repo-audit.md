# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Finish the existing-repo final checkpoint, then support a user edit/re-audit and representative extension from maintained guidance.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, .bstack/schemas/check-plan.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/project.schema.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: 41e3eec33392ecae6306e2814233ea938dca966bff3e6347b7d95641a48c48fc

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: native-boundary-proof.
- Missing required outcome: maintained-enforcement-proof.
- Missing required outcome: maintenance-contract.
- Missing required outcome: standalone-clean-clone.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-005.
- Unresolved finding: F-006.

## Documented intent

- design: UI never touches storage; checkout total10 at line4. (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order defined twice: purchase and UI panel sequence. (glossary.md:3)
- selection: User note is preserved exactly; supervisor selected endpoint10/quote12, Panel order, public core, cycle enforcement, maintained foundation, historical snapshot semantics. Approval retained in scratch shop-selection.txt. (DESIGN.md:6)

## Observed behaviour

- checks: Aggregate check currently runs types only; separate journey and boundaries exist. (package.json:12)
- journey: HTTP service gives12, checkout must return201,total10; actual native run fails with12. (journey.mjs:6)
- graph: Native graph run exits1 with alias,cycle,private. (boundaries.mjs:19)
- public: Existing public core index import example; current quote12 is observed unit expectation, not approved checkout acceptance. (packages/web/public.ts:1)

## Inferred intent

- proposal: Keeping pricing and order storage behind core is a proposed responsibility allocation derived from no-UI-storage constraint. (DESIGN.md:3)

## Observed debt

### F-001: Real HTTP checkout returns12, violating agreed total10.

Status: selected. Resolved: false. Blocks next change: true.
Files: journey.mjs. Command: npm run journey.
Principle: Honor the approved checkout total10.
Consequence: Unit mock success conceals the failing actual fetch journey.
Fix: Correct the controlled journey endpoint fixture to supply10, keep expected10 and public quote12, and invent no business discount.
Scope: journey.mjs
Verification: Original failing reproduction, unchanged real HTTP journey passes with total10; surrounding public quote remains covered.
Sources: design, journey, selection

### F-002: UI imports storage directly and through alias; routes owns mutable order storage.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md. Command: npm run boundaries.
Principle: UI never touches storage; consumers use public core interface.
Consequence: Storage details leak into UI and obstruct a representative extension through public guidance.
Fix: Route UI and alias consumers through core index; place order persistence behind core. Add a representative approved public-interface example in DESIGN.md, preserving current exported web functions.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Capture original-state public compatibility; clean public imports pass, separate private and alias seeds fail native rule-proof; sibling core internal use remains permitted.
Sources: design, instructions, public, proposal

### F-003: Core a and b form a recursive cycle flagged by the native checker.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed adoption of the existing checker's acyclic graph rule.
Consequence: Calling either function recurses without terminating; aggregate check currently misses it.
Fix: Select acyclic enforcement and remove this unused cycle while preserving exported function names, with reviewed terminating behavior.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Native clean boundary check and independent cycle violation proof; owner review of new terminating behavior.
Sources: graph


## Missing protections

### F-005: Maintained check currently runs types only and omits the failing native boundary and HTTP journey checks.

Status: selected. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): Proposed final-input journey evidence and maintained authoritative-source impact review.
Consequence: Green types/unit checks do not prevent agreed journey failures or guide later maintenance.
Fix: Extend the existing check command with fail-fast types, tests, boundaries and real HTTP journey; prove native boundary rules independently and through that aggregate.
Scope: package.json, boundaries.mjs
Verification: Native valid/private/alias/cycle controls and maintained aggregate controls; final native capture on applied inputs.
Sources: design, checks, instructions

### F-006: No maintained source-impact contract, complete standalone assessment checker or portable review record exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, .bstack/schemas/check-plan.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/project.schema.json. Command: npm run check.
Principle (proposed new principle): Proposed final-input journey evidence and maintained authoritative-source impact review.
Consequence: Green types/unit checks do not prevent agreed journey failures or guide later maintenance.
Fix: Create selected first-contract foundation, install the complete dependency-free checker unchanged with maintenance schemas, add public-interface and maintenance guidance; retain a historical versioned audit snapshot and current-head readiness in scratch. Collect and review final portable assessment after implementation, then prove the unchanged record in an isolated different-root clone.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, .bstack/schemas/check-plan.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/project.schema.json
Verification: Contract/docs validation, complete assessed final change coverage, first-foundation protected record, fresh standalone checker locally and in a different-root clean clone with isolated home/cache and explicit base.
Sources: design, checks, instructions, selection


## Design decisions

### F-004: Order has incompatible definitions.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One resolved meaning per canonical domain term.
Consequence: Future extension cannot rely unambiguously on repo language.
Fix: Retain Order for purchases; rename the presentation concept to Panel order in existing glossary.md.
Scope: glossary.md
Verification: Owner chooses terms, then reviewed exact glossary diff and contract coverage.
Sources: terms, selection


## Proposed new principles

- F-003: Proposed adoption of the existing checker's acyclic graph rule. (selected)
- F-004: One resolved meaning per canonical domain term. (selected)
- F-005: Proposed final-input journey evidence and maintained authoritative-source impact review. (selected)
- F-006: Proposed final-input journey evidence and maintained authoritative-source impact review. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Selected scope approved by supervisor2026-10-11; exact proposed bytes are not yet approved or applied.
- DESIGN.md has an uncommitted user note preserved exactly; original captures refreshed against its bytes.
- Only one Git commit; no history/co-change trend established.
- Boundary analysis covers top-level static imports/exports; dynamic imports and arbitrary transitive facade leaks remain review limits.
- Final portable assessment and historical audit snapshot require their own concrete exact-byte protected review after implementation; current-head readiness stays in scratch.
- No hosted CI, delivery service or external deployed service evidence is claimed.
