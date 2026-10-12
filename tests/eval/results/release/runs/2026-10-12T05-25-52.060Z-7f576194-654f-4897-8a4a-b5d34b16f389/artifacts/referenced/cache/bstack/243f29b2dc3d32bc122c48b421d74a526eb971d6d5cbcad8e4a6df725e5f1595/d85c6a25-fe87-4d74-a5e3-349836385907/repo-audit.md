# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: After final foundation, accept a user edit, re-audit and implement a representative extension using repo guidance/checks only.
Reviewed scope: AGENTS.md, DESIGN.md, glossary.md, unit.test.mjs, journey.mjs, boundaries.mjs, package.json, docs/repo-audit.md, packages/core/index.ts, packages/core/b.ts, packages/core/a.ts, packages/core/package.json, packages/core/internal/database.ts, packages/web/routes.ts, packages/web/package.json, packages/web/alias.ts, packages/web/ui.ts, packages/web/public.ts, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json
Current fingerprint: 6c108dd2083c5b39dd4a9c42ade8932a53b58f9130381179bcdb401e6f99efa3

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: native-boundary-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: public-interface-example.
- Missing required outcome: foundation-review.
- Missing required outcome: maintenance-contract.
- Missing required outcome: final-assessment.
- Missing required outcome: standalone-clean-clone.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- Unresolved finding: F-006.
- Unresolved finding: F-007.

## Documented intent

- design: UI never touches storage; checkout total is 10. (DESIGN.md:3-4)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order has conflicting meanings. (glossary.md:3-4)
- next: Maintain standalone guidance and evidence, run clean clone checker; preserve total10 and authoritative file names. (user request: final checkpoint and subsequent edit/extension)

## Observed behaviour

- pricing: Raw and public price12; real HTTP checkout returns12 and fails while mock total10 passes. (packages/core/internal/database.ts:1; journey.mjs:12; unit.test.mjs:6)
- imports: Direct and alias private storage imports. (packages/web/ui.ts:1; packages/web/routes.ts:1; packages/web/alias.ts:1)
- cycle: Mutually recursive unused a/b files; native boundary tool fails with cycle. (packages/core/a.ts:1-2; packages/core/b.ts:1-2; boundaries.mjs:32)
- checks: Maintained check is types only; boundary tool skips dynamic/import-equals forms. (package.json:12-16; boundaries.mjs:10-12)
- maintenance: No maintained evidence completion policy, maintenance contract or standalone checker exists. (DESIGN.md:1-4; AGENTS.md:1)

## Inferred intent


## Observed debt

### F-001: Real HTTP checkout returns12 instead of the agreed10; passing mock hides this.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/internal/database.ts, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: Preserve agreed checkout total10
Consequence: The first real journey fails; unit success cannot establish readiness.
Fix: Pending pricing decision: recommend canonical public core price10 for quote and checkout, retain quantity/discount arithmetic and existing journey assertion10. Define HTTP pricing policy before implementation.
Scope: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, unit.test.mjs, DESIGN.md
Verification: Retain captured failing reproduction and run unchanged real HTTP journey after correction; cover approved public quote and checkout cases.
Sources: design, pricing

### F-002: UI imports storage directly and through a TS alias.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts. Command: npm run boundaries.
Principle: UI never touches storage; public core interface
Consequence: UI bypasses the approved responsibility boundary.
Fix: Route all web storage access through packages/core/index.ts; maintain that authoritative public interface and show a runnable public import example in DESIGN.md.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Native TS-resolved graph passes public control including permitted core-internal use; deliberately seeded direct, alias and re-export violations fail with specific diagnostics; real checkout passes.
Sources: design, instructions, imports

