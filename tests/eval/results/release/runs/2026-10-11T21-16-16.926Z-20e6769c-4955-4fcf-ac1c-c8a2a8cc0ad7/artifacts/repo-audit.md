# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Review foundation recommendations for the existing checkout before selecting any implementation change.
Reviewed scope: AGENTS.md, CLAUDE.md, DESIGN.md, glossary.md, package.json, package-lock.json, tsconfig.json, unit.test.mjs, journey.mjs, boundaries.mjs, packages/core/index.ts, packages/core/b.ts, packages/core/a.ts, packages/core/package.json, packages/core/internal/database.ts, packages/web/routes.ts, packages/web/package.json, packages/web/alias.ts, packages/web/ui.ts, packages/web/public.ts
Current fingerprint: a8ac9433d0b7657e97e88b2b2c86da1ee46814c90b47a22e58c70bcc80af61fa

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
- Unresolved finding: F-007.

## Documented intent

- design: UI never touches storage; line 4 agrees checkout total 10. Preserve these approved commitments. (DESIGN.md:3)
- agents: Use approved design and public core interface. CLAUDE.md:1 imports this instruction; both remain unchanged. (AGENTS.md:1)
- glossary: Lines 3 and 4 define Order inconsistently as customer purchase and panel sequence. (glossary.md:3)

## Observed behaviour

