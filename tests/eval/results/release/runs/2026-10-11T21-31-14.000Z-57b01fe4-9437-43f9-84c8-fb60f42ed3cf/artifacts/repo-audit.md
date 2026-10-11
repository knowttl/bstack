# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Review foundation recommendations for the existing checkout journey before selecting any changes.
Reviewed scope: AGENTS.md, CLAUDE.md, DESIGN.md, glossary.md, package.json, package-lock.json, tsconfig.json, boundaries.mjs, unit.test.mjs, journey.mjs, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: 3751c8e001ce1918c0eba8c504b8405996bf6709fafac1b96c2636a20bddc454

## Readiness evidence

- Missing required outcome: foundation-review.
- Outcome starting-checks is failed.
- Outcome journey is failed.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- starting-checks: failed. Method: Captured run-checks run 3364ba82-90fc-4526-a7ff-e8f32ddc436c; manually bound to findings fingerprint after matching source bytes. Check-plan fingerprint is distinct; this is execution evidence, not independent semantic approval.. Artifact: [isolated-home]/cache/bstack/1ee45e698057256c754c6d9dfb6dc434c4026a2d1f1b2f6a92735de25f5b6ec2/3364ba82-90fc-4526-a7ff-e8f32ddc436c/checks.json. Fingerprint: 3751c8e001ce1918c0eba8c504b8405996bf6709fafac1b96c2636a20bddc454.
- journey: failed. Method: Captured run-checks run 3364ba82-90fc-4526-a7ff-e8f32ddc436c; manually bound to findings fingerprint after matching source bytes. Check-plan fingerprint is distinct; this is execution evidence, not independent semantic approval.. Artifact: [isolated-home]/cache/bstack/1ee45e698057256c754c6d9dfb6dc434c4026a2d1f1b2f6a92735de25f5b6ec2/3364ba82-90fc-4526-a7ff-e8f32ddc436c/checks.json. Fingerprint: 3751c8e001ce1918c0eba8c504b8405996bf6709fafac1b96c2636a20bddc454.

## Documented intent

- S-design: Approved storage boundary and total 10 at line 4. (DESIGN.md:3)
- S-agent: Use approved design and public core interface. (AGENTS.md:1)
- S-glossary: Order has two incompatible definitions at lines 3-4. (glossary.md:3)

## Observed behaviour

- S-impl: Checkout imports private storage and routes; routes.ts:1 imports private storage and routes.ts:4 computes quantity discount. alias.ts:1 bypasses via @storage. (packages/web/ui.ts:1)
- S-core: Public core exports price; private database.ts:1 returns 12 and lines 2-3 fetch service response. (packages/core/index.ts:1)
- S-checks: check runs tsc alone. test, journey and boundaries are separate commands; captured run 3364ba82-90fc-4526-a7ff-e8f32ddc436c passes check/test and fails boundaries/journey. (package.json:12)
- S-journey: Loopback HTTP service responds 12; unchanged approved assertion at line 12 expects total 10 and fails with actual 12. (journey.mjs:6)
- S-unit: Quote expects 12; checkout mock supplies 10. Both pass without protecting actual HTTP checkout agreement. (unit.test.mjs:5)
- S-cycle: a imports b and b.ts:1 imports a; both invoke each other. Native boundaries emits cycle. Neither is called by audited checkout. (packages/core/a.ts:1)
- S-boundary: TypeScript module resolution flags private storage imports from web and detects cycles across program files. (boundaries.mjs:19)

## Inferred intent

- S-ownership: Routes currently own order state and pricing calculation; a public pricing policy interface is a candidate boundary, not an approved new contract. (packages/web/routes.ts:2)

## Observed debt

### F-002: Web imports private storage directly and through an alias.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts. Command: npm run boundaries.
Principle: UI never touches storage and callers use public core.
Consequence: Storage representation changes force UI edits and bypass the approved boundary.
Fix: Route every web storage dependency through packages/core/index.ts; price already exists publicly. Review the smallest needed service/pricing export, preserving pricing behaviour until F-001 is resolved. Do not remove alias configuration globally merely to hide violations.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts
Verification: Existing TypeScript-based boundaries must pass after selected repair; rule-proof separate clean public import, direct private and alias violations, with sibling core private access valid. Checkout before/after evidence required. Dynamic imports remain unsupported.
Sources: S-agent, S-design, S-impl, S-core, S-boundary

### F-004: Core a/b form a mutually recursive dependency; boundaries reports cycle.

