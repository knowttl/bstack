# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b53097d6461c09870b054da766b0926affb92987
Stated next change: Complete this existing-repo audit and maintained foundation; re-audit and extension are deferred to fresh conversations.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/internal/orders.ts, packages/web/alias.ts, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs
Current fingerprint: 00de90b71a14e4b9b6b4260caac1e2c7cffaa4cf352293e16e3682d63fc98691

## Readiness evidence

- Missing required outcome: portable-maintenance.
- Missing required outcome: clean-clone-checker.
- Outcome starting-checks has stale evidence.
- Outcome journey has stale evidence.
- Outcome boundary-proof has stale evidence.
- Outcome maintained-enforcement has stale evidence.
- Unresolved finding: F-005.
- starting-checks: passed. Method: Fresh directly captured helper output; attached manually and semantically reviewed.. Artifact: ./fe43fab5-checks.json. Fingerprint: d11d97264eb030009c44f0d9d4b01c4d9d73e9331ae726409b044c6c3b69cedb.
- journey: passed. Method: Fresh directly captured helper output; attached manually and semantically reviewed.. Artifact: ./fe43fab5-checks.json. Fingerprint: d11d97264eb030009c44f0d9d4b01c4d9d73e9331ae726409b044c6c3b69cedb.
- boundary-proof: passed. Method: Fresh directly captured helper output; attached manually and semantically reviewed.. Artifact: ./44f32ea3-boundary-proof-bundle.json. Fingerprint: d11d97264eb030009c44f0d9d4b01c4d9d73e9331ae726409b044c6c3b69cedb.
- maintained-enforcement: passed. Method: Fresh directly captured helper output; attached manually and semantically reviewed.. Artifact: ./6ddd5066-proof.json. Fingerprint: d11d97264eb030009c44f0d9d4b01c4d9d73e9331ae726409b044c6c3b69cedb.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10 at line 4. (DESIGN.md:3)
- interface: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order has two incompatible definitions. (glossary.md:3)
- owner-note: User note: receipt wording remains a future owner decision. Preserve exactly. (DESIGN.md:6)
- snapshot-verdict: Versioned audit is a historical observed-revision snapshot; current-head findings and readiness stay in scratch. (user verdict 2026-10-11)

## Observed behaviour

- implementation: Original code violated private/alias storage boundaries and contained a recursive cycle; approved corrections now use the public core entry and core-owned order storage. (packages/web/ui.ts:1)
- checks: Original types/units passed while boundaries and actual HTTP journey failed. Fresh committed maintained aggregate passes types, native boundaries, four unit tests and real local HTTP checkout total 10. (package.json:12)
- historical-observation: Historical snapshot after approved implementation, before portable assessment and clean-clone checker completion. Later current-head readiness remains in scratch. (commit b53097d6461c09870b054da766b0926affb92987)

## Inferred intent

- next: A subsequent extension needs portable authoritative guidance and maintained checks. Specific extension is not yet defined. (user request: final checkpoint)

## Observed debt

### F-001: Web directly imports private storage, resolves an alias into it, and stores orders in routes.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI never touches storage; use public core interface.
Consequence: Extensions can bypass the approved boundary.
Fix: Expose servicePrice and order creation via the existing core index; move order storage into core; make web adapters use that interface. Retain public.ts as the representative example and document it in DESIGN.md. Extend the existing native checker to reject web imports of non-index core files, including bridge bypasses.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/core/internal/orders.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/web/public.ts, DESIGN.md, boundaries.mjs
Verification: Native boundaries and types pass; valid public/sibling imports pass; deliberate private and alias violations fail; checkout remains 10.
Sources: design, interface, implementation

### F-002: Core a and b call each other recursively.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed: core dependency graph must remain acyclic, enforced by the existing native check.
Consequence: Calling either helper never terminates and boundary checks fail.
Fix: Retain both exports and filenames; make b a terminating leaf (proposed result 12), with a delegating to b. Record this rule and its scope in DESIGN.md.
Scope: packages/core/a.ts, packages/core/b.ts, DESIGN.md, unit.test.mjs
Verification: Native cycle proof fails only on seeded cycle; helper calls terminate with selected result.
Sources: implementation, checks

### F-003: Real journey price server supplies 12, conflicting with checkout acceptance total 10.

Status: selected. Resolved: true. Blocks next change: true.
Files: journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: The agreed checkout total is 10.
Consequence: Mocked unit success masks the failed user journey.
Fix: Set the journey test server price to 10; preserve its expected total 10 and production quote 12. Add representative public-interface checkout coverage. Do not hardcode a 10 result in production.
Scope: journey.mjs, unit.test.mjs
Verification: Captured failing before reproduction and passing after real local HTTP journey using unchanged expected total.
Sources: design, checks


## Missing protections

### F-005: Maintained check excludes boundaries and journey; no portable maintenance contract/checker or assessed audit record exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: package.json, AGENTS.md. Command: none.
Principle (proposed new principle): Maintain the approved interface and journey with repo-owned enforcement and explicit change assessment.
Consequence: Future work can pass check while violating design; clean-clone review cannot reproduce maintenance evidence.
Fix: Extend existing npm run check with fail-fast types, boundaries, units and journey; retain separate scripts. Add selected .bstack contract, installed standalone checker and portable assessment; point AGENTS.md to existing design/glossary/example and commands; create docs/repo-audit.md only after final assessment. Preserve CLAUDE.md import stub.
Scope: package.json, AGENTS.md, DESIGN.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Maintained-command valid/violation proof; native final checks; contract/docs/evidence validation; committed portable assessment; fresh checker in working tree and different-root clean clone with isolated home/cache. Every changed/unmapped path assessed.
Sources: design, interface, checks, next, snapshot-verdict


## Design decisions

### F-004: Order names both a customer purchase and UI panel sequence.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): Use one unambiguous canonical term per concept.
Consequence: Extension authors cannot identify the intended domain meaning.
Fix: Keep Order for customer purchase; rename the UI sequencing concept to Panel order in existing glossary.md. Use supported bold-term Markdown for native duplicate-term checking without changing either definition.
Scope: glossary.md
Verification: Owner selects the terminology; final docs checker and impact assessment cite unchanged purchase meaning.
Sources: terms


## Proposed new principles

- F-002: Proposed: core dependency graph must remain acyclic, enforced by the existing native check. (selected)
- F-004: Use one unambiguous canonical term per concept. (selected)
- F-005: Maintain the approved interface and journey with repo-owned enforcement and explicit change assessment. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005

## Limitations

- Historical snapshot at observed commit b53097d6461c09870b054da766b0926affb92987; it is not a live readiness authority.
- Portable assessment and fresh isolated clean-clone checker were not yet complete at this historical observation; this snapshot is not full-path proof.
- Receipt wording remains a future owner decision; the exact user note is preserved.
- Static native analysis covers imports, exports, aliases, non-index core bypasses and cycles; dynamic/runtime dependency edges are outside coverage.
- No hosted CI, delivery service or deployed outside dependency is selected. Actual checkout evidence uses a controlled local HTTP endpoint.
- The first attempted paired target capture was blocked by changed source hashes; the original-state replay retains identical acceptance sources before/after and separately proves the correction. Fresh target outcomes are captured independently.
- Findings evidence artifacts are attached with exact hashes; semantic support was reviewed in the main thread, not authenticated by findings validation.
