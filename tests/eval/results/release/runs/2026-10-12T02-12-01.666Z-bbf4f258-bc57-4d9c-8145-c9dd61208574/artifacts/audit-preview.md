# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Establish approved corrections and maintained foundation, then reassess a later user edit and implement a representative extension from resulting repo guidance.
Reviewed scope: .gitignore, AGENTS.md, CLAUDE.md, DESIGN.md, boundaries.mjs, glossary.md, journey.mjs, package-lock.json, package.json, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts, tsconfig.json, unit.test.mjs, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Current fingerprint: 6f6371c3b6b88f44d5b31866180b16bb693898675e98638379b6e5be324d001d

## Readiness evidence

- Missing required outcome: native-rule-proof.
- Missing required outcome: maintained-enforcement.
- Missing required outcome: standalone-clean-clone.
- Missing required outcome: final-assessment.
- Outcome starting-checks is failed.
- Outcome journey is failed.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- Unresolved finding: F-006.
- starting-checks: failed. Method: Actual run-checks captures; manually bound summary of native exit codes, not an authenticated findings execution claim.. Artifact: [isolated-home][scratch-path] Fingerprint: 6f6371c3b6b88f44d5b31866180b16bb693898675e98638379b6e5be324d001d.
- journey: failed. Method: Actual npm run journey execution: child exit 1, total 12 versus 10; before-phase capture succeeds only as reproduction. Explicit manual artifact binding.. Artifact: [isolated-home]/cache/bstack/d9b04763da642cd52f8f876825de8f4f9959b02d06f5e7fc7cd8804c53dbe73c/5727590b-58ba-408a-9e19-d20e5bc0d4ce/checks.json. Fingerprint: 6f6371c3b6b88f44d5b31866180b16bb693898675e98638379b6e5be324d001d.

## Documented intent

- design: UI never touches storage; checkout total is 10 (line 4). (DESIGN.md:3)
- instructions: Use approved design and public core interface. (AGENTS.md:1)
- language: Order has conflicting purchase and panel-sequence meanings. (glossary.md:3)

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

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: DESIGN.md:3 and AGENTS.md:1 require storage isolation and public core use.
Consequence: Storage changes can force UI edits; native boundary check exits 1.
Fix: Export the needed service-price operation through the existing core index; change web callers to that public entry. Keep the existing permitted quote module as the representative example, documenting it in DESIGN.md.
Scope: packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, DESIGN.md
Verification: Native rule-proof: public import valid; direct private import and alias import each fail with their diagnostic. Preserve the existing HTTP journey and unit public interface checks.
Sources: design, instructions, imports

### F-003: Unexported core a and b form an unconditional recursion and import cycle.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle: Existing native boundaries.mjs rejects cycles.
Consequence: Calling either helper never reaches a base case; maintained enforcement cannot pass cleanly.
Fix: Recommend deleting only the unused, unexported a.ts/b.ts pair after explicit selection. Alternative: accepted narrow debt with a reason and removal condition; do not invent helper behavior.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Core entry point and all callers reviewed; public checks preserved; native cycle positive/negative fixture proof. Deletion is subject to exact diff approval.
Sources: cycle, commands


## Missing protections

### F-004: npm run check omits boundary, unit and checkout checks; current boundary traversal has unreported syntax limits.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs. Command: npm run check.
Principle (proposed new principle): The maintained command must fail when approved boundaries or the real checkout acceptance fail.
Consequence: A green default check currently permits all observed failures.
Fix: Extend the existing check script with fail-fast TypeScript, native boundaries, unit and journey commands. Retain native compiler-based boundary analysis. Document static import/re-export scope and dynamic dependency review limitations rather than claiming exhaustive coverage.
Scope: package.json, DESIGN.md, AGENTS.md
Verification: Independent native boundary valid/violation proof for private, alias and cycle cases; equivalent re-export syntax within supported scope; maintained aggregate passes valid public and sibling-package control, fails seeded violation with the intended diagnostic.
Sources: commands, design, journey

