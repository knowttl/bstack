# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: After approved corrections and maintained foundation, re-audit a user edit and implement a representative extension using repo guidance and checks.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/bin/commands.mjs, .bstack/bin/commands/apply.mjs, .bstack/bin/commands/baseline.mjs, .bstack/bin/commands/cite-check.mjs, .bstack/bin/commands/contract-test.mjs, .bstack/bin/commands/contract.mjs, .bstack/bin/commands/docs-check.mjs, .bstack/bin/commands/docs-generate.mjs, .bstack/bin/commands/evidence-validate.mjs, .bstack/bin/commands/evidence.mjs, .bstack/bin/commands/findings.mjs, .bstack/bin/commands/inspect.mjs, .bstack/bin/commands/inventory.mjs, .bstack/bin/commands/measure.mjs, .bstack/bin/commands/overlap.mjs, .bstack/bin/commands/probe.mjs, .bstack/bin/commands/project.mjs, .bstack/bin/commands/rule-proof.mjs, .bstack/bin/commands/run-checks.mjs, .bstack/bin/commands/state.mjs, .bstack/bin/commands/vision-board-build.mjs, .bstack/bin/commands/vision-board-launch.mjs, .bstack/bin/commands/vision-board-verdicts.mjs, .bstack/bin/lib/args.mjs, .bstack/bin/lib/check-integration.mjs, .bstack/bin/lib/discovery.mjs, .bstack/bin/lib/document-references.mjs, .bstack/bin/lib/evidence-policy.mjs, .bstack/bin/lib/fingerprint.mjs, .bstack/bin/lib/glob.mjs, .bstack/bin/lib/json.mjs, .bstack/bin/lib/paths.mjs, .bstack/bin/lib/proposed-edit.mjs, .bstack/bin/lib/protected-write.mjs, .bstack/bin/lib/repo.mjs, .bstack/bin/lib/result.mjs, .bstack/bin/lib/run.mjs, .bstack/bin/lib/schema.mjs, .bstack/bin/lib/scratch.mjs, .bstack/bin/lib/vision-board.mjs, .bstack/bin/repo-audit.mjs, .bstack/project.json, .bstack/schemas/baseline.schema.json, .bstack/schemas/change-set.schema.json, .bstack/schemas/check-plan.json, .bstack/schemas/contract-test.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/findings.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/measure-exclusions.json, .bstack/schemas/overlap-plan.json, .bstack/schemas/probe-record.json, .bstack/schemas/probe-spec.json, .bstack/schemas/project-create.json, .bstack/schemas/project.schema.json, .bstack/schemas/research-report.json, .bstack/schemas/resume-state.schema.json, .bstack/schemas/vision-proposals.json, .bstack/schemas/vision-verdicts.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, journey.mjs, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: 3780600962b1db1dd07c072f754294afce9ea9770e5ce7995206f5a94ba29f2a

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: boundary-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: foundation-review.
- Missing required outcome: maintenance-contract.
- Missing required outcome: standalone-clean-clone.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-005.
- Unresolved finding: F-006.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- vocabulary: Order has two conflicting meanings. (glossary.md:3-4)
- selection: Supervisor selects endpoint price 10, assertion 10, quote 12, public core, acyclic dependencies, Panel order, native and aggregate enforcement, maintenance and standalone clean clone; historical snapshot policy. ([isolated-home][scratch-path]
- user-note: User note: receipt wording remains a future owner decision. (DESIGN.md:6)

## Observed behaviour

- runtime: Private and aliased imports and a cycle are present. (packages/web/ui.ts:1; packages/web/routes.ts:1; packages/web/alias.ts:1; packages/core/a.ts:1; packages/core/b.ts:1)
- checks: Types and units pass; real loopback checkout returns 12; boundaries reports alias, cycle, private. (package.json:12; journey.mjs:6-12; unit.test.mjs:5)

## Inferred intent


## Observed debt

### F-001: Checkout violates agreed total 10.

Status: selected. Resolved: false. Blocks next change: true.
Files: journey.mjs. Command: npm run journey.
Principle: Keep agreed checkout outcome.
Consequence: Customers receive total 12 in the important journey.
Fix: Correct controlled journey endpoint fixture to supply 10, preserving assertion at 10 and public quote 12; no business discount.
Scope: journey.mjs
Verification: Before failing reproduction, after passing same real HTTP journey; preserve public quote compatibility.
Sources: design, checks, selection

### F-002: Web imports storage directly and through alias; core has recursive dependency cycle.

Status: selected. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts, packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Use public core interface; propose acyclic dependencies as maintained rule.
Consequence: Storage details leak into web; a/b recurse indefinitely.
Fix: Export servicePrice from existing core index; route ui/routes/alias through public core; break b-to-a recursion with b using core-owned price.
Scope: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts, packages/core/a.ts, packages/core/b.ts
Verification: Native boundary valid/violation proofs for private, alias, re-export, cycle and permitted core internal use.
Sources: design, instructions, runtime


## Missing protections

### F-003: Maintained check runs only types and misses both observed failures.

Status: selected. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): One fail-fast maintained command protects approved outcomes.
Consequence: A successful default check can hide broken checkout and architecture.
Fix: Extend existing check with boundaries, public unit tests and real HTTP journey. Native TypeScript resolution covers imports, re-exports, import types and literal dynamic imports; web may use only core index. Fail unresolved and nonliteral dynamic dependencies.
Scope: package.json, boundaries.mjs
Verification: Prove maintained aggregate on allowed fixtures and individually seeded violations.
Sources: design, instructions, checks

