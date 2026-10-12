# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Establish reviewed corrections and maintained foundation, then re-audit a user edit before a representative public-interface extension.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs
Current fingerprint: 437ff55f3c9b721b3b0d6aa9ee76273eb21701453381690513bf8347f16d2bcd

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

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- interface: Use approved design and public core interface; public quote is representative. (AGENTS.md:1; packages/core/index.ts:1; packages/web/public.ts:1)
- language: Order has two competing meanings. (glossary.md:3-4)

## Observed behaviour

- checks: Captured native typecheck and unit pass; loopback journey fails at total 12; boundary command fails alias/cycle/private. Unit success does not verify the journey. (package.json:12-15; journey.mjs:7-12; boundaries.mjs:1-35; unit.test.mjs:5-9)
- cycle: Mutually recursive core modules have no terminating base case. (packages/core/a.ts:1; packages/core/b.ts:1)
- maintenance: No completion criteria, maintained aggregate, maintenance contract or standalone checker is present. (DESIGN.md:1-4; package.json:12-15)

## Inferred intent


## Observed debt

### F-001: Checkout journey returns 12 instead of approved 10.

Status: proposed. Resolved: false. Blocks next change: true.
Files: journey.mjs, packages/core/internal/database.ts, unit.test.mjs. Command: npm run journey.
Principle: Preserve checkout total 10.
Consequence: Current important journey fails although mocked tests pass.
Fix: Correct the price fixture/default and public expectation to 10, retaining the real HTTP path and unchanged total assertion.
Scope: journey.mjs, packages/core/internal/database.ts, unit.test.mjs
Verification: Capture failing reproduction before edits and passing real loopback journey plus public quote afterward.
Sources: design, checks

### F-002: Web UI, routes and aliasQuote access core storage internals.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts. Command: npm run boundaries.
Principle: UI uses only public core interface.
Consequence: Storage changes leak into web consumers.
Fix: Export servicePrice through core index and route all web imports through that public interface.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts
Verification: Native valid/violation proof for relative private import, alias and re-export; valid public and core-internal controls.
Sources: design, interface, checks

### F-003: Core a/b cycle fails the existing native graph check.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Keep the existing acyclic dependency check; document its scope as a selected principle.
Consequence: Calls recurse without termination; maintained graph cannot pass.
Fix: Remove the unused cycle with reviewed deletion, or choose a supported finite behavior before retaining these functions.
Scope: packages/core/a.ts, packages/core/b.ts, DESIGN.md
Verification: Cycle negative proof and clean graph control; journey compatibility.
Sources: cycle, checks


## Missing protections

### F-004: Existing check command only typechecks; no maintained evidence foundation exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, DESIGN.md, AGENTS.md. Command: none.
Principle (proposed new principle): Completion requires affected approved journeys on final inputs.
Consequence: Future changes can pass check while checkout or architecture fails; guidance cannot support the requested extension.
Fix: Extend npm run check with boundary, unit and journey checks; add a short completion/maintenance section to DESIGN.md, pointers in AGENTS.md, selected .bstack contract and repo-owned standalone checker, then assessed portable evidence. Preserve names and CLAUDE import stub.
Scope: package.json, DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Maintained command native positive/negative proof, docs/contract/evidence validation and fresh standalone checker in working checkout and different-root clean clone with isolated home/cache. Each generated payload and assessment needs exact approval.
Sources: design, checks, maintenance


## Design decisions

### F-005: Order means both purchase and panel sequence.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One canonical meaning per concept in this context.
Consequence: Extension guidance is ambiguous.
Fix: Recommend Order for customer purchase and Panel sequence for UI arrangement, preserving glossary.md. This remains a pending owner decision.
Scope: glossary.md
Verification: Owner confirms meaning; protected exact glossary diff and maintenance coverage.
Sources: language


## Proposed new principles

- F-003: Keep the existing acyclic dependency check; document its scope as a selected principle. (proposed)
- F-004: Completion requires affected approved journeys on final inputs. (proposed)
- F-005: One canonical meaning per concept in this context. (proposed)

## Selected findings


## Limitations

- Selection and exact diff approvals are pending; no project edits made.
- Native run-checks artifacts captured separately; not yet bound as validated findings execution. Mocked unit coverage and typechecking do not establish approved journey or boundary compliance.
- Only initial commit exists; history/co-change signals are advisory. Overlap reports shared public-core contract, no shared declared paths.
- No vision or README exists; approved DESIGN.md is retained as baseline; no new product intent inferred.
- Boundary checker observes static imports/re-exports; dynamic dependency coverage is not established.
- An attempted optional project-contract.json schema lookup was unavailable; contract preparation is deferred until documented CLI schema guidance is resolved.
