# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Review evidenced checkout foundation recommendations before selecting any implementation
Reviewed scope: AGENTS.md, CLAUDE.md, DESIGN.md, glossary.md, package.json, package-lock.json, tsconfig.json, unit.test.mjs, journey.mjs, boundaries.mjs, packages/core/index.ts, packages/core/b.ts, packages/core/a.ts, packages/core/package.json, packages/core/internal/database.ts, packages/web/routes.ts, packages/web/package.json, packages/web/alias.ts, packages/web/ui.ts, packages/web/public.ts
Current fingerprint: ecd8582a727917b379dabddeba3f590e398b6d73a1e78f937c3601a31476c922

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: foundation-review.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- Unresolved finding: F-006.

## Documented intent

- S-design: UI never touches storage; approved checkout total is 10. (DESIGN.md:3-4)
- S-instructions: Use approved design and public core interface. CLAUDE.md is an import stub, preserved. (AGENTS.md:1)
- S-terms: Order has two conflicting meanings. No terminology approval recorded. (glossary.md:3-4)

## Observed behaviour

- S-code: Private imports, aliased storage access, route-owned mutable totals and pricing; public core exports price only. (packages/web/ui.ts:1-4; packages/web/routes.ts:1-6; packages/web/alias.ts:1; packages/core/index.ts:1)
- S-tests: Unit expectation 12 has no approved quote-price source. Mocked checkout passes with 10; local HTTP supplies 12 and preserves expected 10. (unit.test.mjs:5-8; journey.mjs:6-12)
- S-checks: Strict tsc is maintained check; separate compiler-resolved static boundary analysis checks private/alias imports and cycles. (package.json:12-16; boundaries.mjs:15-32; tsconfig.json:6-13)
- S-cycle: Mutual recursion, outside observed checkout imports. (packages/core/a.ts:1-2; packages/core/b.ts:1-2)
- S-history: One initial commit b6c59b7. Measurement cannot support frequent-change or conflict claims. Proposed plans share three write paths and public-core contract. (measure.json; overlap.json)
- S-execution: Captured run-checks: npm run check exit 0; npm run test exit 0 (2 tests); npm run journey exit 1 (total 12 vs 10); npm run boundaries exit 1 (alias, cycle, private). (result-types.json; result-unit.json; result-journey.json; result-boundaries.json)

## Inferred intent

- S-inference: Checkout policy and storage responsibilities appear mixed in web; move only responsibilities required by approved boundary, without inventing a persistence service. (packages/web/routes.ts:3-5)

## Observed debt

### F-002: Three web modules bypass the public core interface, including a resolved storage alias.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI never touches storage and callers use public core (existing).
Consequence: Web callers depend on private adapter details; package exports do not stop relative or aliased imports.
Fix: Route web dependencies through core/index.ts; expose a bounded checkout/pricing capability once F-001 policy is resolved. Keep storage private. Preserve supported signatures unless separately reviewed.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts
Verification: Compiler-resolved boundaries must pass. Before adoption, prove allowed public/sibling imports and independent private/alias violations in disposable fixtures; retain checkout acceptance.
Sources: S-design, S-instructions, S-code, S-checks

### F-004: Core a and b form mutual recursive cycle; analyzer rejects it.

Status: proposed. Resolved: false. Blocks next change: false.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed acyclic dependency rule, currently encoded in boundary command.
Consequence: Any invocation recurses without termination; full boundary check stays red although checkout does not import these files.
Fix: Review intended responsibility and remove unused cycle or implement a nonrecursive owner. Do not silently disable the cycle rule; any deferred debt needs scoped reason and removal condition.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Acyclic compiler graph, deliberate cycle fixture rejection, and unchanged public checkout journey.
Sources: S-cycle, S-checks, S-execution


## Missing protections

### F-003: Maintained check runs only types; passing units do not establish checkout readiness.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, unit.test.mjs, journey.mjs. Command: npm run check.
Principle (proposed new principle): Proposed completion rule: affected approved journeys pass on final inputs; units alone are insufficient.
Consequence: Normal check can be green while the approved journey and boundaries fail.
Fix: Extend existing npm run check with fail-fast type, unit, boundary and journey commands after selected debt is fixed. Add a short evidence section to DESIGN.md pointing to journey.mjs and approved acceptance. No new verification engine or CI requested.
Scope: package.json, DESIGN.md
Verification: Prove maintained command on clean control and seeded boundary/acceptance violations; keep known failures visible. Verify using local TypeScript 5.9.3, Node 24.17.0 and npm 11.13.0.
Sources: S-design, S-checks, S-tests, S-execution


