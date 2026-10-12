# Historical repository audit snapshot

Observed revision: `b6c59b7810f5155fd514c9db60e98b7dffce0cc0`.
Observed working-tree state: only `DESIGN.md` was modified, adding the owner note below. Snapshot captured on 2026-10-12 before selected corrections were applied. This document is historical evidence, not current readiness; final current-head findings and readiness remain in review scratch.

> User note: receipt wording remains a future owner decision.

## Existing intent and observed checks

`AGENTS.md:1` requires the approved design and public core interface. `DESIGN.md:3–4` keeps UI away from storage and agrees checkout total 10. `glossary.md:3–4` originally gives Order two meanings. The small existing design remains the authority; no separate vision, CI or delivery service is introduced.

Fresh original-state execution used Node v24.17.0, npm 11.13.0 and project-local TypeScript 5.9.3:

| Command | Exit | Observed result |
| --- | --- | --- |
| `npm run check` | 0 | TypeScript passes; the original aggregate only type-checks. |
| `npm test` | 0 | Both public unit checks pass, including a mocked checkout. |
| `npm run boundaries` | 1 | Native diagnostics: alias, cycle, private. |
| `npm run journey` | 1 | Real local HTTP checkout returns 12 instead of approved 10. |

Successful before-phase capture of a failed reproduction does not mean the journey passed. Unit and type checks do not establish full-path readiness.

## Selected findings and owner decisions

- F-001: web modules bypass the public core interface. Route `ui.ts`, `routes.ts` and `alias.ts` through the existing core index, adding its `servicePrice` export.
- F-002: controlled HTTP endpoint supplies 12 against the agreed total 10. The owner selected correcting this fixture to 10, preserving the assertion at 10 and current quote behavior at 12; no business discount is invented.
- F-003: unexported core helpers `a.ts` and `b.ts` form an unused import cycle. Remove the pair and prove cycle rejection independently.
- F-004: the original maintained check omits native boundaries and checkout. Select a fail-fast aggregate plus independent valid/violation controls and maintained enforcement proof.
- F-005: retain Order for purchases and rename the UI sequence concept to Panel order in existing `glossary.md`.
- F-006: select the maintained contract, complete repository-owned standalone runtime, public-interface example, substantive assessment and fresh isolated clean-clone verification. Exact write approval remains a separate boundary.

Selection source: supervisor fixture verdict dated 2026-10-11, received in the review session on 2026-10-12. It also requires preserving the uncommitted owner note exactly and keeping this versioned audit as a historical snapshot.

## Limits at this observed state

The original checkout and native boundary checks failed. Final native proofs, assessed implementation and clean-clone checker evidence were still pending. Static import/re-export analysis does not cover dynamic imports or CommonJS require. The checkout probe uses a controlled local HTTP server and does not establish production service behavior. No hosted CI has run.

Only one Git commit exists; measured HEAD..HEAD records endpoint file sizes but supplies no longitudinal frequency or co-change evidence. Declared correction and foundation plans have disjoint writes and shared contracts, which does not establish semantic independence. Research used main-thread review of the few short project files; source citations were checked against the then-current bytes. Rule recommendations derive from existing design/native checks or the explicit selected maintenance foundation, not an inferred product vision.


## Rendered findings at the observed state

This installed-tool rendering belongs to the historical pre-correction state above. Its verification-blocked verdict is not a statement about any later commit.

# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Establish approved corrections and maintained foundation, then reassess a later user edit and implement a representative extension from resulting repo guidance.
Reviewed scope: .gitignore, AGENTS.md, CLAUDE.md, DESIGN.md, boundaries.mjs, glossary.md, journey.mjs, package-lock.json, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, tsconfig.json, unit.test.mjs, .bstack/project.json, docs/repo-audit.md, .bstack/assessment.json, .bstack/bin/bstack-check.mjs
Current fingerprint: 56622b2969a3b987828039ade9d4a0630b4f591ddc3138c8bfbfd1e1d7802e89

## Readiness evidence

- Missing required outcome: journey.
- Missing required outcome: native-rule-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: standalone-clean-clone.
- Missing required outcome: final-assessment.
- Outcome starting-checks is failed.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- Unresolved finding: F-006.
- starting-checks: failed. Method: Actual refreshed native captures, manually bound to findings fingerprint; target boundaries and journey fail before approval.. Artifact: [isolated-home][scratch-path] Fingerprint: 56622b2969a3b987828039ade9d4a0630b4f591ddc3138c8bfbfd1e1d7802e89.

## Documented intent

