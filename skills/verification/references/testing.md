# Testing

Use this reference to propose testing guidance for a repo and to audit its existing tests.
Start from the project's requirements, approved design and observed risks; these principles are candidates to adapt, not text to paste over a repo's own policy.

## Contents

- [Principles P1-P10](#principles-p1-p10)
- [The four-question gate](#the-four-question-gate)
- [Offline by default](#offline-by-default)
- [Outside the codebase](#outside-the-codebase)
- [Wasteful-test patterns](#wasteful-test-patterns)
- [Audit an existing suite](#audit-an-existing-suite)
- [Write testing guidance](#write-testing-guidance)
- [Findings for test recommendations](#findings-for-test-recommendations)
- [Questions for the checks research brief](#questions-for-the-checks-research-brief)

## Principles P1-P10

- **P1** A change is done when its affected user journeys work on the real product, with captured evidence.
- **P2** Every project keeps one verification kit: a stable driver plus a feature map of how a user reaches each feature.
- **P3** Add a test only if it passes the four-question gate; otherwise verify by driving and add nothing.
- **P4** Test through the interface a user or caller touches, at the lowest level that still sees the behaviour; never private internals.
- **P5** Assert the exact result the user sees; a test that would still pass if the code under test returned nothing is rewritten or deleted.
- **P6** No TDD by default; a bug fix starts with a reproduction as close to the user as possible, kept as a test only if it passes the gate.
- **P7** The default test command is offline, deterministic and fast; live network is blocked by configuration in every repo where the runner supports it.
- **P8** Anything outside the codebase is proven by a small live probe before and after the change; mocks only at true boundaries, sanitized, testing the failures the product handles differently.
- **P9** One paved path: one runner, one fixture builder, one command that runs everything; new tests extend it.
- **P10** Every repeated correction follows the [Correct checklist](../SKILL.md#correct-checklist); wasteful tests are flagged with evidence and removed only when the owner selects them.

Where principles seem to conflict, the axis is public versus private: a unit test through a public interface that sees the behaviour is valid, a test of private internals is not, and mocked coverage alone never establishes a live journey.
No test-first workflow is imposed.
A bug fix starts with a reproduction close to the user as evidence, and keeping it as a test is a separate decision under the gate.
Mocks keep the default suite fast; truth about vendors comes from live probes, never from the mock.

## The four-question gate

Ask once per change, after driving the affected features.
Any no means no new test.

1. Does the change alter behaviour a user or caller relies on?
2. Would a plausible future change break it silently?
3. Is that break unprotected today?
4. Is the expected result from an agreed source, not the code's current output?

Name the acceptance source and the journey or public boundary a proposed test protects, and propose the fewest checks that would fail if that outcome broke.
Do not propose tests that assert private implementation or copy expected values from current behaviour without an approved source.

## Offline by default

The default test command runs offline, deterministically and fast, and live network access is blocked by configuration wherever the repo's runner supports it.
Research the runner's own mechanism for each project; do not carry one tool's setting into another.
Where the runner offers no blocking mechanism, record that as a limitation and keep the default suite free of live calls by convention and review.
Vendor truth comes from probes, not from this suite.

## Outside the codebase

For behaviour outside the codebase, documentation, memory, mocks and recorded fixtures do not replace observation.
Record a small live probe before the change and the same probe after it with `probe record`, then compare the pair with `probe compare`.
Use a read-only call, sandbox or dry run.
Ask first before any call that writes, costs money, sends a message or changes shared data.
If the probe cannot run, name the reason and assumption and mark the change unverified.
Mocks, where used, sit only at true boundaries, are sanitized, and cover the failures the product handles differently.
The third-party lens reference applies when the product integrates with an outside service.

## Wasteful-test patterns

Use these patterns when reviewing existing tests and proposing testing guidance for implementing agents and reviewers.
Trace each test to a supported production caller and an agreed behaviour before recommending removal or consolidation.
Similar inputs alone do not establish duplicate coverage: different boundaries may protect distinct failures.

| Pattern to flag | Guidance to prevent it |
|---|---|
| Duplicate coverage of the same scenario at unit and end-to-end levels or in sibling tests | Keep the fewest tests that protect distinct observable failures; consolidate redundant cases while retaining critical journey coverage. |
| Tests of guards or paths with no production caller | Test supported production behaviour; do not add tests solely to preserve unused code paths. |
| Oversized tables of combinations | Choose representative boundary and failure cases; add combinations only when they protect a distinct requirement or plausible failure. |
| Tests that re-run tests already in the suite, such as a nested `go test` | Let the suite run each test once; invoke a test runner inside a test only when that runner's behaviour is the contract under test. |
| Expensive setup repeated for every table case | Share expensive setup when cases can remain isolated and deterministic; retain per-case setup where isolation requires it. |
| Cold rebuilds that build a binary per test | Reuse a binary built for the current source inputs across tests; rebuild only when a case changes build inputs or tests the build itself. |
| Tautological tests that assert their own setup or cannot fail | Assert production outcomes against independent expectations; do not add assertions that only confirm test setup or cannot fail when production behaviour breaks. |
| Tests of impossible scenarios no production path can reach | Use inputs and states reachable through supported production paths, including invalid external input at real boundaries; do not fabricate states that production cannot create. |

For each existing instance, cite the tests, production callers, overlapping protection or repeated work, and the smallest change that preserves the acceptance criteria.
Do not infer runtime savings from source inspection; distinguish observed timings from expected savings.
These are human review judgements, not substring checks or universal limits on case counts.

## Audit an existing suite

Inspect the manifests, test configuration, tests and production callers.
Note which important user journeys have direct executable checks and which tests assert private implementation rather than a public contract.
Review every test file you read against all eight patterns, recording evidenced instances as findings rather than deleting tests.
An important journey protected only by unit or mocked tests is a missing protection.
Run the project's own test command when its prerequisites permit, and record the result and tool versions actually used; unavailable checks are limitations, not evidence.
Get approval before any check that affects external systems or shared data.
Flagged tests are removed only through a change the owner selects.

## Write testing guidance

When the owner selects testing guidance, adapt the principles into the project's existing authoritative surfaces and link to them instead of copying them.

- Put concise guidance in `AGENTS.md`, including all eight prevention rules from the table above, linking to any existing testing policy for rationale and exceptions rather than copying that policy.
- Where review instructions are configured, such as a review step in the project's delivery tool, include all eight patterns as explicit review criteria so reviewers flag new instances with the same evidence and exceptions. Extend the existing configuration, preserve unrelated instructions, and do not introduce a review service for these rules.
- When no project source states what evidence completes a change, propose one short section in the existing design or contribution guide naming where acceptance cases and the journey check live, that a change is complete when its affected journeys pass on the final inputs, and that passing unit tests alone do not establish it.
- Report an instruction that mandates one development sequence for every change, such as writing a failing test before all work, as a proposed principle change, and keep it unless the user selects the change.
- State the offline default, the gate and the paved path as separate short rules, each with its enforcement: the one test command, the review criteria or the kit.

Every selected change goes through the exact-diff review and apply boundary.

## Findings for test recommendations

Record each material test finding with an ID, the observed problem, evidence files or the failing command, the principle, the consequence, the proposed fix, scope, verification method and whether it blocks the stated next change.
For a test recommendation, name the acceptance source and the journey or public boundary it protects.
Keep proposed new principles separate from existing requirements.
Avoid speculative findings, cosmetic rewrites and universal prescriptions.

## Questions for the checks research brief

When researching a repo's existing checks, also answer:

- Which important user journeys have direct executable checks, which rely only on unit, mocked or private-implementation tests, and which have none?
- Which existing tests duplicate a scenario across levels or siblings, protect paths without production callers, enumerate unnecessary combinations, re-run other suite tests, repeat expensive setup per case, or cold-build a binary per test instead of reusing it?
- Which tests assert only their own setup or cannot fail when production behaviour breaks, and which exercise inputs or states no production path can reach?
- What caller, coverage or setup evidence supports each candidate finding, and which distinct failures or isolation needs justify retaining it?
