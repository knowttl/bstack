# Repo audit record

Result: ready for the stated next change

Stage: audit
Target: [scratch-path]
Revision: c8fec301b238286e5aab96ddbe6fa176e41ca204
Stated next change: Establish maintained foundation, then re-audit a user edit and implement a representative extension using repo guidance and checks.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs, .bstack/approvals.md
Current fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e

## Readiness evidence

- starting-checks: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.
- checkout-total-10: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.
- public-interface-example: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.
- native-boundary-proof: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.
- maintained-enforcement-proof: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.
- maintenance-contract: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.
- standalone-clean-clone: passed. Method: Fresh captured native execution on final inputs. Artifact and linked child outputs reviewed against unchanged total-10 and quote-12 acceptance; findings validates the matching target fingerprint and exact artifact hash, not child-command semantics.. Artifact: [scratch-path] Fingerprint: 370d4768d7be02b70b6712f8fca9b061879552a846705c5a5f3573c9f40ca35e.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)

## Observed behaviour

- native: Types and two unit tests pass; journey fails with total 12; boundaries fails alias, cycle, private. Captured before run eeb98ed7-ca84-49b7-ab0d-47057023501c. ([scratch-path]
- applied: Fresh final-target types, unit tests, native boundaries, public UI controlled HTTP journey and maintained aggregate pass; checkout total 10 and public quote 12. ([scratch-path]
- controls: Fresh final-input native and aggregate proofs independently reject private, alias and cycle seeds; public imports and permitted core storage use pass. ([scratch-path]
- standalone: Both actual committed working checkout and different-root clone run the unchanged committed portable assessment and complete checker with fresh native leaf results; isolated home/cache and clean clone recorded. ([scratch-path]

## Inferred intent

- next: Existing public quote provides the representative public-interface extension pattern. Pricing choice is resolved by the owner: controlled journey fixture 10, public quote 12. (packages/web/public.ts:1)

## Observed debt

### F-001: HTTP checkout returns total 12 against agreed 10; local quote also returns 12. Pricing authority is unspecified.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: Preserve DESIGN.md agreed checkout total 10.
Consequence: Passing mocked tests conceal a failed real HTTP journey.
Fix: Correct controlled HTTP journey fixture price from 12 to 10 only; preserve checkout expected total 10 and public quote 12; no invented discount. Source: supervisor verdict 2026-10-11.
Scope: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, journey.mjs, unit.test.mjs
Verification: Capture failing original journey, then same approved acceptance plus native checks; retain HTTP observation and explicit input-change approval.
Sources: design, instructions, native

### F-002: Web imports core storage directly and through @storage alias.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI uses public core interface; storage stays behind core.
Consequence: Extensions can copy prohibited private access.
Fix: Export required pricing operations through existing core index; route web imports through public interface and preserve public.ts as runnable example.
Scope: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts
Verification: Native valid public imports and permitted core storage use pass; independently seeded private and alias imports fail with expected diagnostics.
Sources: design, instructions, native

### F-003: Core a/b form a detected cycle and unbounded mutual recursion.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed acyclic core dependencies; cycle is already rejected by native boundaries.mjs.
Consequence: Core helper calls recurse without termination and native boundary check cannot pass.
Fix: Retain existing exported names; make one helper terminate by delegating to agreed public pricing, with the other retaining a one-way dependency. Document selected cycle policy in DESIGN.md.
Scope: packages/core/a.ts, packages/core/b.ts, DESIGN.md, unit.test.mjs
Verification: Native cycle seed fails; allowed one-way helper use passes; exercise both helper exports.
Sources: design, instructions, native

### F-005: Order names both customer purchase and panel sequence.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): Proposed unambiguous domain vocabulary retaining authoritative glossary.md.
Consequence: Future extensions cannot infer which Order meaning to use.
Fix: Retain Order for customer purchase; panel sequence is now Panel order, as explicitly selected by the owner.
Scope: glossary.md
Verification: Review literal glossary delta and resulting guidance; no runtime rename.
Sources: design, instructions, native


## Missing protections

### F-004: Maintained check runs only type checking and omits boundaries, tests and real journey.

Status: selected. Resolved: true. Blocks next change: true.
Files: package.json, boundaries.mjs, AGENTS.md, DESIGN.md. Command: npm run check.
Principle: Approved design requires effective maintained enforcement.
Consequence: Normal check succeeds while design violations and checkout failure persist.
Fix: Extend existing npm run check with fail-fast native boundaries, units and journey; add pointers and coverage limits to existing guidance.
Scope: package.json, boundaries.mjs, AGENTS.md, DESIGN.md
Verification: Prove the identical maintained command on valid and independently seeded private, alias and cycle fixtures, with permitted sibling/core usage.
Sources: design, instructions, native

### F-006: No maintenance contract, standalone checker or assessed audit record exists.

Status: selected. Resolved: true. Blocks next change: true.
Files: .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, AGENTS.md, DESIGN.md. Command: none.
Principle (proposed new principle): Requested project-owned maintenance evidence and portable checks.
Consequence: A later user edit cannot be assessed from repository guidance alone.
Fix: Select minimal initial contract registering existing authoritative names, native checks and path mappings; install complete package-supported standalone checker through protected create; separately review audit record and final portable assessment. Commit implementation and assessment in separate local commits for clean-clone proof.
Scope: .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, AGENTS.md, DESIGN.md, .bstack/approvals.md
Verification: Contract/docs validation, complete impact assessment and fresh required leaves; invoke committed checker in current tree and different-root clean clone with isolated home/cache.
Sources: design, instructions, native


## Design decisions


## Proposed new principles

- F-003: Proposed acyclic core dependencies; cycle is already rejected by native boundaries.mjs. (selected)
- F-005: Proposed unambiguous domain vocabulary retaining authoritative glossary.md. (selected)
- F-006: Requested project-owned maintenance evidence and portable checks. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- No CI or delivery service selected; no hosted enforcement claim.
- Single initial commit: measure HEAD..HEAD yields sizes but no change-frequency or co-change evidence; no independent plans exist to compare overlap.
- Native analyzer covers static top-level import/export declarations; dynamic imports and other unsupported syntax require explicit coverage limits or separately selected checker changes.
- No external deployed price service is configured; journey observes a real local HTTP fixture, not production service behavior.
- Original audited journey failed at total 12 and original boundary protection failed; both remain historical failures. Applied target checks pass. Exact-plan target pairing was blocked after accepted authority-byte updates; a disposable original-state outcome control retains original authority bytes and one unchanged before/after plan, recording failed reproduction then corrected success.
- DESIGN.md user receipt note is preserved exactly and receipt wording remains a future owner decision.
- Fresh working-checkout and isolated-clone checker runs verified implementation/source revision 13f8e7f8c0d5734038798e3210eb22ae19a74eac using the unchanged portable assessment committed at c8fec301b238286e5aab96ddbe6fa176e41ca204; both checked checkouts were at c8fec301b238286e5aab96ddbe6fa176e41ca204. Subsequent changes to repository inputs, the comparison base or policy require fresh reassessment, a newly bound portable assessment and fresh checker execution.
