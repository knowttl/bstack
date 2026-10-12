# Proposed repo audit record

Result: ready for the stated next change

Stage: audit
Target: [fixture]
Revision: 8087a0a341b076544e74aa31e1125148090d2260
Stated next change: Approved repository corrections and maintained foundation are complete; re-audit and representative extension belong to fresh user conversations.
Reviewed scope: .gitignore, AGENTS.md, CLAUDE.md, DESIGN.md, boundaries.mjs, glossary.md, journey.mjs, package-lock.json, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, tsconfig.json, unit.test.mjs, .bstack/project.json, docs/repo-audit.md, .bstack/assessment.json, .bstack/bin/bstack-check.mjs
Current fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8

## Readiness evidence

- starting-checks: passed. Method: Explicit manual binding of hashed actual run-checks, native rule-proof and fresh standalone checker-result artifacts to the current findings fingerprint. Structural findings validation is not authenticated execution or semantic approval; original exact diff and assessment approvals supply the reviewed scope.. Artifact: [isolated-home][scratch-path] Fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8.
- journey: passed. Method: Explicit manual binding of hashed actual run-checks, native rule-proof and fresh standalone checker-result artifacts to the current findings fingerprint. Structural findings validation is not authenticated execution or semantic approval; original exact diff and assessment approvals supply the reviewed scope.. Artifact: [isolated-home][scratch-path] Fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8.
- native-rule-proof: passed. Method: Explicit manual binding of hashed actual run-checks, native rule-proof and fresh standalone checker-result artifacts to the current findings fingerprint. Structural findings validation is not authenticated execution or semantic approval; original exact diff and assessment approvals supply the reviewed scope.. Artifact: [isolated-home][scratch-path] Fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8.
- maintained-enforcement: passed. Method: Explicit manual binding of hashed actual run-checks, native rule-proof and fresh standalone checker-result artifacts to the current findings fingerprint. Structural findings validation is not authenticated execution or semantic approval; original exact diff and assessment approvals supply the reviewed scope.. Artifact: [isolated-home][scratch-path] Fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8.
- standalone-clean-clone: passed. Method: Explicit manual binding of hashed actual run-checks, native rule-proof and fresh standalone checker-result artifacts to the current findings fingerprint. Structural findings validation is not authenticated execution or semantic approval; original exact diff and assessment approvals supply the reviewed scope.. Artifact: [isolated-home][scratch-path] Fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8.
- final-assessment: passed. Method: Explicit manual binding of hashed actual run-checks, native rule-proof and fresh standalone checker-result artifacts to the current findings fingerprint. Structural findings validation is not authenticated execution or semantic approval; original exact diff and assessment approvals supply the reviewed scope.. Artifact: [isolated-home][scratch-path] Fingerprint: 892e645bdbafee8513807ec64cf2b546a685af2c039082337a25a113ae392da8.

## Documented intent