- price: price returns 12; servicePrice returns unchecked fetch JSON price. (packages/core/internal/database.ts:1)
- ui: UI imports private servicePrice and feeds route with fetched price. (packages/web/ui.ts:1)
- routes: Private price import, quantity calculation, discount and module-local orders array. (packages/web/routes.ts:1)
- alias: Storage alias import bypasses public core entry. (packages/web/alias.ts:1)
- public: Public core exports price only; package exports index.ts. (packages/core/index.ts:1)
- cycle: a calls b and b calls a; no checkout caller observed. (packages/core/a.ts:1)
- tests: quote test expects 12; checkout HTTP test mocks 10. (unit.test.mjs:5)
- journey: Loopback HTTP fixture returns 12; line 12 asserts total 10. (journey.mjs:6)
- commands: Maintained check runs only tsc; test, journey and boundaries are separate. (package.json:12)
- execution: Captured run-checks: types/unit exit 0; boundaries/journey exit 1. No journey verified. Acceptance source hashes preserved. ([isolated-home][scratch-path]
- overlap: Declared candidate plans share core/index.ts, unit.test.mjs, journey.mjs and package.json; shared checkout-price and checkout-result contracts. ([isolated-home][scratch-path]
- history: Only initial commit exists; HEAD..HEAD measurement captures endpoint sizes, no interval commits or co-change pairs. No repeated coupling inferred. ([isolated-home][scratch-path]

## Inferred intent

- gate-risk: A type-only maintained command can pass despite approved checkout/boundary violations; observed by separate failing native checks. (package.json:12)

## Observed debt

### F-001: Real loopback checkout returns 12 while approved acceptance remains 10. Unit mock conceals this failure.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/internal/database.ts, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: Preserve DESIGN.md:4 agreed total 10; expectations must come from approved acceptance.
Consequence: Existing checkout journey fails; green units cannot establish readiness.
Fix: Keep the 10 assertion unchanged. Review whether upstream contract should supply 10 or core must enforce agreed pricing on an upstream 12 response. Then fix the selected source/policy and public quote expectation where supported; do not merely retune the HTTP fixture to hide disagreement.
Scope: packages/core/internal/database.ts, packages/core/index.ts, unit.test.mjs, journey.mjs
Verification: Reproduce original 12 response failure, then assert 10 through real loopback HTTP checkout on final inputs using the approved resolution; rerun units/types/boundaries.
Sources: design, price, tests, journey, execution

### F-002: Web UI/routes import private database directly, and aliasQuote accesses it through @storage.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, tsconfig.json. Command: npm run boundaries.
Principle: AGENTS.md public core interface and DESIGN.md:3 UI/storage separation.
Consequence: Web depends on storage representation; internal changes require coordinated caller edits.
Fix: Provide the smallest reviewed public core capability for the current checkout; use existing public price export for routes and aliasQuote, and migrate UI to the selected public service operation. Decide whether route order-state ownership falls under storage prohibition before any dependent relocation.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts
Verification: Current TypeScript-resolved boundary checker must reject private and alias imports; prove clean public-import controls and deliberate bypasses on disposable fixtures if selected; retain real HTTP checkout before/after protection. Dynamic imports are outside current checker scope.
Sources: agents, design, ui, routes, alias, public, execution

### F-003: Core a and b form a cycle and recurse without a terminating call if invoked. They are not exported or observed on checkout path.

Status: proposed. Resolved: false. Blocks next change: false.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed direction rule: core dependencies should not form recursive cycles; configured checker already reports them, but design does not establish an approved no-cycle policy.
Consequence: Boundary command fails; latent invocation can overflow. No observed checkout failure attributed to this cycle.
Fix: Review intended use, then select removal of unused modules or one directional implementation. Until selected, retain visible debt; do not suppress cycle checking globally.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Selected cleanup must pass native boundaries and types without altering checkout/public price contract; no-cycle policy requires a valid control and deliberately seeded cycle proof.
Sources: cycle, execution, public


## Missing protections

### F-004: Maintained npm run check enforces types alone; separately runnable journey and boundaries fail while units pass.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs, journey.mjs. Command: npm run check.
Principle (proposed new principle): Proposed completion rule: approved affected journeys and boundaries pass on final inputs.
Consequence: Common check entry point can give a false readiness signal.
Fix: After selected fixes or explicitly accepted narrow debt, extend existing check with fail-fast type, boundary, unit and journey commands. Add a short evidence-completion section to existing DESIGN.md linking acceptance and checks, preserving its approved lines. Avoid a competing checker or unselected CI.
Scope: package.json, DESIGN.md
Verification: Prove maintained command passes clean controls and fails seeded boundary/alias/cycle and checkout violations with expected diagnostics. Existing failures stay visible; no blanket suppression or baseline refresh to absorb new debt.
Sources: commands, execution, gate-risk, design


## Design decisions

### F-005: Order names both a purchase and UI panel sequence.

Status: proposed. Resolved: false. Blocks next change: false.
Files: glossary.md. Command: none.
Principle (proposed new principle): Proposed vocabulary clarity: one canonical meaning per concept/context.
Consequence: Public contract naming and ownership proposals can encode incompatible meanings.
Fix: Draft only: retain Order for customer purchase; use Panel sequence for display ordering. Trade-off: clearer distinction changes existing terminology. Author decision required before glossary edits or naming migration.
Scope: glossary.md
Verification: Review draft meanings against both existing definitions; no code renaming or glossary update until explicitly selected.
Sources: glossary, routes

### F-006: No approved policy settles upstream pricing disagreement, malformed/unavailable service responses, quantity edges/discounts, or ownership of module-local order state.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, packages/core/internal/database.ts, packages/web/routes.ts. Command: none.
Principle: Approved design remains baseline; new behaviour and acceptance cases need an explicit decision.
Consequence: A speculative validation, discount or persistence rewrite could change checkout beyond approved scope.
Fix: Keep dependent pricing/error/quantity/state recommendations blocked. Recommend core owns price-service interpretation and storage-related behaviour, web calls a public operation; author must decide price disagreement, error outcome and whether order state is storage. Add only approved public-boundary cases; no invented status codes or discounts.
Scope: DESIGN.md, packages/core/index.ts, packages/core/internal/database.ts, packages/web/routes.ts, packages/web/ui.ts
Verification: After decisions, the fewest real HTTP/public-boundary checks covering approved success and failure outcomes. No real external endpoint is configured; loopback HTTP does not prove third-party live behaviour.
Sources: design, price, routes, ui

### F-007: Representative pricing and boundary changes share write paths and contracts; parallel editing is not independent.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/index.ts, unit.test.mjs, journey.mjs, package.json. Command: none.
Principle (proposed new principle): Proposed coordination rule: one writer per shared path and explicit shared contract ownership.
Consequence: Concurrent edits can disagree on public service pricing and checkout result despite disjoint adapter/caller paths.
Fix: Agree checkout-price and checkout-result contracts first. Assign one owner to core/index.ts, unit.test.mjs, journey.mjs and package.json. Sequence shared edits; private adapter and web callers may proceed in parallel only after contract decisions and selection. Plans are advisory proposals, not authorized work.
Scope: packages/core/index.ts, unit.test.mjs, journey.mjs, package.json, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts
Verification: Use retained overlap output and reviewed contract descriptions, then rerun affected native checks on integrated final inputs. Do not claim semantic independence or observed merge conflicts from overlap/history.
Sources: overlap, history, public, ui, routes


## Proposed new principles

- F-003: Proposed direction rule: core dependencies should not form recursive cycles; configured checker already reports them, but design does not establish an approved no-cycle policy. (proposed)
- F-004: Proposed completion rule: approved affected journeys and boundaries pass on final inputs. (proposed)
- F-005: Proposed vocabulary clarity: one canonical meaning per concept/context. (proposed)
- F-007: Proposed coordination rule: one writer per shared path and explicit shared contract ownership. (proposed)

## Selected findings


## Limitations

- No changes selected or applied. All findings unresolved; terminology remains draft.
- Native check results captured in check-results.json; these are not attached as validated findings execution evidence because the check-plan fingerprint is not the findings fingerprint. Rendered readiness remains blocked, never passing.
- Typecheck proves typing, not public-interface conformance. Unit pass does not establish agreed total; real HTTP journey failed.
- Only initial commit exists: measured HEAD..HEAD, no historical change-frequency or co-change evidence.
- No broader approved vision available. Scoped design/acceptance is sufficient for this audit; no speculative vision creation or board approval.
- Service price policy, error/quantity acceptance and order-state boundary interpretation remain decision blockers.
- Loopback HTTP exercised; no external live service endpoint configured or probed.
- Static checker covers resolved top-level imports/exports and cycles; dynamic imports/runtime imports not analyzed.
- No formatter/linter/CI configured; no generic tooling addition recommended. CLAUDE stub remains unchanged; consolidation not proposed.
