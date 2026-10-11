# Final release evaluation

Evaluation is in progress and does not establish release readiness.
The complete acceptance validator, all-case coverage and scenario comparisons are not yet complete.

## Independent-extension scope

The `final-independent-extension` procedure remains without-only under the supervisor decision on 2026-10-11.
Its approved AC-64 scoring question requires no discoverable repo-audit skill and use of only the maintained target's resulting guidance.
A with-skill installation would contradict that procedure, rather than provide its comparison.
See [design AC-64](../../../../docs/design.md#acceptance-cases), [T4.3](../../../../docs/implementation-plan.md#t43-prove-both-complete-paths-and-a-representative-extension), the [scenario registry](../../scenarios/scenarios.json) and [evaluation isolation contract](../../../../docs/evaluation.md#isolation-and-authentication).
Fresh final-input evidence remains required; this decision does not waive AC-64.

## Historical discovery with subagents before scope rejection

The fresh [run](runs/2026-10-11T17-23-14.874Z-e2ba03c8-364c-4860-95e4-38f27b7a8ccc/run.json) evaluated committed revision `f1dc798` using the thirty-minute adapter at the scenario's last defined checkpoint, `discovery`.
Codex CLI 0.162.1 with gpt-6.1-sol and medium reasoning completed the opening turn in approximately 161 seconds on Linux with Node v24.17.0.
The four manually scored checks passed: AC-34, AC-36, AC-48 and AC-37.
This is current-worker scoring, not an independent human study.

The [parent trace](runs/2026-10-11T17-23-14.874Z-e2ba03c8-364c-4860-95e4-38f27b7a8ccc/delegation-trace-1.jsonl) records five actual spawn calls and overlapping architecture, checks and language workers.
The five child traces retain actual tool-call inputs and assistant results, independently establishing read-only source inspection without project edits or check execution by workers.
Native trace excerpts omit system/developer messages, world state, reasoning, configuration and encrypted instruction content.
They retain timestamps, actual calls and delivered worker reports.

The [research report](runs/2026-10-11T17-23-14.874Z-e2ba03c8-364c-4860-95e4-38f27b7a8ccc/research-report.json) contains five briefs and explicitly records the author-imposed no-web limitation.
The evaluator independently reran the shipped citation checker against the original report and fixture: all 56 file citations passed with no problems.
The fixture's Git status remained empty.
The runner verified discovery isolation and deleted the complete isolated home before scoring.
The login copy had already been removed after the turn, as required by the existing runner.
The without-skill baseline and comparison are blocked as described below.

## AC-46 blocked baseline

Run `2026-10-11T17-27-55.581Z-5a493f04-d45d-494c-8207-1849be934d1a` used the same scenario, fixture revision, model and adapter in without mode.
It completed a host turn, but cannot provide a comparable without-skill result.
Its discovery inventory found no repo-audit in the runner's selected discovery paths, yet the host searched outside its isolated home and fixture, found another project's repo-audit installation and read its skill, briefs and schema.
The host then executed that outside installation's citation checker.
The baseline therefore used the skill and remains unscored and blocked.

Relevant captured observations, with private locations replaced by a neutral marker:

- Conversation line 19 searches the actual host home for `research-briefs.md`, `research-report.json` and `cite-check.mjs`.
- Line 21 reads `[outside-installation]/repo-audit/SKILL.md`, `references/research-briefs.md` and `schemas/research-report.json`.
- Line 22 states that the host found a local repo-audit installation and will use those resources.
- Line 36 executes `[outside-installation]/repo-audit/scripts/repo-audit.mjs cite-check` against the fixture.

The complete blocked transcript is retained privately rather than published because its broad host searches captured unrelated project inventories.
Its SHA-256 is `b1bc142e202b46a9b2d2af81103f617d572c972a89e7e11e2f19b3ce7ebd8621`.
The closed run record SHA-256 is `88c012b192777e9a434447541c5d4a106133c862d22df7ba30fa1c7fdffffa6b`.
The runner deleted the entire isolated home, and this blocked attempt is excluded from final evidence selections.
No comparison was scored and no acceptance case was waived.
The supervisor approved a shared fixture/home instruction guard and rejection of observed out-of-scope paths on 2026-10-11.
The runner now checks both parent conversation output and native parent/worker tool traces, including late observations at close.
Temporary files belong to the isolated home through all three temporary-directory environment variables.
The changed scope contract requires a fresh baseline and with-skill pair; the earlier passing with-skill run is historical evidence only.
