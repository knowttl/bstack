# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: 81feef422f8fda1c96302a7fb3c09070f60045ab
Stated next change: Audit and recommend principles/checks for the approved goals; no implementation change requested.
Reviewed scope: VISION.md, DESIGN.md, glossary.md
Current fingerprint: 99122cfa7e53effaa120058ba7fa88ae458fb6b2cf79fbcdc1c55e57d4656bdb

## Readiness evidence

- Missing required outcome: starting-checks.
- Unresolved finding: F-004.

## Documented intent

- vision: Approved one-reader save/list/mark-read outcome, preserving title and address; accounts, sharing and recommendations excluded. (VISION.md:3)
- design: Approved local Node and JSON persistence, queue ownership and presentation boundary. (DESIGN.md:3)
- terms: Queue includes read articles; marking read preserves title and address. (glossary.md:4)

## Observed behaviour

- inventory: Three documents only; no implementation or native checks. ([isolated-home][scratch-path]

## Inferred intent

- future: Real-file reload checks would protect the approved persistence commitment; no implementation behaviour inferred. (DESIGN.md:3)

## Observed debt


## Missing protections

### F-001: Approved save/list/mark-read journey has no implementation or executable protection.

Status: proposed. Resolved: false. Blocks next change: false.
Files: VISION.md, DESIGN.md, glossary.md. Command: none.
Principle: Protect the approved public journey and preserve article fields. Existing obligation; no exception to the stated success outcome.
Consequence: Product readiness cannot be established from these documents.
Fix: When implementing, add one real-product journey: save a supplied title/address, list it, mark it read, list again and verify it remains with unchanged title/address and read status. Test through the eventual presentation and queue public boundary, using real temporary JSON storage.
Scope: VISION.md, DESIGN.md, glossary.md
Verification: Acceptance: VISION.md:5, DESIGN.md:4-6 and glossary.md:4-5. Journey must fail on dropped articles or changed title/address; do not assert private methods or serialized formatting.
Sources: vision, design, terms, inventory

### F-002: JSON persistence is approved but has no reload check.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md. Command: none.
Principle: Persist public article state across application reloads. Existing persistence commitment; any narrower guarantee requires explicit design approval.
Consequence: An in-memory-only test could pass while saved articles disappear when the application restarts.
Fix: Extend the same journey with fresh application instances against the same temporary JSON file after save and after mark-read. Require exact supplied title/address and retained read status.
Scope: DESIGN.md
Verification: Acceptance: DESIGN.md:3, VISION.md:5 and glossary.md:3-5. Real-file test, fresh instance/process; no mocked storage. Never use the reader's own queue file.
Sources: design, vision, terms, future

### F-003: Presentation/storage separation is documented but has no executable implementation to inspect.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md. Command: none.
Principle: Queue owns article state; presentation only calls its public operations. Existing rule applies to presentation and storage writes; no current exception.
Consequence: Direct presentation writes could bypass state-preservation rules.
Fix: Retain DESIGN.md as authority. During implementation review, inspect presentation imports and all storage writers to ensure writes are owned by the queue boundary. Add native import-boundary analysis only when actual module paths justify it.
Scope: DESIGN.md
Verification: Acceptance: DESIGN.md:4-5. Review the actual dependency paths and write call sites. If automation is selected later, prove public imports pass and direct storage imports fail in disposable fixtures, including aliases/re-exports.
Sources: design, inventory

### F-004: No maintained check entry point or definition of completion exists.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md, VISION.md. Command: none.
Principle (proposed new principle): Proposed: complete a change when affected approved journeys pass on final inputs; use one repository-owned check command. Scope: future code and checks. Exception: documentation-only changes use source/structure review; unavailable journeys remain explicitly unverified.
Consequence: Passing isolated unit tests could be mistaken for proof of the reader's outcome.
Fix: Propose a short verification section in DESIGN.md linking acceptance cases and the journey location when created, plus a single npm run check command. Begin with built-in node --test for JavaScript. Choose one formatter/linter configuration when code exists; add applicable type checks if the implementation uses types. Keep CI a separately selected integration.
Scope: DESIGN.md, VISION.md
Verification: Review against VISION.md:5 and DESIGN.md:3-6. On implementation, run the maintained command with real-file journey coverage, capture version/output/exit and final input state; prove a deliberate journey regression makes it fail. No runtime or tool pin claimed now.
Sources: vision, design, inventory


## Design decisions


## Proposed new principles

- F-004: Proposed: complete a change when affected approved journeys pass on final inputs; use one repository-owned check command. Scope: future code and checks. Exception: documentation-only changes use source/structure review; unavailable journeys remain explicitly unverified. (proposed)

## Selected findings


## Limitations

- Only three documents exist; product execution and native starting-check evidence are unavailable.
- No selected changes or approved exact-byte edits; recommendations remain proposals.
- Two-commit measurement is advisory; no code coupling or architecture metrics established.
- No two declared plans exist; overlap comparison is inapplicable.
- Research ran in main thread because three small files make delegation wasteful; subagents and web are available.
- No product decisions are reopened: approved vision, stack, design and vocabulary agree.
