# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: After approved corrections and maintained foundation, re-audit a user edit and implement a representative extension using repo guidance and checks.
Reviewed scope: .bstack/assessment.json, .bstack/bin/bstack-check.mjs, .bstack/project.json, AGENTS.md, DESIGN.md, boundaries.mjs, docs/repo-audit.md, glossary.md, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/web/alias.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: a6d6331641ec6e90adfa01c6b3c6da328c5b088c3e09c0c1879da3f38d42fb56

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
- Unresolved finding: F-004.
- Unresolved finding: F-005.

## Documented intent

- design: UI never touches storage; agreed checkout total is 10. (DESIGN.md:3-4)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- vocabulary: Order has two conflicting meanings. (glossary.md:3-4)

## Observed behaviour

- runtime: Private and aliased imports and a cycle are present. (packages/web/ui.ts:1; packages/web/routes.ts:1; packages/web/alias.ts:1; packages/core/a.ts:1; packages/core/b.ts:1)
- checks: Types and units pass; real loopback checkout returns 12; boundaries reports alias, cycle, private. (package.json:12; journey.mjs:6-12; unit.test.mjs:5)

## Inferred intent


## Observed debt

### F-001: Checkout violates agreed total 10.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts. Command: npm run journey.
Principle: Keep agreed checkout outcome.
Consequence: Customers receive total 12 in the important journey.
Fix: Resolve the pricing rule with owner, then implement it behind public core; retain existing journey input 12 and expected total 10.
Scope: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts
Verification: Before failing reproduction, after passing same real HTTP journey; preserve public quote compatibility.
Sources: design, checks

### F-002: Web imports storage directly and through alias; core has recursive dependency cycle.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts, packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Use public core interface; propose acyclic dependencies as maintained rule.
Consequence: Storage details leak into web; a/b recurse indefinitely.
Fix: Route web through public core exports and remove the cycle without deleting authoritative file names. Document representative public interface example.
Scope: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts, packages/core/a.ts, packages/core/b.ts
Verification: Native boundary valid/violation proofs for private, alias, re-export, cycle and permitted core internal use.
Sources: design, instructions, runtime


## Missing protections

### F-003: Maintained check runs only types and misses both observed failures.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): One fail-fast maintained command protects approved outcomes.
Consequence: A successful default check can hide broken checkout and architecture.
Fix: Extend existing check with native boundaries, unit tests and real journey; keep tools repo-owned. Tighten boundary handling where public-interface bypass is demonstrable.
Scope: package.json, boundaries.mjs
Verification: Prove maintained aggregate on allowed fixtures and individually seeded violations.
Sources: design, instructions, checks

### F-005: No maintained change evidence contract, standalone checker or completion guidance exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, package.json, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md. Command: none.
Principle (proposed new principle): Changes complete when affected approved journeys pass on final inputs; unit success alone is insufficient.
Consequence: Later user edits and extensions have no portable impact and acceptance gate.
Fix: Add brief evidence/completion guidance to DESIGN.md and pointers in AGENTS.md; install selected maintained contract and dependency-free checker from complete package; create assessed audit separately. Retain CLAUDE.md import stub.
Scope: DESIGN.md, AGENTS.md, package.json, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Contract/docs validation; final impact assessment covering changed and unmapped paths; fresh standalone check in checkout and different-root clean clone with isolated home/cache, same explicit base.
Sources: design, instructions, checks


## Design decisions

### F-004: Order denotes purchase and panel sequence.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md. Command: none.
Principle: Use unambiguous approved project vocabulary.
Consequence: Extensions cannot infer which concept Order names.
Fix: Owner decision: recommend Order for purchase and Panel sequence for UI ordering; keep glossary.md name.
Scope: glossary.md
Verification: Reviewed definitions and maintenance impact coverage.
Sources: vocabulary


## Proposed new principles

- F-002: Use public core interface; propose acyclic dependencies as maintained rule. (proposed)
- F-003: One fail-fast maintained command protects approved outcomes. (proposed)
- F-005: Changes complete when affected approved journeys pass on final inputs; unit success alone is insufficient. (proposed)

## Selected findings


## Limitations

- Owner pricing rule and vocabulary decisions pending.
- Only one Git commit exists; measure of HEAD..HEAD provides sizes but no change frequency or co-change history.
- Research performed in main thread because the repo has only a few small files. No outside service is exercised: journey uses a local HTTP fixture.
- No final checkpoint readiness: observed journey and boundaries fail; no selected project edits yet.
- Final standalone proof will require selected implementation and separate committed portable assessment.
