# Historical starting-state snapshot

Observed revision: `b6c59b7810f5155fd514c9db60e98b7dffce0cc0`, with the uncommitted DESIGN.md user note present on 2026-10-11. This records the starting audit and selected proposal before protected implementation. It is not a current readiness authority. Final current-head findings and fresh checker results stay in scratch.

# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Maintain approved checkout and public core boundary, then re-audit a user edit and implement a representative extension using only repo guidance and checks.
Reviewed scope: DESIGN.md, journey.mjs, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs, AGENTS.md, package.json, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, glossary.md
Current fingerprint: b3ae60ebe00a276e3ae533153f0eaebde06b82a5ef6cb0aad861673e323ad350

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
- Unresolved finding: F-006.
- starting-checks: failed. Method: run-checks. Artifact: ./12370da1-checks.json. Fingerprint: b3ae60ebe00a276e3ae533153f0eaebde06b82a5ef6cb0aad861673e323ad350.
- journey: failed. Method: run-checks. Artifact: ./12370da1-checks.json. Fingerprint: b3ae60ebe00a276e3ae533153f0eaebde06b82a5ef6cb0aad861673e323ad350.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order names both customer purchase and UI panel sequence. (glossary.md:3-4)
- future: Require maintained contract, portable assessed evidence, standalone checker, native proof, and different-root isolated clean clone. (user request: final checkpoint and later extension)
- verdict: Endpoint fixture supplies 10; quote remains 12; public core imports, no cycles, aggregate/native proofs, Order/Panel order, contract/checker/assessment, historical audit and isolated clone selected. Receipt wording is a future owner decision. (supervisor user verdict, 2026-10-11; DESIGN.md:6)

## Observed behaviour

- native: Maintained check is type-only; separate native boundary command detects private imports, aliases and cycles. (package.json:12-16; boundaries.mjs:19-30)
- journey: Local HTTP journey returns 12 instead of 10; mocked checkout passes when fetch returns 10. (journey.mjs:6-12; unit.test.mjs:5-8; packages/web/ui.ts:1-4)
- cycle: Unused mutually recursive exported functions form a native cycle violation. (packages/core/a.ts:1-2; packages/core/b.ts:1-2)

## Inferred intent


## Observed debt

### F-001: Controlled HTTP endpoint fixture supplies 12 instead of the agreed 10.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/core/internal/database.ts, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: Preserve DESIGN.md agreed checkout total 10.
Consequence: Passing mocked units can conceal a broken agreed journey.
Fix: Correct journey endpoint fixture to supply 10; retain assertion 10 and current quote behavior 12. No business discount introduced.
Scope: journey.mjs
Verification: Fresh failing original-state capture, then passing corrected local HTTP journey against unchanged assertion 10.
Sources: design, journey, verdict

### F-002: Web imports storage internals directly and through @storage alias.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI never touches storage; use approved public core interface.
Consequence: Web bypasses the package boundary and exposes storage details to future extensions.
Fix: Expose needed service/pricing capability through packages/core/index.ts and update web imports to that public interface. Keep packages/web/public.ts as representative example and document it in DESIGN.md.
Scope: DESIGN.md, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts
Verification: Native valid public-import control plus direct private, alias and re-export violation proofs; sibling core internal use remains allowed.
Sources: design, instructions, native, verdict

### F-003: Core a and b recurse through each other and fail existing native cycle rule.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Existing native checker rejects cycles (not yet documented as approved design).
Consequence: Native boundaries cannot pass; calling either exported function does not terminate.
Fix: Retain a.ts/b.ts and their exports; a() delegates to b(), and b() returns price() instead of recursing to a().
Scope: DESIGN.md, packages/core/a.ts, packages/core/b.ts, unit.test.mjs
Verification: Native valid dependency direction and seeded cycle proof, TypeScript check; selected public behavior check.
Sources: cycle, native, verdict

### F-005: Glossary assigns Order two different meanings.

Status: selected. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One canonical name per resolved domain concept.
Consequence: A later representative extension cannot confidently interpret Order.
Fix: Recommend Order = customer purchase and Panel order = sequence in which UI panels appear, using the existing glossary.md. No code naming migration.
Scope: glossary.md
Verification: Owner confirms distinction; reviewed exact glossary delta and maintained document assessment.
Sources: terms, verdict


## Missing protections

### F-004: Aggregate check omits journey/boundaries; no maintained acceptance/impact contract or standalone checker exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: package.json, AGENTS.md, DESIGN.md. Command: none.
Principle (proposed new principle): Checks must establish approved journeys on final inputs and maintain the selected repo guidance.
Consequence: Later edits can pass types while violating checkout intent; audit evidence cannot be independently rechecked.
Fix: Extend the existing check command with fail-fast type, unit, native boundary and journey checks. Document evidence, review, exception policy, coverage limits and the representative public-interface example in DESIGN.md; AGENTS.md points to maintained guidance.
Scope: package.json, AGENTS.md, DESIGN.md
Verification: Native and integrated valid/violation proof; contract/docs/evidence validation; fresh standalone checker locally and in different-root clean clone with isolated home/cache. No CI added.
Sources: design, native, future, verdict

### F-006: No maintained contract, standalone checker or portable final assessment exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: AGENTS.md, DESIGN.md, package.json. Command: none.
Principle (proposed new principle): Selected maintenance must assess every changed path and execute approved native checks freshly without the skill.
Consequence: Future edits cannot be independently checked against the approved repo guidance.
Fix: Install the complete dependency-free checker and project contract; retain a separately reviewed historical audit snapshot and portable assessment. Validate current final findings in scratch and invoke the checker locally and in a different-root clean clone with isolated home/cache.
Scope: .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, AGENTS.md, DESIGN.md
Verification: Contract/docs/evidence validation and fresh standalone checker executions against the same committed implementation, assessment and explicit base; historical snapshot is not rewritten after each invocation.
Sources: future, verdict


## Design decisions


## Proposed new principles

- F-003: Existing native checker rejects cycles (not yet documented as approved design). (selected)
- F-004: Checks must establish approved journeys on final inputs and maintain the selected repo guidance. (selected)
- F-005: One canonical name per resolved domain concept. (selected)
- F-006: Selected maintenance must assess every changed path and execute approved native checks freshly without the skill. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Baseline native journey and boundaries fail; readiness is blocked.
- Only one initial commit exists; measured co-change is not useful evidence of historical coupling.
- Declared correction and foundation plans share the checkout contract despite disjoint write paths.
- No external production service is configured; journey observes a local loopback server, not a deployed price service.
- Static boundary checker does not cover dynamic imports or runtime dependency loading.
- No CI selected or hosted enforcement observed.
- CLAUDE.md import stub retained; no instruction consolidation proposed.
- Research ran in main thread because the small fixture made delegation wasteful.
- Full final checkpoint remains incomplete until approvals, protected apply and all final evidence pass.
- Supervisor selections resolve fixture pricing, cycle correction, vocabulary and historical snapshot policy. Exact bytes remain unapproved; receipt wording is excluded from this scope.

Supervisor fixture approval, 2026-10-11: Correct the controlled journey endpoint fixture to supply 10, preserve the assertion at 10 and current quote behaviour at 12, and invent no business discount.
