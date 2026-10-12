# Proposed repo audit record

Result: ready for the stated next change

Stage: audit
Target: [fixture]
Revision: 86960291f55562154efc46f9a9af061884a1c29b
Stated next change: Finish the existing-repo final checkpoint, then support a user edit/re-audit and representative extension from maintained guidance.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, .bstack/schemas/check-plan.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/project.schema.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df

## Readiness evidence

- starting-checks: passed. Method: Fresh complete standalone checker; native aggregate exit0, actual public checkout localHTTPtotal10 and quote12, current assessed-state result-validation passed.. Artifact: [isolated-home]/cache/bstack/b3f6793488b9eeb2faa73c3d1a4f8485582f6926121327928e8c0ecde2890b32/3174da4c-ccfc-4892-b879-fbe73b3be3d8/checker-result.json. Fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df.
- journey: passed. Method: Fresh complete standalone checker; native aggregate exit0, actual public checkout localHTTPtotal10 and quote12, current assessed-state result-validation passed.. Artifact: [isolated-home]/cache/bstack/b3f6793488b9eeb2faa73c3d1a4f8485582f6926121327928e8c0ecde2890b32/3174da4c-ccfc-4892-b879-fbe73b3be3d8/checker-result.json. Fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df.
- maintenance-contract: passed. Method: Fresh complete standalone checker; native aggregate exit0, actual public checkout localHTTPtotal10 and quote12, current assessed-state result-validation passed.. Artifact: [isolated-home]/cache/bstack/b3f6793488b9eeb2faa73c3d1a4f8485582f6926121327928e8c0ecde2890b32/3174da4c-ccfc-4892-b879-fbe73b3be3d8/checker-result.json. Fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df.
- standalone-clean-clone: passed. Method: Fresh full standalone checker in different-root clean clone of final target HEAD with isolated HOME/cache/TMPDIR, locked native dependencies, identical committed assessment and explicitbase; native leaf executed freshly and result-validation passed.. Artifact: [isolated-home][scratch-path] Fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df.
- native-boundary-proof: passed. Method: Independent rule-proof valid/public/sibling-core controls exit0, each seeded diagnostic exitsnonzero as expected. Seven controls captured after approved apply; exact declared native input bytes verified unchanged at final HEAD. Attached actual captures, not a check-plan fingerprint substitute.. Artifact: [isolated-home][scratch-path] Fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df.
- maintained-enforcement-proof: passed. Method: Independent rule-proof valid/public/sibling-core controls exit0, each seeded diagnostic exitsnonzero as expected. Seven controls captured after approved apply; exact declared native input bytes verified unchanged at final HEAD. Attached actual captures, not a check-plan fingerprint substitute.. Artifact: [isolated-home][scratch-path] Fingerprint: 683fba77b64d293a29c610b50d0909a9cb6cd92f50cee83ef7f09f33eca074df.

## Documented intent