### F-005: No maintained change evidence contract, standalone checker or completion guidance exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/bin/commands.mjs, .bstack/bin/commands/apply.mjs, .bstack/bin/commands/baseline.mjs, .bstack/bin/commands/cite-check.mjs, .bstack/bin/commands/contract-test.mjs, .bstack/bin/commands/contract.mjs, .bstack/bin/commands/docs-check.mjs, .bstack/bin/commands/docs-generate.mjs, .bstack/bin/commands/evidence-validate.mjs, .bstack/bin/commands/evidence.mjs, .bstack/bin/commands/findings.mjs, .bstack/bin/commands/inspect.mjs, .bstack/bin/commands/inventory.mjs, .bstack/bin/commands/measure.mjs, .bstack/bin/commands/overlap.mjs, .bstack/bin/commands/probe.mjs, .bstack/bin/commands/project.mjs, .bstack/bin/commands/rule-proof.mjs, .bstack/bin/commands/run-checks.mjs, .bstack/bin/commands/state.mjs, .bstack/bin/commands/vision-board-build.mjs, .bstack/bin/commands/vision-board-launch.mjs, .bstack/bin/commands/vision-board-verdicts.mjs, .bstack/bin/lib/args.mjs, .bstack/bin/lib/check-integration.mjs, .bstack/bin/lib/discovery.mjs, .bstack/bin/lib/document-references.mjs, .bstack/bin/lib/evidence-policy.mjs, .bstack/bin/lib/fingerprint.mjs, .bstack/bin/lib/glob.mjs, .bstack/bin/lib/json.mjs, .bstack/bin/lib/paths.mjs, .bstack/bin/lib/proposed-edit.mjs, .bstack/bin/lib/protected-write.mjs, .bstack/bin/lib/repo.mjs, .bstack/bin/lib/result.mjs, .bstack/bin/lib/run.mjs, .bstack/bin/lib/schema.mjs, .bstack/bin/lib/scratch.mjs, .bstack/bin/lib/vision-board.mjs, .bstack/bin/repo-audit.mjs, .bstack/schemas/baseline.schema.json, .bstack/schemas/change-set.schema.json, .bstack/schemas/check-plan.json, .bstack/schemas/contract-test.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/findings.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/measure-exclusions.json, .bstack/schemas/overlap-plan.json, .bstack/schemas/probe-record.json, .bstack/schemas/probe-spec.json, .bstack/schemas/project-create.json, .bstack/schemas/project.schema.json, .bstack/schemas/research-report.json, .bstack/schemas/resume-state.schema.json, .bstack/schemas/vision-proposals.json, .bstack/schemas/vision-verdicts.json. Command: none.
Principle (proposed new principle): Changes complete when affected approved journeys pass on final inputs; unit success alone is insufficient.
Consequence: Later user edits and extensions have no portable impact and acceptance gate.
Fix: Maintain completion/impact guidance in DESIGN.md, pointers in AGENTS.md, selected first contract and complete standalone runtime/schemas. Preserve exact user note and CLAUDE.md.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/bin/commands.mjs, .bstack/bin/commands/apply.mjs, .bstack/bin/commands/baseline.mjs, .bstack/bin/commands/cite-check.mjs, .bstack/bin/commands/contract-test.mjs, .bstack/bin/commands/contract.mjs, .bstack/bin/commands/docs-check.mjs, .bstack/bin/commands/docs-generate.mjs, .bstack/bin/commands/evidence-validate.mjs, .bstack/bin/commands/evidence.mjs, .bstack/bin/commands/findings.mjs, .bstack/bin/commands/inspect.mjs, .bstack/bin/commands/inventory.mjs, .bstack/bin/commands/measure.mjs, .bstack/bin/commands/overlap.mjs, .bstack/bin/commands/probe.mjs, .bstack/bin/commands/project.mjs, .bstack/bin/commands/rule-proof.mjs, .bstack/bin/commands/run-checks.mjs, .bstack/bin/commands/state.mjs, .bstack/bin/commands/vision-board-build.mjs, .bstack/bin/commands/vision-board-launch.mjs, .bstack/bin/commands/vision-board-verdicts.mjs, .bstack/bin/lib/args.mjs, .bstack/bin/lib/check-integration.mjs, .bstack/bin/lib/discovery.mjs, .bstack/bin/lib/document-references.mjs, .bstack/bin/lib/evidence-policy.mjs, .bstack/bin/lib/fingerprint.mjs, .bstack/bin/lib/glob.mjs, .bstack/bin/lib/json.mjs, .bstack/bin/lib/paths.mjs, .bstack/bin/lib/proposed-edit.mjs, .bstack/bin/lib/protected-write.mjs, .bstack/bin/lib/repo.mjs, .bstack/bin/lib/result.mjs, .bstack/bin/lib/run.mjs, .bstack/bin/lib/schema.mjs, .bstack/bin/lib/scratch.mjs, .bstack/bin/lib/vision-board.mjs, .bstack/bin/repo-audit.mjs, .bstack/schemas/baseline.schema.json, .bstack/schemas/change-set.schema.json, .bstack/schemas/check-plan.json, .bstack/schemas/contract-test.json, .bstack/schemas/evidence.schema.json, .bstack/schemas/findings.schema.json, .bstack/schemas/impact-assessment.json, .bstack/schemas/measure-exclusions.json, .bstack/schemas/overlap-plan.json, .bstack/schemas/probe-record.json, .bstack/schemas/probe-spec.json, .bstack/schemas/project-create.json, .bstack/schemas/project.schema.json, .bstack/schemas/research-report.json, .bstack/schemas/resume-state.schema.json, .bstack/schemas/vision-proposals.json, .bstack/schemas/vision-verdicts.json
Verification: Contract/docs validation; final impact assessment covering changed and unmapped paths; fresh standalone check in checkout and different-root clean clone with isolated home/cache, same explicit base.
Sources: design, instructions, checks