- design: UI never touches storage; checkout total is 10 (line 4). (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- language: Owner confirmed Order for purchase; Panel order for UI sequencing, applied in the existing glossary. (glossary.md:3)
- foundation: Approved maintenance foundation is now established in DESIGN.md, the native command contract, bundled standalone checker and separately approved portable assessment. (DESIGN.md:1)
- owner-note: User note: receipt wording remains a future owner decision. Exact uncommitted text must be preserved. (DESIGN.md:6)
- verdict: Supervisor fixture verdict dated 2026-10-11 selects F-001 through F-006, confirms existing total 10 and quote 12, corrects only the controlled endpoint, confirms Order/Panel order and historical snapshot policy; retained verbatim scope in scratch selection.txt. (DESIGN.md:4)

## Observed behaviour

- imports: Applied web consumers import only the public core index. (packages/web/ui.ts:1)
- journey: Approved controlled endpoint now supplies 10; the actual HTTP UI checkout passes the unchanged total-10 assertion. (journey.mjs:6)
- unit: Unit quote asserts 12; mocked checkout asserts 10 and passes while journey fails. (unit.test.mjs:5)
- cycle: Unused a/b pair removed; independent native cycle control fails as required. (boundaries.mjs:27)
- commands: Maintained aggregate now fail-fast chains typecheck, native boundaries, public unit tests and real HTTP journey. (package.json:12)

## Inferred intent


## Observed debt

### F-001: Web bypasses the public core interface via direct and alias storage imports.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: DESIGN.md:3 and AGENTS.md:1 require storage isolation and public core use.
Consequence: Storage changes can force UI edits; native boundary check exits 1.
Fix: Export the needed service-price operation through the existing core index; change web callers to that public entry. Keep the existing permitted quote module as the representative example, documenting it in DESIGN.md.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Native rule-proof: public import valid; direct private import and alias import each fail with their diagnostic. Preserve the existing HTTP journey and unit public interface checks.
Sources: design, instructions, imports

### F-002: Checkout returns 12 against the agreed total 10; unit checks mask the disagreement.

Status: selected. Resolved: true. Blocks next change: true.
Files: DESIGN.md, journey.mjs, journey.mjs, packages/core/internal/database.ts, unit.test.mjs. Command: npm run journey.
Principle: Approved checkout total remains 10; expectations must come from the design.
Consequence: Important checkout journey is broken despite passing unit tests.
Fix: Correct only the controlled endpoint fixture price to 10; preserve journey assertion 10, public quote 12 and the production servicePrice implementation. Owner approved this fixture correction; introduce no business discount.
Scope: journey.mjs, DESIGN.md
Verification: Captured failing before journey, unchanged approved case passing after correction, surrounding public checks, and any required live dependency probes. Local fixture is a real HTTP interaction but is not a production service observation.
Sources: design, journey, unit

### F-003: Unexported core a and b form an unconditional recursion and import cycle.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle: Existing native boundaries.mjs rejects cycles.
Consequence: Calling either helper never reaches a base case; maintained enforcement cannot pass cleanly.
Fix: Remove the selected unused, unexported a.ts/b.ts pair; preserve all public entry points and callers.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Core entry point and all callers reviewed; public checks preserved; native cycle positive/negative fixture proof. Deletion is subject to exact diff approval.
Sources: cycle, commands

### F-005: Order names both a customer purchase and UI panel sequence.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md, glossary.md. Command: none.
Principle (proposed new principle): One canonical domain concept per glossary term.
Consequence: Future extension can interpret checkout Order ambiguously.
Fix: Owner confirmed Order for customer purchases and Panel order for UI panel sequencing. Correct the existing lowercase glossary.md without renaming code.
Scope: glossary.md
Verification: Owner confirms meanings; maintained document contract checks existing glossary and change assessment cites the confirmed definitions.
Sources: language


## Missing protections

### F-004: npm run check omits boundary, unit and checkout checks; current boundary traversal has unreported syntax limits.

Status: selected. Resolved: true. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): The maintained command must fail when approved boundaries or the real checkout acceptance fail.
Consequence: A green default check currently permits all observed failures.
Fix: Extend the maintained check with fail-fast type, native boundary, unit and real HTTP journey checks. Strengthen the existing TypeScript-resolved web boundary to reject every core target except index.ts, so an alternate private core file cannot bypass public entry enforcement. Static imports/re-exports only; dynamic dependencies need explicit review.
Scope: package.json, boundaries.mjs, DESIGN.md, AGENTS.md
Verification: Independent native boundary valid/violation proof for private, alias and cycle cases; equivalent re-export syntax within supported scope; maintained aggregate passes valid public and sibling-package control, fails seeded violation with the intended diagnostic.
Sources: commands, design, journey

### F-006: No completion-evidence contract, standalone checker or assessed-state audit record exists.

Status: selected. Resolved: true. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, package.json. Command: none.
Principle (proposed new principle): Owner requests a maintained foundation that future changes can verify without the installed skill.
Consequence: Later user edits and extensions lack a durable source/check mapping and fresh clean-clone verification.
Fix: Reuse DESIGN.md and glossary.md. Add selected contract and complete unchanged generated standalone checker bundle. Historical audit snapshot names observed revision and user-note state; final current-head findings/readiness stay in scratch. Commit reviewed implementation, separately review/apply/commit exact portable assessment, then fresh standalone runs in working checkout and isolated different-root clean clone. No CI, delivery service or CLAUDE consolidation.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, docs/repo-audit.md, .bstack/assessment.json
Verification: Validate contract/docs; final scope evidence collect and substantive review; capture required checks; final findings validate/render; protect separately approved audit/assessment bytes; fresh standalone checker in working checkout and different-root clean clone with isolated home/cache and the explicit comparison base.
Sources: foundation, commands, design


## Design decisions


## Proposed new principles

- F-004: The maintained command must fail when approved boundaries or the real checkout acceptance fail. (selected)
- F-005: One canonical domain concept per glossary term. (selected)
- F-006: Owner requests a maintained foundation that future changes can verify without the installed skill. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Static imports and re-exports only; dynamic imports/CommonJS require need explicit review.
- Local HTTP checkout does not establish production-service behavior; no hosted CI/delivery service selected.
- Structural checking does not authenticate owner approval or replace semantic review. Receipt wording remains a future owner decision.