### F-006: No completion-evidence contract, standalone checker or assessed-state audit record exists.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, AGENTS.md, package.json. Command: none.
Principle (proposed new principle): Owner requests a maintained foundation that future changes can verify without the installed skill.
Consequence: Later user edits and extensions lack a durable source/check mapping and fresh clean-clone verification.
Fix: Add a concise completion and maintenance section to existing DESIGN.md, pointers in AGENTS.md, a selected first .bstack/project.json contract and the complete installed dependency-free checker runtime. Register existing authoritative names and native leaf checks, assess every changed or unmapped path. Propose audit and portable assessment records separately with exact bytes; commit implementation then portable assessment only after approval of that recording scope. No CI or instruction consolidation proposed.
Scope: DESIGN.md, AGENTS.md, .bstack/project.json, .bstack/bin/bstack-check.mjs, .bstack/assessment.json, docs/repo-audit.md
Verification: Validate contract/docs; final scope evidence collect and substantive review; capture required checks; final findings validate/render; protect separately approved audit/assessment bytes; fresh standalone checker in working checkout and different-root clean clone with isolated home/cache and the explicit comparison base.
Sources: foundation, commands, design


## Design decisions

### F-002: Checkout returns 12 against the agreed total 10; unit checks mask the disagreement.

Status: proposed. Resolved: false. Blocks next change: true.
Files: DESIGN.md, journey.mjs, journey.mjs, packages/core/internal/database.ts, unit.test.mjs. Command: npm run journey.
Principle: Approved checkout total remains 10; expectations must come from the design.
Consequence: Important checkout journey is broken despite passing unit tests.
Fix: Keep total-10 acceptance unchanged. Resolve owner pricing policy before choosing implementation; preserve the HTTP request and review whether the quote expectation 12 remains intended.
Scope: packages/core/internal/database.ts, packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, unit.test.mjs, DESIGN.md
Verification: Captured failing before journey, unchanged approved case passing after correction, surrounding public checks, and any required live dependency probes. Local fixture is a real HTTP interaction but is not a production service observation.
Sources: design, journey, unit

### F-005: Order names both a customer purchase and UI panel sequence.

Status: proposed. Resolved: false. Blocks next change: true.
Files: glossary.md, glossary.md. Command: none.
Principle (proposed new principle): One canonical domain concept per glossary term.
Consequence: Future extension can interpret checkout Order ambiguously.
Fix: Ask owner to retain Order for customer purchase and name UI sequence Panel order; edit existing lowercase glossary.md only after confirmation. No naming migration.
Scope: glossary.md
Verification: Owner confirms meanings; maintained document contract checks existing glossary and change assessment cites the confirmed definitions.
Sources: language


## Proposed new principles

- F-004: The maintained command must fail when approved boundaries or the real checkout acceptance fail. (proposed)
- F-005: One canonical domain concept per glossary term. (proposed)
- F-006: Owner requests a maintained foundation that future changes can verify without the installed skill. (proposed)

## Selected findings


## Limitations

- Pricing transformation and glossary meaning need owner decisions; implementation remains blocked.
- No project files edited; no findings selected or exact diff approved.
- Only one Git commit exists: measured HEAD..HEAD gives endpoint sizes, no longitudinal frequency or co-change evidence.
- Two declared correction/foundation plans share contracts despite disjoint write paths; overlap does not prove semantic independence.
- Native boundary checker supports static imports and exports; dynamic imports and require are outside current analysis.
- No live production service or hosted CI observed. Local HTTP journey fails; passing TypeScript/unit checks do not establish readiness.
- Research ran in main thread because the relevant repository is only a few short files. No external language recommendation or third-party-service integration is proposed.
- Native tools: Node v24.17.0, npm 11.13.0, local TypeScript 5.9.3. Fresh host resource checks passed before each run.
- Final checkpoint remains incomplete until selections, decisions, exact approvals, protected writes and final fresh evidence.
