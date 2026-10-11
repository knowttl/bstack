# Proposed repo audit record

Result: ready for the stated next change

Stage: audit
Target: [fixture]
Revision: 0654cd7fd3929db0ee7216eb64e75f5f63e3aee1
Stated next change: Establish maintained foundation, then re-audit a user edit and implement a representative extension using repo guidance and checks.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs, .bstack/approvals.md
Current fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486

## Readiness evidence

- starting-checks: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./846a24c8-completed-native-checks.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.
- checkout-total-10: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./846a24c8-completed-native-checks.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.
- public-interface-example: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./846a24c8-completed-native-checks.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.
- native-boundary-proof: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./2761a650-completed-proof-summary.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.
- maintained-enforcement-proof: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./2761a650-completed-proof-summary.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.
- maintenance-contract: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./3242d4a5-completed-contract-validation.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.
- standalone-clean-clone: passed. Method: Fresh current-head capture. Exact output and linked child artifacts reviewed against original approved acceptance; findings validates review fingerprint and artifact hashes, not child semantics. Original failed starting journey is retained separately; readiness comes from corrected, fresh current-head results.. Artifact: ./3ca92286-completed-checker-evidence.json. Fingerprint: 71ae4380b03661be2589b1b4e4c4885e55ccbbcc567f29873ff8ed95e832e486.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)

## Observed behaviour

- native: Types and two unit tests pass; journey fails with total 12; boundaries fails alias, cycle, private. Captured before run eeb98ed7-ca84-49b7-ab0d-47057023501c. (./39da3a5b-starting-checks.json)
- applied: Fresh current-head types, units, boundaries, actual controlled local HTTP checkout via public UI and maintained aggregate pass. Checkout total 10 and quote 12 are preserved. (./846a24c8-completed-native-checks.json)
- controls: Six fresh current-input native and aggregate proofs pass: valid public imports and permitted core storage use succeed; independent private, alias and cycle seeds fail with expected diagnostics. (./2761a650-completed-proof-summary.json)
- standalone: Fresh working and isolated different-root clean clone invocations execute complete standalone checker against the unchanged committed assessment. Both checkouts are clean at resulting head 0654cd7fd3929db0ee7216eb64e75f5f63e3aee1; portable assessment names implementation c7fce613b004d87dc442f5fc6f6b6f1ad04d1cc1, with explicit original base b6c59b7810f5155fd514c9db60e98b7dffce0cc0. All distinct required leaves pass freshly. (./3ca92286-completed-checker-evidence.json)

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
- The versioned audit is a preserved historical snapshot of its named verified revisions. Final current-head findings, proof controls and checker evidence are retained in scratch as explicitly selected by the owner. Current verification covers resulting head 0654cd7fd3929db0ee7216eb64e75f5f63e3aee1 with portable implementation head c7fce613b004d87dc442f5fc6f6b6f1ad04d1cc1. Subsequent input, comparison-base or policy changes require fresh reassessment and checks.