- design: UI never touches storage; checkout total10 at line4. (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order defined twice: purchase and UI panel sequence. (glossary.md:3)
- selection: User note is preserved exactly; supervisor selected endpoint10/quote12, Panel order, public core, cycle enforcement, maintained foundation, historical snapshot semantics. Approval retained in scratch shop-selection.txt. (DESIGN.md:6)

## Observed behaviour

- checks: Starting aggregate ran types only; selected fail-fast aggregate now runs types, tests, boundaries and actual local HTTP journey. (package.json:12)
- journey: Starting-state local HTTP fixture supplied12 and checkout returned12 against expected10; selected endpoint correction now supplies10 while preserving assertion10. Fresh native journey passes. (journey.mjs:6)
- graph: Starting native graph failed alias/cycle/private. Selected correction now passes, with separate native and aggregate valid/violation controls for each diagnostic. (boundaries.mjs:19)
- public: Existing public core index import example; current quote12 is observed unit expectation, not approved checkout acceptance. (packages/web/public.ts:1)
- portable-final: Unchanged committed portable assessment covers 18 implementation paths, three authoritative documents and four maintained rules, with no unmapped paths. Final standalone checker executes native once freshly per checkout and passes locally and in the isolated different-root clean clone. (.bstack/assessment.json:1)

## Inferred intent

- proposal: Keeping pricing and order storage behind core is a proposed responsibility allocation derived from no-UI-storage constraint. (DESIGN.md:3)

## Observed debt

### F-001: Real HTTP checkout returns12, violating agreed total10.

Status: selected. Resolved: true. Blocks next change: true.
Files: journey.mjs. Command: npm run journey.
Principle: Honor the approved checkout total10.
Consequence: Unit mock success conceals the failing actual fetch journey.
Fix: Correct the controlled journey endpoint fixture to supply10, keep expected10 and public quote12, and invent no business discount.
Scope: journey.mjs
Verification: Original failing reproduction, unchanged real HTTP journey passes with total10; surrounding public quote remains covered.
Sources: design, journey, selection

### F-002: UI imports storage directly and through alias; routes owns mutable order storage.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md. Command: npm run boundaries.
Principle: UI never touches storage; consumers use public core interface.
Consequence: Storage details leak into UI and obstruct a representative extension through public guidance.
Fix: Route UI and alias consumers through core index; place order persistence behind core. Add a representative approved public-interface example in DESIGN.md, preserving current exported web functions.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Capture original-state public compatibility; clean public imports pass, separate private and alias seeds fail native rule-proof; sibling core internal use remains permitted.
Sources: design, instructions, public, proposal

### F-003: Core a and b form a recursive cycle flagged by the native checker.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed adoption of the existing checker's acyclic graph rule.
Consequence: Calling either function recurses without terminating; aggregate check currently misses it.
Fix: Select acyclic enforcement and remove this unused cycle while preserving exported function names, with reviewed terminating behavior.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Native clean boundary check and independent cycle violation proof; owner review of new terminating behavior.
Sources: graph


## Missing protections

### F-005: Maintained check currently runs types only and omits the failing native boundary and HTTP journey checks.

Status: selected. Resolved: true. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): Proposed final-input journey evidence and maintained authoritative-source impact review.
Consequence: Green types/unit checks do not prevent agreed journey failures or guide later maintenance.
Fix: Extend the existing check command with fail-fast types, tests, boundaries and real HTTP journey; prove native boundary rules independently and through that aggregate.
Scope: package.json, boundaries.mjs
Verification: Native valid/private/alias/cycle controls and maintained aggregate controls; final native capture on applied inputs.
Sources: design, checks, instructions

### F-006: No maintained source-impact contract, complete standalone assessment checker or portable review record exists.

Status: selected. Resolved: true. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, .bstack/schemas/check-plan.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/project.schema.json. Command: npm run check.
Principle (proposed new principle): Proposed final-input journey evidence and maintained authoritative-source impact review.
Consequence: Green types/unit checks do not prevent agreed journey failures or guide later maintenance.
Fix: Create selected first-contract foundation, install the complete dependency-free checker unchanged with maintenance schemas, add public-interface and maintenance guidance; retain a historical versioned audit snapshot and current-head readiness in scratch. Collect and review final portable assessment after implementation, then prove the unchanged record in an isolated different-root clone.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, .bstack/schemas/check-plan.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/project.schema.json
Verification: Contract/docs validation, complete assessed final change coverage, first-foundation protected record, fresh standalone checker locally and in a different-root clean clone with isolated home/cache and explicit base.
Sources: design, checks, instructions, selection


## Design decisions

### F-004: Order has incompatible definitions.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One resolved meaning per canonical domain term.
Consequence: Future extension cannot rely unambiguously on repo language.
Fix: Retain Order for purchases; rename the presentation concept to Panel order in existing glossary.md.
Scope: glossary.md
Verification: Owner chooses terms, then reviewed exact glossary diff and contract coverage.
Sources: terms, selection


## Proposed new principles

- F-003: Proposed adoption of the existing checker's acyclic graph rule. (selected)
- F-004: One resolved meaning per canonical domain term. (selected)
- F-005: Proposed final-input journey evidence and maintained authoritative-source impact review. (selected)
- F-006: Proposed final-input journey evidence and maintained authoritative-source impact review. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Native boundary checker resolves top-level static imports/exports, aliases and cycles; dynamic imports and arbitrary transitive facade leaks remain review limits.
- Native HTTP evidence uses the actual controlled loopback endpoint through public checkout; it does not establish a deployed external service outcome.
- No hosted CI or delivery service is selected or claimed.
- One starting commit offers no co-change trend.
- The original native journey failed with fixture12 and expected10; selected correction changed the controlled fixture to10 and retained assertion10 and quote12. Actual original and final outputs are retained; automatic prior-run pairing was rejected after authoritative source-byte additions, so no automatically paired proof is claimed.
- Historical docs/repo-audit.md remains its observed revision snapshot. Final readiness and results are maintained only in scratch.
- Portable review intentionally excludes its own assessment from the 18-path implementation inventory; its exact approved bytes and unchanged committed state were verified separately in both checkouts.
- Scripts establish structural coverage and fresh execution; main-thread review checks substantive claims against the approved sources and actual diff, and scripts do not authenticate author approval.
