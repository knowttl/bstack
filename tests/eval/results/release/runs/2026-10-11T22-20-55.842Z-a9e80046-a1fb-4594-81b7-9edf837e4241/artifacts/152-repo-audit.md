# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Finish the existing-repo final checkpoint, then support a user edit/re-audit and representative extension from maintained guidance.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: 682801d166a22b176bacb8ecbd971b0cc4dc23b529358575c630d1749ccf4907

## Readiness evidence

- Missing required outcome: native-boundary-proof.
- Missing required outcome: maintained-enforcement-proof.
- Missing required outcome: maintenance-contract.
- Missing required outcome: standalone-clean-clone.
- Outcome starting-checks is failed.
- Outcome journey is failed.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- starting-checks: failed. Method: Unchanged before-state run-checks captures: types/unit exit0; journey/boundaries exit1. Attached exact-byte aggregate, not a passing journey.. Artifact: [isolated-home][scratch-path] Fingerprint: 682801d166a22b176bacb8ecbd971b0cc4dc23b529358575c630d1749ccf4907.
- journey: failed. Method: run-checks --phase before; journey actual child exit=1; captured check-plan inputs are distinct from this findings fingerprint. Artifact: [isolated-home]/cache/bstack/b3f6793488b9eeb2faa73c3d1a4f8485582f6926121327928e8c0ecde2890b32/b5498d6d-6956-499c-86a0-8f3650395f88/checks.json. Fingerprint: 682801d166a22b176bacb8ecbd971b0cc4dc23b529358575c630d1749ccf4907.

## Documented intent

- design: UI never touches storage; checkout total10 at line4. (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order defined twice: purchase and UI panel sequence. (glossary.md:3)

## Observed behaviour

- checks: Aggregate check currently runs types only; separate journey and boundaries exist. (package.json:12)
- journey: HTTP service gives12, checkout must return201,total10; actual native run fails with12. (journey.mjs:6)
- graph: Native graph run exits1 with alias,cycle,private. (boundaries.mjs:19)
- public: Existing public core index import example; current quote12 is observed unit expectation, not approved checkout acceptance. (packages/web/public.ts:1)

## Inferred intent

- proposal: Keeping pricing and order storage behind core is a proposed responsibility allocation derived from no-UI-storage constraint. (DESIGN.md:3)

## Observed debt

### F-001: Real HTTP checkout returns12, violating agreed total10.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, journey.mjs. Command: npm run journey.
Principle: Honor the approved checkout total10.
Consequence: Unit mock success conceals the failing actual fetch journey.
Fix: Correct pricing in core after owner chooses how upstream12 maps to total10. Preserve journey service12 and expected10; do not weaken the acceptance case.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, journey.mjs
Verification: Original failing reproduction, unchanged real HTTP journey passes with total10; surrounding public quote remains covered.
Sources: design, journey

### F-002: UI imports storage directly and through alias; routes owns mutable order storage.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md. Command: npm run boundaries.
Principle: UI never touches storage; consumers use public core interface.
Consequence: Storage details leak into UI and obstruct a representative extension through public guidance.
Fix: Route UI and alias consumers through core index; place order persistence behind core. Add a representative approved public-interface example in DESIGN.md, preserving current exported web functions.
Scope: packages/core/index.ts, packages/core/internal/database.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Capture original-state public compatibility; clean public imports pass, separate private and alias seeds fail native rule-proof; sibling core internal use remains permitted.
Sources: design, instructions, public, proposal

### F-003: Core a and b form a recursive cycle flagged by the native checker.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed adoption of the existing checker's acyclic graph rule.
Consequence: Calling either function recurses without terminating; aggregate check currently misses it.
Fix: Select acyclic enforcement and remove this unused cycle while preserving exported function names, with reviewed terminating behavior.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Native clean boundary check and independent cycle violation proof; owner review of new terminating behavior.
Sources: graph


## Missing protections

### F-005: Maintained check omits journey/boundaries; no change evidence contract, portable checker or assessed audit record exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, AGENTS.md, DESIGN.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md. Command: npm run check.
Principle (proposed new principle): Proposed final-input journey evidence and maintained authoritative-source impact review.
Consequence: Green types/unit checks do not prevent agreed journey failures or guide later maintenance.
Fix: Extend existing check with fail-fast native types, tests, boundaries and journey; add evidence completion/maintenance guidance to DESIGN.md and pointers to AGENTS.md; create selected repo-owned contract, standalone checker and assessed audit record through protected apply. Retain CLAUDE.md import stub.
Scope: package.json, AGENTS.md, DESIGN.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Native rule proofs and aggregate enforcement proof; final run-checks, assessed evidence validation, fresh standalone checker locally and different-root clean clone with isolated home/cache and explicit base.
Sources: design, checks, instructions


## Design decisions

### F-004: Order has incompatible definitions.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One resolved meaning per canonical domain term.
Consequence: Future extension cannot rely unambiguously on repo language.
Fix: Recommend Order for customer purchase and Panel sequence for UI presentation ordering; preserve glossary.md name.
Scope: glossary.md
Verification: Owner chooses terms, then reviewed exact glossary diff and contract coverage.
Sources: terms


## Proposed new principles

- F-003: Proposed adoption of the existing checker's acyclic graph rule. (proposed)
- F-004: One resolved meaning per canonical domain term. (proposed)
- F-005: Proposed final-input journey evidence and maintained authoritative-source impact review. (proposed)

## Selected findings


## Limitations

- Pending selection and exact-byte approval; no project writes performed.
- Checkout policy for upstream12 and glossary meaning need owner decisions.
- Only one Git commit; base=head measurement gives sizes but no history trend or co-change evidence.
- Native static boundary checker does not prove dynamic imports or all transitive facade bypasses.
- Local HTTP fixture is real transport evidence, not external production service proof.
- Portable assessed implementation/assessment commits and clone verification are later selected operations; not yet executed.
