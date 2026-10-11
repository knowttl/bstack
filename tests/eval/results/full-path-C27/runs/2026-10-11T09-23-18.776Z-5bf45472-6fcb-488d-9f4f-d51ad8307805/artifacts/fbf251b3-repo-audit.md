# Proposed repo audit record

Result: ready for the stated next change

Stage: audit
Target: [fixture]
Revision: d75c5868a5c4d78e75bc70d157245a8cde4fd485
Stated next change: Maintain approved checkout and public core boundary, then re-audit a user edit and implement a representative extension using only repo guidance and checks.
Reviewed scope: DESIGN.md, journey.mjs, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, unit.test.mjs, AGENTS.md, package.json, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md, glossary.md
Current fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1

## Readiness evidence

- starting-checks: passed. Method: run-checks. Artifact: ./f1654f6b-checks.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- journey: passed. Method: run-checks. Artifact: ./f1654f6b-checks.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- native-boundary-proof: passed. Method: manifest of captured rule-proof results. Artifact: ./578c3a9e-final-native-proof-manifest.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- maintained-enforcement: passed. Method: rule-proof. Artifact: ./a37d4623-proof.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- foundation-review: passed. Method: owner-approved exact plans and main-thread semantic review. Artifact: ./65a2d0f1-final-foundation-review.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- maintenance-contract: passed. Method: evidence validate with fresh final run-checks capture. Artifact: ./e3314109-final-local-assessment-validation.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- standalone-clean-clone: passed. Method: fresh complete standalone checker in isolated different-root clean clone. Artifact: ./653eba83-checker-result.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- standalone-working-checkout: passed. Method: fresh complete standalone checker in committed working checkout. Artifact: ./024cc4a3-checker-result.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- quote: passed. Method: run-checks. Artifact: ./f1654f6b-checks.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.
- seeded-journey-rejection: passed. Method: rule-proof against unchanged assertion 10 and reseeded endpoint 12. Artifact: ./8f78b5f1-proof.json. Fingerprint: 25642ec9134e8aa262bc337e580a3a8f898921739c8eba315417a55296f377d1.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- terms: Order names a purchase; Panel order names the sequence of UI panels. (glossary.md:3-4)
- future: Require maintained contract, portable assessed evidence, standalone checker, native proof, and different-root isolated clean clone. (user request: final checkpoint and later extension)
- verdict: Endpoint fixture supplies 10; quote remains 12; public core imports, no cycles, aggregate/native proofs, Order/Panel order, contract/checker/assessment, historical audit and isolated clone selected. Receipt wording is a future owner decision. (supervisor user verdict, 2026-10-11; DESIGN.md:6)

## Observed behaviour

- native: Maintained check now runs types, units, boundary analysis and real local HTTP journey; fresh final executions pass. (package.json:13-18; boundaries.mjs:19-30)
- journey: Controlled endpoint supplies 10; real public UI checkout returns total 10. Quote stays 12. Reseeded endpoint 12 still fails the unchanged assertion. (journey.mjs:6-12; unit.test.mjs:5-8; packages/web/ui.ts:1-4)
- cycle: a delegates to b; b returns price through permitted core-owned storage use. Native cycle check passes. (packages/core/a.ts:1-2; packages/core/b.ts:1-2)

## Inferred intent


## Observed debt

### F-001: Controlled HTTP endpoint fixture supplies 12 instead of the agreed 10.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/core/internal/database.ts, journey.mjs, unit.test.mjs. Command: npm run journey.
Principle: Preserve DESIGN.md agreed checkout total 10.
Consequence: Passing mocked units can conceal a broken agreed journey.
Fix: Correct journey endpoint fixture to supply 10; retain assertion 10 and current quote behavior 12. No business discount introduced.
Scope: journey.mjs
Verification: Fresh failing original-state capture, then passing corrected local HTTP journey against unchanged assertion 10.
Sources: design, journey, verdict

### F-002: Web imports storage internals directly and through @storage alias.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: UI never touches storage; use approved public core interface.
Consequence: Web bypasses the package boundary and exposes storage details to future extensions.
Fix: Expose needed service/pricing capability through packages/core/index.ts and update web imports to that public interface. Keep packages/web/public.ts as representative example and document it in DESIGN.md.
Scope: DESIGN.md, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts
Verification: Native valid public-import control plus direct private, alias and re-export violation proofs; sibling core internal use remains allowed.
Sources: design, instructions, native, verdict

### F-003: Core a and b recurse through each other and fail existing native cycle rule.

Status: selected. Resolved: true. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Existing native checker rejects cycles (not yet documented as approved design).
Consequence: Native boundaries cannot pass; calling either exported function does not terminate.
Fix: Retain a.ts/b.ts and their exports; a() delegates to b(), and b() returns price() instead of recursing to a().
Scope: DESIGN.md, packages/core/a.ts, packages/core/b.ts, unit.test.mjs
Verification: Native valid dependency direction and seeded cycle proof, TypeScript check; selected public behavior check.
Sources: cycle, native, verdict

### F-005: Glossary assigns Order two different meanings.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md. Command: none.
Principle (proposed new principle): One canonical name per resolved domain concept.
Consequence: A later representative extension cannot confidently interpret Order.
Fix: Recommend Order = customer purchase and Panel order = sequence in which UI panels appear, using the existing glossary.md. No code naming migration.
Scope: glossary.md
Verification: Owner confirms distinction; reviewed exact glossary delta and maintained document assessment.
Sources: terms, verdict


## Missing protections

### F-004: Aggregate check omits journey/boundaries; no maintained acceptance/impact contract or standalone checker exists.

Status: selected. Resolved: true. Blocks next change: true.
Files: package.json, AGENTS.md, DESIGN.md. Command: none.
Principle (proposed new principle): Checks must establish approved journeys on final inputs and maintain the selected repo guidance.
Consequence: Later edits can pass types while violating checkout intent; audit evidence cannot be independently rechecked.
Fix: Extend the existing check command with fail-fast type, unit, native boundary and journey checks. Document evidence, review, exception policy, coverage limits and the representative public-interface example in DESIGN.md; AGENTS.md points to maintained guidance.
Scope: package.json, AGENTS.md, DESIGN.md
Verification: Native and integrated valid/violation proof; contract/docs/evidence validation; fresh standalone checker locally and in different-root clean clone with isolated home/cache. No CI added.
Sources: design, native, future, verdict

### F-006: No maintained contract, standalone checker or portable final assessment exists.

Status: selected. Resolved: true. Blocks next change: true.
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

- Ready for the stated next change based on the assessed committed state, not for unrequested product journeys.
- Only default-quantity local HTTP checkout and existing public quote behavior were exercised; no deployed price service observed.
- Native boundary analysis covers static imports/re-exports, aliases and cycles; dynamic imports/runtime loading require review. Restriction to the named public core entry is also a review requirement.
- Receipt wording remains a future owner decision; dependent receipt changes need that decision.
- No hosted CI or delivery service selected or verified.
- History has one original fixture commit; measurements and declared overlap remain advisory, not semantic coupling or conflict proof.
- Current findings bind artifact hashes and final target fingerprint; findings validation checks record structure/freshness, while actual child executions and semantic review are separate evidence.
- Historical snapshot is unchanged; final assessed findings and results stay in scratch.
