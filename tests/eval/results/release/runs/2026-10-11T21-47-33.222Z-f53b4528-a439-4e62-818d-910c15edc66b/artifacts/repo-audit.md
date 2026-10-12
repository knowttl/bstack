# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: 81feef422f8fda1c96302a7fb3c09070f60045ab
Stated next change: Audit and recommend principles/checks only; no implementation change requested.
Reviewed scope: VISION.md, DESIGN.md, glossary.md
Current fingerprint: 16c2b2eb96f735e4bcc861aca59fef3826373c97a97a8be79f54fddab3385074

## Readiness evidence

- Missing required outcome: starting-checks.
- Unresolved finding: F-003.

## Documented intent

- vision: Owner-approved one-reader reading queue; save/find/mark read; preserve title/address; no accounts, sharing or recommendations. (VISION.md:3-7)
- design: Local Node, JSON persistence, queue state ownership and public operations; presentation does not write storage. (DESIGN.md:3-7)
- terms: Read articles remain in queue; mark read preserves title/address. (glossary.md:3-5)

## Observed behaviour

- inventory: Only three documents; no implementation, manifest, checks or instructions. Inspect found clean revision and Git 2.54.0 / Node v24.17.0. ([isolated-home][scratch-path]

## Inferred intent


## Observed debt


## Missing protections

### F-001: Approved reader journey and persistence have no executable protection; the repository contains documents only.

Status: proposed. Resolved: false. Blocks next change: false.
Files: VISION.md, DESIGN.md, glossary.md. Command: none.
Principle: Protect the approved public outcome using real JSON persistence, retaining title, address and queue membership when read status changes.
Consequence: Future unit or mock tests could pass while saving, finding or marking an article read fails, or data disappears after reload.
Fix: When implementing the first journey, add one public-facing save/list/mark-read acceptance test with a temporary JSON file. Assert title/address preservation and that read articles remain listed; reconstruct the application against the same file and assert persisted state. Prefer built-in node:test and node --test. Integrate into one repo-owned check command once a manifest exists.
Scope: VISION.md, DESIGN.md, glossary.md
Verification: Acceptance sources: VISION.md:5, DESIGN.md:3-6 and glossary.md:4-5. Exercise the actual presentation boundary with real persistence, without mocking storage; save, find, mark read, reopen, find read article with identical title/address. No implementation-specific snapshots. This must pass before claiming a working first version; no exception to the approved outcome.
Sources: vision, design, terms, inventory

### F-002: The approved presentation/storage separation has no implementation or enforcement yet.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md. Command: none.
Principle: The queue owns article state; presentation calls save, list and mark-read operations and does not write storage.
Consequence: Direct storage writes in presentation could bypass the queue contract and duplicate state updates.
Fix: During implementation review, inspect presentation dependencies and writes against DESIGN.md. Retain this as a human review rule initially. Introduce a native import boundary rule only if the actual module layout and tooling warrant it; do not add a custom regex checker or speculative layers.
Scope: DESIGN.md
Verification: Review actual module imports and state writes; public queue calls must be permitted and presentation storage writes rejected. If automation is selected later, prove allowed public imports pass and deliberate direct storage imports fail in disposable fixtures, including aliases/re-exports used by the project. No bypass exception without an explicitly reviewed design amendment.
Sources: design, inventory

### F-003: DESIGN.md states behaviour but does not define what evidence completes a change; no maintained check command exists.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md, VISION.md. Command: none.
Principle (proposed new principle): Proposed evidence policy: completion requires affected public journeys to pass on final inputs, with requirements as the expected-outcome source.
Consequence: Passing isolated unit checks or merely configuring tools could be mistaken for a working reading queue.
Fix: Propose a short Evidence section in DESIGN.md pointing to approved acceptance sources, the eventual journey test and one maintained check command. Include syntax checks and relevant tests; select formatting/lint tooling only as part of the actual scaffold, and applicable type checks only for the implementation language chosen within Node. Keep formatter/linter settings in native configs. Preserve current first-version non-goals in review. Do not introduce CI without selection.
Scope: DESIGN.md, VISION.md
Verification: Review policy against VISION.md:4-6 and DESIGN.md:3-6. Execute the eventual maintained command and the actual reader journey on final bytes. A skipped or unavailable journey remains unverified; temporary tooling exceptions need a narrow reason, scope and removal condition and cannot waive the user outcome.
Sources: vision, design, inventory


## Design decisions


## Proposed new principles

- F-003: Proposed evidence policy: completion requires affected public journeys to pass on final inputs, with requirements as the expected-outcome source. (proposed)

## Selected findings


## Limitations

- No product/native checks exist: runtime readiness is verification blocked; no passing product check is claimed.
- No changes selected or applied; protected apply is required only if the user later selects exact edits.
- No stated implementation next change; findings do not block this read-only audit, but missing journey evidence prevents first-version readiness.
- Research ran in the main thread because the entire repository has only three short files; subagent hand-offs would be wasteful.
- History measurement used 8f70d11e8700ae49baab9a4c0c700cb604edb759..81feef422f8fda1c96302a7fb3c09070f60045ab; one design/glossary co-change is advisory only.
- Overlap not run: no pair of declared plans exists.
- No new vision, goal interview, glossary rewrite, CI or external integration is needed.
- Audit helpers passed but do not substitute for current starting-check evidence on product behaviour.
