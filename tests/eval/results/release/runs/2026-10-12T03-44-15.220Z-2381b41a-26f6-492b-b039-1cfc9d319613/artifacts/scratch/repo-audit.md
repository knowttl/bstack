# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: 81feef422f8fda1c96302a7fb3c09070f60045ab
Stated next change: No next product change specified; read-only audit and recommendations against approved goals.
Reviewed scope: VISION.md, DESIGN.md, glossary.md
Current fingerprint: 8f35e44d05952a50f290003d1bc3eb5b6305a9a50588afc70c056cebf13c399a

## Readiness evidence

- Missing required outcome: starting-checks.
- Unresolved finding: F-003.

## Documented intent

- vision: Owner-approved single-reader journey and version-one non-goals. (VISION.md:3)
- design: Local Node, JSON persistence, queue operations and storage ownership. (DESIGN.md:3)
- vocabulary: Articles have title, address and read status; queue includes read articles. (glossary.md:3)

## Observed behaviour

- inventory: Only three documents; absent executable implementation and enforcement. ([isolated-home][scratch-path]
- runner: Official Node 24 documentation supports built-in node:test and node --test. (https://nodejs.org/docs/latest-v24.x/api/test.html)

## Inferred intent

- next: Recommendations only; no next product change or selected edits were supplied. (User request: audit against approved goals)

## Observed debt


## Missing protections

### F-001: Approved save/list/mark-read journey has no implementation or executable protection.

Status: proposed. Resolved: false. Blocks next change: false.
Files: VISION.md, DESIGN.md, glossary.md. Command: none.
Principle: Preserve title and address while changing read status; keep read articles in the queue.
Consequence: Product success and JSON persistence cannot be demonstrated.
Fix: When implementation is selected, add one public journey check using a real temporary JSON file: save known title/address, list, mark read, list again, reopen the app or queue from disk and list. Assert read status, unchanged title/address and continued membership. Use node:test and node --test; wire into one repo-owned check command. Exceptions: mocked storage may supplement this check but cannot replace it for readiness.
Scope: VISION.md, DESIGN.md, glossary.md
Verification: Execute via the real presentation boundary and JSON adapter when available. Seed a title/address mutation, dropped read article and non-persisted status separately; each must fail. No private helper or JSON-layout assertions.
Sources: vision, design, vocabulary, inventory, runner

### F-002: Storage ownership is approved but has no executable code or review enforcement yet.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md. Command: none.
Principle: Presentation uses public queue operations and never writes storage directly.
Consequence: A future presentation write could bypass queue invariants and corrupt article state.
Fix: Review presentation imports and write paths against DESIGN.md:5 for each affected change. Queue owns save/list/mark-read and persistence access. Keep this as a human review rule initially; only select semantic import analysis if the future native toolchain can express it. Exceptions require a reviewed design change, not a silent bypass.
Scope: DESIGN.md
Verification: Review a permitted public queue call and reject a representative direct presentation storage write; if automation is selected later, prove valid and seeded-invalid imports with native tools.
Sources: design, inventory

### F-003: No project source states what evidence completes a change or where acceptance checks live.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md, VISION.md, glossary.md. Command: none.
Principle (proposed new principle): Proposed: completion requires affected approved journeys to pass on final inputs.
Consequence: Passing future isolated unit tests could be mistaken for evidence of the reader journey.
Fix: Add one short verification section to DESIGN.md when selected. Link VISION.md:5 and glossary.md:4-5 to the maintained journey check and repo-owned check command. Record command, runtime version and result on final inputs; missing or failing journey evidence leaves readiness unverified. Keep formatting/lint values in selected native configs; choose applicable type checks only when language setup exists. Human scope review rejects accounts/sharing/recommendations for version one. Exceptions must name a bounded reason and removal condition and retain an unverified outcome.
Scope: DESIGN.md, VISION.md, glossary.md
Verification: Review the section against approved source bytes; confirm the named check exists, passes the full real-storage journey and returns nonzero on seeded outcome violations. Documentation alone cannot satisfy readiness.
Sources: vision, design, vocabulary, inventory


## Design decisions


## Proposed new principles

- F-003: Proposed: completion requires affected approved journeys to pass on final inputs. (proposed)

## Selected findings


## Limitations

- Working tree clean at 81feef422f8fda1c96302a7fb3c09070f60045ab; no changes selected or applied.
- Native starting-check and important journey blocked: application, manifest, dependencies and test command do not exist. Audit helper success is not product readiness.
- No unresolved goal, stack, design or vocabulary decision found; no interview or vision board needed.
- No next change supplied; blocksNextChange is false rather than inventing a blocker for a hypothetical task.
- No two declared plans for overlap analysis; history has two documentation commits and does not support architectural violations.
- Formatting, lint, applicable types and setup remain recommendations to specify with actual implementation; hosted CI is unselected and unverified.