## Design decisions

### F-001: Checkout returns 12 against approved 10; service-price reconciliation policy is unstated.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, journey.mjs, packages/web/ui.ts. Command: npm run journey.
Principle: Preserve approved checkout acceptance (existing).
Consequence: Customers receive a result that fails the agreed outcome.
Fix: Blocked: choose a core-owned rule for differing service prices, then repair production pricing through the public interface. Do not alter expectedTotal or seed HTTP with 10 merely to hide the failure.
Scope: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, unit.test.mjs
Verification: Reuse unchanged local HTTP journey asserting 201/10 before and after; minimally protect the chosen policy through the public checkout boundary.
Sources: S-design, S-code, S-tests, S-execution

### F-005: Order is defined as a purchase and as UI panel sequence.

Status: proposed. Resolved: false. Blocks next change: false.
Files: glossary.md. Command: none.
Principle (proposed new principle): Proposed distinct domain terminology (draft only).
Consequence: Future naming changes could confuse purchase semantics with display ordering.
Fix: Draft only: Order = a customer purchase; Panel sequence = the sequence in which UI panels appear. Await owner confirmation and later exact review; no naming migration.
Scope: glossary.md
Verification: Review against both existing definitions; apply no terminology bytes without selection.
Sources: S-terms

### F-006: Public quote test expects 12 without a documented quote-price acceptance case.

Status: proposed. Resolved: false. Blocks next change: false.
Files: unit.test.mjs, packages/web/public.ts, DESIGN.md. Command: npm run test.
Principle: Tests protect approved public behaviour; distinct quote policy remains unresolved.
Consequence: A green test may lock in implementation output that conflicts with a later checkout pricing decision.
Fix: Retain checkout total 10. Block changing quote expectation until its relationship to checkout price is resolved; then use the smallest public contract assertion from that approved source.
Scope: unit.test.mjs, packages/web/public.ts
Verification: Review quote acceptance source and run public unit check plus unchanged checkout HTTP journey.
Sources: S-design, S-tests


## Proposed new principles

- F-003: Proposed completion rule: affected approved journeys pass on final inputs; units alone are insufficient. (proposed)
- F-004: Proposed acyclic dependency rule, currently encoded in boundary command. (proposed)
- F-005: Proposed distinct domain terminology (draft only). (proposed)

## Selected findings


## Limitations

- Read-only audit: no selected findings, apply, project report write, acceptance change or authoritative-document replacement.
- F-001 pricing/service policy, F-004 cycle responsibility, F-005 terminology and F-006 quote acceptance remain blocked pending owner decisions.
- Node 24.17.0; npm 11.13.0; prepared local TypeScript 5.9.3. Fresh host preflight passed before every Node run: about 31.5–33.4 GB memory, 25.8 GB disk, load below 3, zero existing Node suites (one proposed).
- run-checks artifacts are command capture only. Initial plan mapped mocked unit results as user-journey coverage and tsc as interface coverage; neither establishes those outcomes. Main assessment explicitly rejects that broader generated coverage. Only journey.mjs exercises actual local HTTP checkout and it fails.
- No findings-fingerprint execution claims yet: execution remains empty. Captured command artifacts and hashes are retained in evidence-index.json, not represented as findings-validated readiness evidence.
- External price endpoint in unit tests is .invalid and mocked; only localhost HTTP was observed. Production service identity, pricing behaviour, failures and access are unavailable. No external live probe or deployment readiness claimed.
- No README, vision, standards, decisions, audit or CI found. Approved design suffices for this bounded audit; do not invent or approve a replacement vision.
- One initial commit only; no repeat change frequency or observed conflicts. measure.json includes default generated/lockfile exclusions, 50% Git rename detection, no renames or formatting exclusions.
- Native boundaries resolves static top-level import/export declarations and aliases; dynamic imports and transitive public bridges are not proven. No rule-proof or maintained integration proof run because no rule selected.
- No formatter/linter configured; cosmetic tools not proposed without a concrete need. No language-stack replacement or third-party service recommendation; external language/service research not needed for these repo-native findings.
- Research main-thread for this small fixture; cite-check passed all 20 revision-bound file citations.
