# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Maintain approved checkout and public core boundary, then re-audit a user edit and implement a representative extension using only repo guidance and checks.
Reviewed scope: DESIGN.md, journey.mjs, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs, AGENTS.md, package.json, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, glossary.md
Current fingerprint: f234e49edba74e5ac7d41890aff312347e486da1de4e0389d576950d0eee22f8

## Readiness evidence

- Missing required outcome: native-boundary-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: foundation-review.
- Missing required outcome: maintenance-contract.
- Missing required outcome: standalone-clean-clone.
- Outcome starting-checks is failed.
- Outcome journey is failed.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- starting-checks: failed. Method: run-checks. Artifact: ./319100aa-checks.json. Fingerprint: f234e49edba74e5ac7d41890aff312347e486da1de4e0389d576950d0eee22f8.
- journey: failed. Method: run-checks. Artifact: ./319100aa-checks.json. Fingerprint: f234e49edba74e5ac7d41890aff312347e486da1de4e0389d576950d0eee22f8.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order names both customer purchase and UI panel sequence. (glossary.md:3-4)
- future: Require maintained contract, portable assessed evidence, standalone checker, native proof, and different-root isolated clean clone. (user request: final checkpoint and later extension)

## Observed behaviour

- native: Maintained check is type-only; separate native boundary command detects private imports, aliases and cycles. (package.json:12-16; boundaries.mjs:19-30)
- journey: Local HTTP journey returns 12 instead of 10; mocked checkout passes when fetch returns 10. (journey.mjs:6-12; unit.test.mjs:5-8; packages/web/ui.ts:1-4)
- cycle: Unused mutually recursive exported functions form a native cycle violation. (packages/core/a.ts:1-2; packages/core/b.ts:1-2)

## Inferred intent


## Observed debt

### F-002: Web imports storage internals directly and through @storage alias.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI never touches storage; use approved public core interface.
Consequence: Web bypasses the package boundary and exposes storage details to future extensions.
Fix: Expose needed service/pricing capability through packages/core/index.ts and update web imports to that public interface. Keep packages/web/public.ts as representative example and document it in DESIGN.md.
Scope: DESIGN.md, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts
Verification: Native valid public-import control plus direct private, alias and re-export violation proofs; sibling core internal use remains allowed.
Sources: design, instructions, native


## Missing protections

### F-004: Aggregate check omits journey/boundaries; no maintained acceptance/impact contract or standalone checker exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, AGENTS.md, DESIGN.md. Command: none.
Principle (proposed new principle): Checks must establish approved journeys on final inputs and maintain the selected repo guidance.
Consequence: Later edits can pass types while violating checkout intent; audit evidence cannot be independently rechecked.
Fix: Extend npm run check with fail-fast native types, units, boundaries and journey. Add a short DESIGN.md completion/review section and AGENTS.md pointers. Install selected .bstack/project.json and complete dependency-free checker from the installed package through protected apply; retain final assessed record and portable assessment.
Scope: AGENTS.md, DESIGN.md, package.json, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Native and integrated valid/violation proof; contract/docs/evidence validation; fresh standalone checker locally and in different-root clean clone with isolated home/cache. No CI added.
Sources: design, native, future


## Design decisions

### F-001: Real local HTTP checkout returns 12; approved acceptance requires 10. Pricing adjustment is undocumented.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/core/internal/database.ts, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: Preserve DESIGN.md agreed checkout total 10.
Consequence: Passing mocked units can conceal a broken agreed journey.
Fix: Choose a pricing rule before implementation. Recommend checkout unit price 10 owned by core, while quote() stays 12; retain existing quantity/discount behavior. Preserve journey server response 12 and expected total 10.
Scope: DESIGN.md, journey.mjs, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs
Verification: Captured failing reproduction before, passing unchanged journey after, public-interface checks for quote and agreed checkout pricing.
Sources: design, journey

### F-003: Core a and b recurse through each other and fail existing native cycle rule.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle: Existing native checker rejects cycles (not yet documented as approved design).
Consequence: Native boundaries cannot pass; calling either exported function does not terminate.
Fix: Select cycle correction: retain file names and a()/b() exports, make b() return public core price and a() delegate to b(). This assigns a previously unspecified result and needs selection. Alternatively retain as explicit unresolved debt.
Scope: DESIGN.md, packages/core/a.ts, packages/core/b.ts, unit.test.mjs
Verification: Native valid dependency direction and seeded cycle proof, TypeScript check; selected public behavior check.
Sources: cycle, native

### F-005: Glossary assigns Order two different meanings.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One canonical name per resolved domain concept.
Consequence: A later representative extension cannot confidently interpret Order.
Fix: Recommend Order = customer purchase and Panel order = sequence in which UI panels appear, using the existing glossary.md. No code naming migration.
Scope: glossary.md
Verification: Owner confirms distinction; reviewed exact glossary delta and maintained document assessment.
Sources: terms


## Proposed new principles

- F-004: Checks must establish approved journeys on final inputs and maintain the selected repo guidance. (proposed)
- F-005: One canonical name per resolved domain concept. (proposed)

## Selected findings


## Limitations

- Baseline native journey and boundaries fail; readiness is blocked.
- Pricing adjustment, cycle behavior and canonical vocabulary require owner selection.
- Only one initial commit exists; measured co-change is not useful evidence of historical coupling.
- Declared correction and foundation plans share the checkout contract despite disjoint write paths.
- No external production service is configured; journey observes a local loopback server, not a deployed price service.
- Static boundary checker does not cover dynamic imports or runtime dependency loading.
- No CI selected or hosted enforcement observed.
- CLAUDE.md import stub retained; no instruction consolidation proposed.
- Research ran in main thread because the small fixture made delegation wasteful.
- Full final checkpoint remains incomplete until approvals, protected apply and all final evidence pass.