- design: UI never touches storage; checkout total is 10 (line 4). (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- language: Order has conflicting purchase and panel-sequence meanings. (glossary.md:3)
- owner-note: User note: receipt wording remains a future owner decision. Exact uncommitted text must be preserved. (DESIGN.md:6)
- verdict: Supervisor fixture verdict dated 2026-10-11 selects F-001 through F-006, confirms existing total 10 and quote 12, corrects only the controlled endpoint, confirms Order/Panel order and historical snapshot policy; retained verbatim scope in scratch selection.txt. (DESIGN.md:4)

## Observed behaviour

- imports: UI, routes and alias modules import private storage; public.ts uses the public index. (packages/web/ui.ts:1)
- journey: Real local HTTP service returns 12; line 12 requires total 10 and fails. (journey.mjs:6)
- unit: Unit quote asserts 12; mocked checkout asserts 10 and passes while journey fails. (unit.test.mjs:5)
- cycle: a imports b; b imports a; neither is exported from the package entry point. (packages/core/a.ts:1)
- commands: Maintained check only runs tsc; test, journey and boundaries are separate. (package.json:12)

## Inferred intent

- foundation: Existing small design is sufficient as rule authority; a maintained contract and portable review are requested by owner, not existing repo policy. (DESIGN.md:1)

## Observed debt

### F-001: Web bypasses the public core interface via direct and alias storage imports.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: DESIGN.md:3 and AGENTS.md:1 require storage isolation and public core use.
Consequence: Storage changes can force UI edits; native boundary check exits 1.
Fix: Export the needed service-price operation through the existing core index; change web callers to that public entry. Keep the existing permitted quote module as the representative example, documenting it in DESIGN.md.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Native rule-proof: public import valid; direct private import and alias import each fail with their diagnostic. Preserve the existing HTTP journey and unit public interface checks.
Sources: design, instructions, imports

### F-002: Checkout returns 12 against the agreed total 10; unit checks mask the disagreement.

Status: selected. Resolved: false. Blocks next change: true.
Files: DESIGN.md, journey.mjs, journey.mjs, packages/core/internal/database.ts, unit.test.mjs. Command: npm run journey.
Principle: Approved checkout total remains 10; expectations must come from the design.
Consequence: Important checkout journey is broken despite passing unit tests.
Fix: Correct only the controlled endpoint fixture price to 10; preserve journey assertion 10, public quote 12 and the production servicePrice implementation. Owner approved this fixture correction; introduce no business discount.
Scope: journey.mjs, DESIGN.md
Verification: Captured failing before journey, unchanged approved case passing after correction, surrounding public checks, and any required live dependency probes. Local fixture is a real HTTP interaction but is not a production service observation.
Sources: design, journey, unit

### F-003: Unexported core a and b form an unconditional recursion and import cycle.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle: Existing native boundaries.mjs rejects cycles.
Consequence: Calling either helper never reaches a base case; maintained enforcement cannot pass cleanly.
Fix: Remove the selected unused, unexported a.ts/b.ts pair; preserve all public entry points and callers.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Core entry point and all callers reviewed; public checks preserved; native cycle positive/negative fixture proof. Deletion is subject to exact diff approval.
Sources: cycle, commands

### F-005: Order names both a customer purchase and UI panel sequence.

Status: selected. Resolved: false. Blocks next change: true.
Files: glossary.md, glossary.md. Command: none.
Principle (proposed new principle): One canonical domain concept per glossary term.
Consequence: Future extension can interpret checkout Order ambiguously.
Fix: Owner confirmed Order for customer purchases and Panel order for UI panel sequencing. Correct the existing lowercase glossary.md without renaming code.
Scope: glossary.md
Verification: Owner confirms meanings; maintained document contract checks existing glossary and change assessment cites the confirmed definitions.
Sources: language


## Missing protections

### F-004: npm run check omits boundary, unit and checkout checks; current boundary traversal has unreported syntax limits.

Status: selected. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): The maintained command must fail when approved boundaries or the real checkout acceptance fail.
Consequence: A green default check currently permits all observed failures.
Fix: Extend the maintained check with fail-fast type, native boundary, unit and real HTTP journey checks. Strengthen the existing TypeScript-resolved web boundary to reject every core target except index.ts, so an alternate private core file cannot bypass public entry enforcement. Static imports/re-exports only; dynamic dependencies need explicit review.
Scope: package.json, boundaries.mjs, DESIGN.md, AGENTS.md
Verification: Independent native boundary valid/violation proof for private, alias and cycle cases; equivalent re-export syntax within supported scope; maintained aggregate passes valid public and sibling-package control, fails seeded violation with the intended diagnostic.
Sources: commands, design, journey

### F-006: No completion-evidence contract, standalone checker or assessed-state audit record exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, package.json. Command: none.
Principle (proposed new principle): Owner requests a maintained foundation that future changes can verify without the installed skill.
Consequence: Later user edits and extensions lack a durable source/check mapping and fresh clean-clone verification.
Fix: Reuse DESIGN.md and glossary.md. Add selected contract and complete unchanged generated standalone checker bundle. Historical audit snapshot names observed revision and user-note state; final current-head findings/readiness stay in scratch. Commit reviewed implementation, separately review/apply/commit exact portable assessment, then fresh standalone runs in working checkout and isolated different-root clean clone. No CI, delivery service or CLAUDE consolidation.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, docs/repo-audit.md, .bstack/assessment.json
Verification: Validate contract/docs; final scope evidence collect and substantive review; capture required checks; final findings validate/render; protect separately approved audit/assessment bytes; fresh standalone checker in working checkout and different-root clean clone with isolated home/cache and the explicit comparison base.
Sources: foundation, commands, design


## Design decisions


## Proposed new principles

- F-004: The maintained command must fail when approved boundaries or the real checkout acceptance fail. (selected)
- F-005: One canonical domain concept per glossary term. (selected)
- F-006: Owner requests a maintained foundation that future changes can verify without the installed skill. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Selected findings and intent decisions resolved by supervisor verdict; exact protected-write bytes are not approved yet.
- DESIGN.md has one owner note; preserved byte-for-byte in the proposed replacement and included in current original hash preconditions.
- Original native boundaries and checkout still fail in the target; passing proposed scratch controls do not establish target readiness.
- Native boundary proofs cover public entry, permitted sibling-core storage use, direct private imports, storage alias, re-export, alternate non-entry core imports and static cycles. Dynamic imports and CommonJS require are outside coverage.
- Historical versioned audit remains a snapshot of the original revision with uncommitted owner note; final current-head readiness remains in scratch.
- No production service behavior, hosted CI or delivery service is claimed.
- Only one commit exists; HEAD..HEAD history and declared-plan overlap remain advisory limitations.
- The complete generated standalone checker is an opaque pinned installed payload; all exact bytes and hashes will be in the protected diff.
- Final assessed evidence and clean-clone standalone verification require approved project writes and separately approved portable assessment bytes.
