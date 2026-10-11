# Final release evaluation

Evaluation is in progress and does not establish release readiness.
The complete acceptance validator, all-case coverage and scenario comparisons are not yet complete.
The [AC-35 capability gap](AC-35-capability-gap.md) has an effective supported restriction verified by a capture-only probe and the fresh TypeScript fallback run.
Both corrected fallback comparisons pass under that effective adapter, resolving AC-35.
Evaluation is paused for two evidence decisions, with no release selection or waiver for the affected cases.

- AC-29: the baseline's initial immutable score incorrectly credited the passing-units condition despite no unit execution; the [grading explanation](verification-limitations-grading.md) and [proposed correction](verification-limitations-baseline-correction-proposal.json) preserve the captured turn and identify the original scoring hash.
  The public scorer forbids rescoring and an unchanged real-agent rerun is prohibited.
  The with-skill run honestly passes all three verification-limitations checks, including two actual unit passes with browser evidence still unverified.
- AC-57 and AC-68: the [scope failure observation](scope-and-prerequisites-scope-failure.json) records rejected `/proc` and `/tmp` paths in the with-skill resource preflight.
  The run remains unscored; its complete contaminated transcript is retained privately, and its isolated home was deleted.
  The baseline passed both checks, but no valid final comparison exists.

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

## Earlier discovery comparison with scope version 2

The [baseline](runs/2026-10-11T18-01-42.264Z-05b66d0f-e8fc-4b29-bb92-15b001a98ed1/run.json) and [with-skill run](runs/2026-10-11T18-02-24.710Z-3b5c141a-c401-4ef9-8b97-677251ce5f4f/run.json) used source revision `459b168`, identical criteria, fixture revision, Node, Codex, model and adapter.
The [comparison](research-subagents-comparison.json) passed: baseline 0/4, with-skill 4/4, no lost checks.
The baseline reported the absent required research resources and stopped without searching outside the permitted roots.
The with-skill run returned all five briefs through actual workers, with overlapping architecture, checks and language execution shown in the retained native traces.
Main-thread source review and an independent rerun of the shipped citation checker passed all 54 file citations.
The fixture's Git status remained empty.
Language and outside research remained not researched under the author-imposed no-web constraint.
Both runs verified scope version 2 and deleted their complete isolated homes before scoring.

## Corrected Python fallback comparison

The [baseline](runs/2026-10-11T18-40-53.788Z-32e4e9fc-4fba-4aaa-8f14-13a050abc6bf/run.json) and [with-skill run](runs/2026-10-11T18-42-43.288Z-5bdf3777-6de5-493a-8bc6-64e8ce6971db/run.json) use committed source `9cebb2e`, identical fixture and scoring inputs, and the same corrected effective adapter as TypeScript.
The [comparison](research-main-python-comparison.json) passes: baseline 0/3, with-skill 3/3, with no lost checks.
The actual [native session observation](runs/2026-10-11T18-42-43.288Z-5bdf3777-6de5-493a-8bc6-64e8ce6971db/capability-observation.json) confirms no `spawn_agent` declaration or delegation calls.
The [report](runs/2026-10-11T18-42-43.288Z-5bdf3777-6de5-493a-8bc6-64e8ce6971db/research-report.json) contains five sequential briefs, common report fields and the author-imposed no-web limitations.
Main-thread source review and the shipped checker preceded the result; the [independent check](runs/2026-10-11T18-42-43.288Z-5bdf3777-6de5-493a-8bc6-64e8ce6971db/citation-check-independent.json) passes all 45 citations.
Both complete isolated homes were deleted before scoring.
Native excerpts omit encrypted messages, system and developer instructions, world state, reasoning and configuration.
Scoring was performed by the release evaluator, rather than an independent human study.

Scope version 1 rejected a legitimate with-skill run because it resolved source imports and the help example `<base>..<head>` as filesystem operations.
The failed attempt remains unscored and is excluded from final selections.
Version 2 resolves relative paths only in concrete shell commands, while continuing to reject observed absolute paths in command output and native worker traces.
The regression suite reproduced the rejection before the fix and passed all 15 scope controls afterward.
The combined evaluation and acceptance development suites passed 125 tests, and `npm run check` passed.

## Corrected TypeScript fallback comparison

The [baseline](runs/2026-10-11T18-39-23.373Z-b48fdd56-9f0c-4cce-9a5f-a5671d9863fb/run.json) and [with-skill run](runs/2026-10-11T18-39-58.879Z-7ed8bd2d-56df-4b0e-8e5a-7b79ca5a02bd/run.json) use committed source `9cebb2e`, the same scoring criteria and fixture revision, and effective adapter hash `34b8a1f4a85eb0ec00057ef3ae58df3037478b683c078c39bc69b816ce4b2275`.
The [comparison](research-main-typescript-comparison.json) passes: baseline 0/3, with-skill 3/3, with no lost checks.
The baseline honestly stopped for missing resources within the allowed roots.
The [native capability observation](runs/2026-10-11T18-39-58.879Z-7ed8bd2d-56df-4b0e-8e5a-7b79ca5a02bd/capability-observation.json) confirms no `spawn_agent` declaration and zero delegation calls in the actual with-skill session.
The [report](runs/2026-10-11T18-39-58.879Z-7ed8bd2d-56df-4b0e-8e5a-7b79ca5a02bd/research-report.json) retains all five briefs and the no-web limitation.
The agent opened the cited files and ran the shipped checker before presenting its findings; an [independent checker run](runs/2026-10-11T18-39-58.879Z-7ed8bd2d-56df-4b0e-8e5a-7b79ca5a02bd/citation-check-independent.json) passes all 64 citations.
Both runs verified scope version 2 and deleted their complete isolated homes before scoring.