### F-003: Core a/b imports form a cycle and both functions recurse indefinitely.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed: retain native acyclic dependency check
Consequence: Native boundary check fails; calling either function does not terminate.
Fix: Recommend deleting these two unused, non-exported fixture modules; preserve exported core interface. Alternatively select a terminating implementation with its intended result specified.
Scope: packages/core/a.ts, packages/core/b.ts, DESIGN.md
Verification: Prove clean control and new seeded cycle through native boundary tool; type, public interface and journey checks pass.
Sources: cycle, checks


## Missing protections

### F-005: npm run check omits existing journey, unit and boundary checks; boundary syntax coverage has gaps.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): Maintained checks must protect approved boundaries and journey
Consequence: A green maintained check accepts known violations and the broken journey.
Fix: Extend existing check using fail-fast types, units, boundaries and journey. Extend TypeScript AST traversal for literal dynamic imports and import-equals; reject unanalysable imports explicitly or document a selected narrow limit. Retain aliases for bypass proof. No CI, formatter or lint framework addition.
Scope: package.json, boundaries.mjs, DESIGN.md
Verification: Separate rule-proof controls and seeds for private, alias, re-export, cycle and supported dynamic/import-equals syntax; maintained npm run check independently passes valid sibling/core-internal case and rejects each seeded violation.
Sources: design, checks

### F-006: No maintained change-evidence foundation or repo-owned standalone checker is present.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, AGENTS.md. Command: none.
Principle (proposed new principle): Proposed: complete affected journeys and assess source impact on final inputs
Consequence: Future edits can bypass documentation impact review or rely on stale success.
Fix: Add a short completion and maintenance policy to DESIGN.md, pointers in AGENTS.md, selected .bstack/project.json mappings and installed dependency-free .bstack/bin/bstack-check.mjs via protected writes. Require explicit base, source citations, affected paths including unmapped paths, selected exact assessment review and fresh native results. Keep CLAUDE.md import stub.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json
Verification: Validate contract/docs/evidence; capture final affected checks and exact assessed record approval; commit implementation then separately approved portable assessment; freshly run standalone checker in working tree and different-root clean clone with isolated home/cache.
Sources: maintenance, next

### F-007: No final assessed-state audit record exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md. Command: none.
Principle (proposed new principle): Proposed: report current evidence and verification limits separately from design
Consequence: A partial audit could be mistaken for full-path readiness.
Fix: After selected corrections, refresh findings fingerprint and final outcomes, render docs/repo-audit.md and present its exact bytes as a separate protected edit for approval. Do not claim readiness before all required fresh evidence and clean clone proof.
Scope: docs/repo-audit.md
Verification: Findings validate and render on final state; refresh after report write; map every changed path and retain failed/unresolved outcomes.
Sources: maintenance, next


## Design decisions

### F-004: Order has two competing meanings.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle: One canonical name per concept within this small context
Consequence: A representative extension has ambiguous language guidance.
Fix: Pending owner decision: recommend Order for customer purchase and Panel order for UI sequence; retain glossary.md filename.
Scope: glossary.md
Verification: Review exact definitions against owner selection; docs/contract link checks. No automatic code naming migration.
Sources: terms


## Proposed new principles

- F-003: Proposed: retain native acyclic dependency check (proposed)
- F-005: Maintained checks must protect approved boundaries and journey (proposed)
- F-006: Proposed: complete affected journeys and assess source impact on final inputs (proposed)
- F-007: Proposed: report current evidence and verification limits separately from design (proposed)

## Selected findings


## Limitations

- Pricing and vocabulary decisions pending; no selected corrections or exact diff approval yet.
- Starting capture63961c47-bbb3-4140-a052-ea701c1d8932: types/units passed, journey/boundaries failed. No user journey verified.
- Starting results are captured run-checks evidence, not yet validated findings-fingerprint execution evidence.
- Only one initial commit: history/co-change advisory; declared correction/foundation plans share design contract.
- No third-party external dependency; journey owns local HTTP fixture.
- No CI selected or executed; no formatting/lint source discovered.
- Final assessed record, portable commits and fresh different-root checker invocation remain pending; no full-path completion claim.