### F-006: No portable assessment or historical assessed snapshot exists.

Status: selected. Resolved: false. Blocks next change: true.
Files: .bstack/assessment.json, docs/repo-audit.md. Command: none.
Principle (proposed new principle): Portable review binds actual final inputs and fresh outcomes; historical audit is not current readiness authority.
Consequence: Later edits and extensions lack a portable impact record.
Fix: After protected implementation and verification, separately review/apply historical audit, commit implementation, collect/review/bind portable assessment and commit it separately. Keep current-head findings in scratch and freshly run standalone checker in checkout and isolated clone.
Scope: .bstack/assessment.json, docs/repo-audit.md
Verification: Final evidence validation and fresh standalone leaf checks in working checkout and different-root clean clone with isolated home/cache.
Sources: selection, design, checks


## Design decisions

### F-004: Order denotes purchase and panel sequence.

Status: selected. Resolved: true. Blocks next change: true.
Files: glossary.md. Command: none.
Principle: Use unambiguous approved project vocabulary.
Consequence: Extensions cannot infer which concept Order names.
Fix: Keep Order for customer purchases; rename UI panel sequencing to Panel order in glossary.md.
Scope: glossary.md
Verification: Reviewed definitions and maintenance impact coverage.
Sources: vocabulary


## Proposed new principles

- F-002: Use public core interface; propose acyclic dependencies as maintained rule. (selected)
- F-003: One fail-fast maintained command protects approved outcomes. (selected)
- F-005: Changes complete when affected approved journeys pass on final inputs; unit success alone is insufficient. (selected)
- F-006: Portable review binds actual final inputs and fresh outcomes; historical audit is not current readiness authority. (selected)

## Selected findings

- F-001
- F-002
- F-003
- F-004
- F-005
- F-006

## Limitations

- Owner decisions resolved by supervisor-selected verdicts; exact byte approval pending.
- DESIGN.md user note preserved exactly. Starting checks recaptured after note; target journey and boundaries still fail.
- Scratch aggregate and independent controls pass but are not target or final-path readiness.
- One-commit history provides sizes only. Research ran in main thread for small repo.
- Existing line-style glossary has limited automated vocabulary validation; explicit review supplements it.
- Historical audit and portable assessment require separate protected reviews; current-head readiness remains scratch. No hosted CI.
