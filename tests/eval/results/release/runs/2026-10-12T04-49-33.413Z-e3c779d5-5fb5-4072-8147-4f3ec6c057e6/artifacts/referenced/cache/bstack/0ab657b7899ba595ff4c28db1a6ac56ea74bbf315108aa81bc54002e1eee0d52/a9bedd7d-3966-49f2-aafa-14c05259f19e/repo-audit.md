# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Establish reviewed corrections and maintained foundation, then re-audit a user edit before a representative public-interface extension.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs
Current fingerprint: b1431974208d8fadeb64d101c2c83ff9d23f4e38aa67d9daba2bf35e5af51011

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: boundary-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: maintenance-contract.
- Missing required outcome: standalone-clean-clone.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- Unresolved finding: F-006.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- interface: Use approved design and public core interface; public quote is representative. (AGENTS.md:1; packages/core/index.ts:1; packages/web/public.ts:1)
- language: Order has two competing meanings. (glossary.md:3-4)
- selection: Selected corrections, public quote 12, endpoint 10, Panel order, maintenance and portable evidence; historical snapshot policy and receipt note. (Supervisor fixture verdicts 2026-10-11 in conversation; DESIGN.md:6)

## Observed behaviour

- checks: Captured native typecheck and unit pass; loopback journey fails at total 12; boundary command fails alias/cycle/private. Unit success does not verify the journey. (package.json:12-15; journey.mjs:7-12; boundaries.mjs:1-35; unit.test.mjs:5-9)
- cycle: Mutually recursive core modules have no terminating base case. (packages/core/a.ts:1; packages/core/b.ts:1)
- maintenance: No completion criteria, maintained aggregate, maintenance contract or standalone checker is present. (DESIGN.md:1-4; package.json:12-15)

## Inferred intent


## Observed debt

### F-001: Checkout journey returns 12 instead of approved 10.

Status: selected. Resolved: false. Blocks next change: true.
Files: journey.mjs, packages/core/internal/database.ts, unit.test.mjs. Command: npm run journey.
Principle: Preserve checkout total 10.
Consequence: Current important journey fails although mocked tests pass.
Fix: Correct only the controlled journey endpoint fixture to supply 10; preserve assertion 10, public quote 12 and existing pricing behavior. No discount change.
Scope: journey.mjs
Verification: Captured failing real loopback reproduction before, passing after; unchanged public quote 12 unit check.
Sources: design, checks

### F-002: Web UI, routes and aliasQuote access core storage internals.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts. Command: npm run boundaries.
Principle: UI uses only public core interface.
Consequence: Storage changes leak into web consumers.
Fix: Export servicePrice through core index and route all web imports through that public interface.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts
Verification: Native valid/violation proof for relative private import, alias and re-export; valid public and core-internal controls.
Sources: design, interface, checks

### F-003: Core a/b cycle fails the existing native graph check.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Keep the existing acyclic dependency check; document its scope as a selected principle.
Consequence: Calls recurse without termination; maintained graph cannot pass.
Fix: Delete the two unused, unexported mutually recursive a/b modules to remove the cycle without inventing finite business behavior.
Scope: packages/core/a.ts, packages/core/b.ts, DESIGN.md
Verification: Cycle negative proof and clean graph control; journey compatibility.
Sources: cycle, checks


## Missing protections

### F-004: Existing check command only typechecks; no maintained evidence foundation exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: package.json, DESIGN.md, AGENTS.md. Command: none.
Principle (proposed new principle): Completion requires affected approved journeys on final inputs.
Consequence: Future changes can pass check while checkout or architecture fails; guidance cannot support the requested extension.
Fix: Extend npm run check with boundary, unit and journey checks; add a short completion/maintenance section to DESIGN.md, pointers in AGENTS.md, selected .bstack contract and repo-owned standalone checker, then assessed portable evidence. Preserve names and CLAUDE import stub.
Scope: package.json, DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, boundaries.mjs
Verification: Maintained command native positive/negative proof, docs/contract/evidence validation and fresh standalone checker in working checkout and different-root clean clone with isolated home/cache. Each generated payload and assessment needs exact approval.
Sources: design, checks, maintenance

### F-006: No assessed-state historical audit snapshot or portable reviewed assessment exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: DESIGN.md, package.json. Command: none.
Principle (proposed new principle): Versioned audit records are historical observations; fresh scratch evidence decides current readiness.
Consequence: A future maintainer cannot trace selected corrections and independent current-checkout verification.
Fix: Create a historical docs/repo-audit.md snapshot with observed revision; later separately review and apply the exact portable .bstack/assessment.json. Retain final current-head findings/readiness in scratch.
Scope: docs/repo-audit.md, .bstack/assessment.json
Verification: Final mapped impact assessment, actual execution artifacts and fresh standalone working-tree and isolated different-root clean-clone checker results.
Sources: maintenance, checks


## Design decisions

### F-005: Order means both purchase and panel sequence.

Status: selected. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One canonical meaning per concept in this context.
Consequence: Extension guidance is ambiguous.
Fix: Keep Order for customer purchases and rename UI sequencing to Panel order, preserving glossary.md.
Scope: glossary.md
Verification: Owner confirms meaning; protected exact glossary diff and maintenance coverage.
Sources: language


## Proposed new principles

- F-003: Keep the existing acyclic dependency check; document its scope as a selected principle. (selected)
- F-004: Completion requires affected approved journeys on final inputs. (selected)
- F-005: One canonical meaning per concept in this context. (selected)
- F-006: Versioned audit records are historical observations; fresh scratch evidence decides current readiness. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Owner selected F-001 through F-006 and clarified controlled endpoint 10, quote 12, Panel order and historical audit policy.
- Exact bytes await approval; no target edits made.
- Receipt wording remains a future owner decision; user note preserved exactly.
- Only initial commit exists; history signals advisory.
- Static dependency checker covers imports and re-exports; dynamic imports, require calls and generated code need review.
- No hosted CI or delivery service selected.