Status: proposed. Resolved: false. Blocks next change: false.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed no-cycle constraint aligns with the existing checker; approved design does not explicitly ban every core cycle.
Consequence: Calling either recurses without a base case; blocks current full boundary check but no checkout failure is attributed to it.
Fix: Review intended public use before choosing a compatible removal or rewrite; alternatively select explicit narrow temporary debt with reason and removal condition. Do not infer safe deletion from absence in checkout.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Type check and cycle-free valid control versus seeded cycle fail; verify any approved public contract before removal. Current history has only the initial commit.
Sources: S-cycle, S-boundary


## Missing protections

### F-003: Maintained check omits the journey and boundary checks that currently fail. No document defines completion evidence.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, unit.test.mjs, DESIGN.md. Command: npm run check.
Principle (proposed new principle): Proposed completion rule: final affected journeys and approved boundaries pass; unit success alone is insufficient.
Consequence: The default check can report green with broken acceptance and forbidden dependencies.
Fix: After selected debt repair, extend existing check with fail-fast type, boundary, unit and journey commands. Add a short completion-evidence section to DESIGN.md linking its existing acceptance and journey check, preserving its approved lines. No extra runner, formatter, lint framework or CI is proposed.
Scope: package.json, DESIGN.md
Verification: Prove integrated command on clean and separately seeded private, alias, cycle and checkout violations; final native checks pass. Existing debt remains visible with narrow reason/removal condition if owner selects deferral.
Sources: S-checks, S-journey, S-unit, S-boundary


## Design decisions

### F-001: Checkout produces total 12 despite approved total 10. Pricing responsibility for an HTTP response of 12 is unspecified.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, journey.mjs, packages/web/routes.ts. Command: npm run journey.
Principle: Preserve the approved total 10; do not change acceptance to fit the implementation.
Consequence: Unit success masks a broken checkout outcome.
Fix: Blocked policy recommendation: let core own checkout pricing via its public interface; resolve how service 12 becomes agreed 10 before defining implementation bytes. Keep existing HTTP response and acceptance assertion intact. Rejection alone cannot satisfy the existing successful checkout case.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, unit.test.mjs, journey.mjs
Verification: Before/after captured unchanged local HTTP journey must produce {status:201,total:10}; keep quote compatibility separate from checkout acceptance. No requirement says all quoted prices must become 10.
Sources: S-design, S-journey, S-core, S-unit

### F-005: Order names both purchase and UI panel sequence.

Status: proposed. Resolved: false. Blocks next change: false.
Files: glossary.md. Command: none.
Principle (proposed new principle): Proposed domain vocabulary distinguishes customer purchase from presentation sequence.
Consequence: Future checkout naming could mix unrelated responsibilities.
Fix: Retain scratch draft: Order = customer purchase; Panel sequence = sequence in which UI panels appear. Await meaning confirmation and separate selection before any glossary change or code rename.
Scope: glossary.md
Verification: Owner reviews both source definitions and exact draft; no runtime tests or naming migration until selected.
Sources: S-glossary


## Proposed new principles

- F-003: Proposed completion rule: final affected journeys and approved boundaries pass; unit success alone is insufficient. (proposed)
- F-004: Proposed no-cycle constraint aligns with the existing checker; approved design does not explicitly ban every core cycle. (proposed)
- F-005: Proposed domain vocabulary distinguishes customer purchase from presentation sequence. (proposed)

## Selected findings


## Limitations

- No changes selected or applied. Pricing and terminology questions are pending; dependent work remains blocked.
- Actual run-checks artifact is retained and manually bound to the returned findings fingerprint after verifying matching repo source hashes. Binding validation does not establish semantic review; native boundaries and journey failed. No readiness pass is claimed.
- History is one initial commit b6c59b7: measured co-change provides no recurring-change or observed-conflict evidence. Default lockfile exclusions used; no formatting exclusions or renames.
- No external service is configured or probed. Loopback HTTP journey is executable interface evidence, not production service verification.
- Quantity limits, discount threshold, malformed prices and HTTP failure outcomes are undocumented; preserve current behaviour and require acceptance decisions before tests or changes.
- No separate vision, requirements, prior audit, formatter, linter or CI was found. Approved DESIGN.md stays the authority; absence is not itself debt.
- CLAUDE.md is an AGENTS import stub; preserved. No removal proposed and host loading compatibility has not been checked.
- Read-only research ran in main thread because repository is small; no subagents spawned.
- TypeScript paths does not establish Node runtime alias resolution; aliasQuote runtime is unverified.
