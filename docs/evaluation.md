# Evaluation contract

See [build progress](implementation-plan.md#progress) for T2.9 completion and the [C18 foundation checkpoint](../tests/eval/results/foundation-C18/summary.md) for its observed outcomes and limitations.
The [C27 final-path evidence](../tests/eval/results/full-path-C27/summary.md) records fresh completed installed paths, repeated audit, independent extension and bounded maintenance, with explicit final acceptance selections and current-agent manual verdicts.

C7a implements the T1.2 acceptance registry and manual evaluation interface.
C7b adds the current-host Codex adapter, verified discovery isolation, captured conversation turns and baseline runs.
No C7a manual score proves host isolation or an acceptance case for the released skill.

## Scenarios and runs

See the [C26 current-agent checkpoint](../tests/eval/results/invocation-C26/summary.md#fresh-paired-validation-on-current-bytes) for fresh installer-backed plain and explicit invocation observations on the corrected loading rules, retained artifacts and telemetry limitations.

`tests/eval/scenarios/scenarios.json` is version 1.
Each scenario names a fixture registered by the existing builder, an outcome request, an ordered answer script, allowed checkpoints, invocation mode and yes-or-no checks.
Each check has a unique ID, design acceptance ID and scoring question.
The initial scenarios cover new ideas, ambiguous ideas, a seeded existing repo, clear goals and implicit invocation.
Maintenance and representative-extension scenarios are defined before their later owning tasks use them.
The maintenance checkpoint uses `ts-shop` and the [maintenance reference](../skills/repo-audit/references/maintenance-contract.md), with no goal interview or full audit.
The T3a.7 fake-host procedure executes real collection, review binding, local standalone validation and a different-root clone with an empty home and cache.
It preserves the seeded checkout failure and reports that limitation independently of passing maintained unit checks.
Run `npm test -- --task T3a.7` for that procedure and the standalone checker controls.
Fake-host transcripts establish deterministic command and isolation behaviour only; they remain unscored and do not establish real-model compliance with AC-23.
The [C24c captured transcript](C24c-maintenance-transcript.md) records the completed fake-only maintenance and standalone flow, including the existing failed checkout journey.
Phase 3a's full fake-only suite precedes installation; the C27 final-path record owns fresh real-agent final maintenance acceptance.
An approved scenario stays in the evaluation even when its baseline passes.

```sh
npm run eval -- --manual --scenario ambiguous-idea --mode without --stage baseline --agent <agent> --model <model>
npm run eval -- --manual --scenario ambiguous-idea --mode with --stage baseline --agent <agent> --model <model> --invocation /repo-audit
```

The runner calls the existing fixture builder and prints the fixture path, request, answer script and checklist in its run record.
For `--stage foundation` or `--stage final`, the opening request includes `Active checkpoint: <stage>.` after any explicit invocation and before the scenario request.
The caller owns removal of the temporary fixture after the session.
Use a fresh conversation and preserve the complete conversation, including user answers and any available file-open record, as a UTF-8 transcript.
Deliver the scripted answers when the agent asks the corresponding questions.
Do not treat a one-shot prompt as delivery of later answers.
Ordinary with-skill requests require the host's explicit command through `--invocation`.
Without-skill and implicit-invocation requests reject that option.
Implicit requests use the [scenario registry](../tests/eval/scenarios/scenarios.json)'s outcome request without a skill invocation.
Manual runs without an adapter do not stage the skill or verify discovery paths.
They retain unverified isolation even after human scoring.
`--manual` and `--adapter` cannot be combined; adapter starts capture the opening turn automatically.

Runs live under `tests/eval/results/runs/<timestamp-and-UUID>/` by default.
`--results <directory>` chooses another result directory on start, turn, close, score, correct, compare or selection validation.
Starting a manual run creates a fresh fixture and unique record, with UTC timestamps, source revision, agent, model, OS, tool versions, fixture revision, checkpoint, criteria hash and case results.
TypeScript fixtures also record npm and fixture-local TypeScript versions.
The fixture revision is a SHA-256 of the scenario's effective builder definition, selected source files, overlay and builder script.
Unrelated fixture changes do not invalidate the run.
Run a committed checkout when recording evidence.
Manual records initially have status `blocked` and no answers, transcript or case results.

## Current-host adapter and conversation

[codex.json](../tests/eval/adapters/codex.json) is the current-host adapter.
Its version 1 format extends the shared child-command object with `invocation` and `isolation`.
It requires `executable`, string-array `args`, `cwd: "."`, `versionArgs` and `timeoutMs` from 1 to 1800000.
It also requires `outputLimitBytes` from 1 to 16777216, bounding each captured output stream.
The Codex adapter allows ten-minute turns because real model revision turns exceeded two minutes during live board review.
The [final-stage adapter](../tests/eval/adapters/codex-final.json) allows thirty-minute turns because complete scaffold verification and protected-plan preparation exceeded ten minutes during C27 execution.
It captures up to 16 MiB per stream because the real JSONL board conversation exceeded the ordinary 64 KiB child-command capture.
Ordinary child-command capture retains its 64 KiB default and truncation behaviour.
Truncated evaluation output still blocks scoring and closes the isolated home.
This evaluation-only bound does not change installed skill command defaults.
Unknown fields and shell command strings are rejected.
`invocation` names the agent, model, explicit command, `codex-exec-jsonl` protocol and string-array `resumeArgs`.
`{message}` and `{sessionId}` are replaced only when they occupy whole arguments.
Both command forms require JSONL, the declared model, ignored user config and a separate process.
For `research-main-typescript` and `research-main-python`, the runner adds `-c agents.enabled=false` and disables `multi_agent`, `multi_agent_v2` and `multi_agent_v2_dynamic_tools` in both opening and resume arguments, before their positional arguments.
The effective adapter, including this restriction, is retained and hashed in each run; a restricted fallback cannot compare against an unrestricted baseline.
Other scenarios retain the supplied adapter's capability settings.
Before scoring fallback evidence, a capture-only probe must confirm that the actual native session no longer declares `spawn_agent`.
Sequential execution requested only through the prompt does not establish AC-35.
The [capture-only probe](../tests/eval/results/release/fallback-capability-probe.json) on Codex CLI 0.162.1 retained the switch in both argument forms, but the actual session still declared `spawn_agent` and reported that it was available.
The [corrected capture-only probe](../tests/eval/results/release/fallback-capability-probe-agents-disabled.json) additionally disabled the V2 features and set `agents.enabled=false`: the native declaration omitted `spawn_agent` and the assistant independently reported it unavailable, with zero tool calls.
The [configuration schema](https://learn.chatgpt.com/docs/config-schema.json) defines `agents.enabled` as the multi-agent tool control and notes that an enabled V2 setting takes precedence.
The capability prerequisite and both [corrected final fallback comparisons](../tests/eval/results/release/summary.md) pass under this effective adapter.
The opening command creates a new resumable thread, and later turns must retain that exact thread ID.
The installed CLI's `codex exec --help` and `codex exec resume --help` define its supported options.
The host interface follows the official [non-interactive execution documentation](https://developers.openai.com/codex/noninteractive/).
The recorded Linux host cannot start Codex's workspace sandbox because `bwrap` cannot configure its loopback interface.
The adapter therefore selects `danger-full-access` for both opening and resumed turns in the disposable fixture, while separately isolating host state and verifying skill discovery.
The resume command explicitly sets `sandbox_mode="danger-full-access"` instead of relying on the opening command's `--sandbox` option to carry over.
Every evaluation agent turn now runs in a disposable Docker container, providing a separate filesystem from the operator's host.
Build its pinned toolchain with `docker build --tag bstack-eval-toolchain:node24-codex0.162.1 --file tests/eval/container/Dockerfile tests/eval/container`.
The recipe pins the Node base image digest, Node 24.17.0, npm 11.13.0, Git 2.54.0 and Codex CLI 0.162.1.
It includes uv 0.12.22 from a pinned image digest, lavish-axi 0.1.78, chrome-devtools-axi 0.1.34, chrome-devtools-mcp 1.10.1 and Chromium for the Python and browser procedures.
Python fixtures use image-installed CPython 3.12.15 and their locked Ruff 0.14.0 dependency, cached during the image build.
Before their opening turn, the runner recreates the ignored virtual environment with `uv sync --locked --offline --python 3.12.15` inside the same two mounts and records that result.
This replaces interpreter links created by host fixture setup with image-local runtime links, without changing project files or downloading dependencies during the agent turn.
Git is also linked into the login shell's ordinary executable path.
Each `bstack-eval-*` container mounts only the disposable fixture and isolated home, both read-write at their original paths; it has no Docker socket, other host mounts, added capabilities, privileged mode, host networking or published ports.
The default bridge permits outbound model API traffic without exposing the host network namespace.
The runner inspects the created container before starting the agent and binds its immutable image ID, recipe hash, mounts and execution settings into `execution` in the run record.
It removes the exact named container after each turn, including client timeout or failure.
Every container, including fixture preparation and version queries, has `--cpus 2 --memory 4g` limits.
Before creating an adapter run's fixture or containers, the runner checks once for at least 20 GB free disk at the repository root and 24 GiB available memory, the budget for six concurrent containers.
The check uses Linux `MemAvailable` or `os.freemem()` on other platforms; it verifies capacity without reserving resources or coordinating concurrent starts.
Insufficient capacity blocks startup; start the run again when capacity is available.
Resumed turns do not repeat the host capacity check.
The existing throwaway-login procedure copies only the login file into the isolated home for the turn and deletes it in failure cleanup as well as success.

Every adapter turn also receives an explicit filesystem scope: the disposable fixture and its isolated home only.
The isolated home's `tmp` directory is created with mode `0700` and owns scratch files, clones and reports through `TMPDIR`, `TMP` and `TEMP`.
Access to the shared `/tmp` root is not allowed, including capacity queries; query the run's own directory instead.
Missing resources remain unavailable instead of prompting searches in the host home, ancestor directories, other projects or other skill installations.
Installed executable paths and system runtime resources remain available for normal tool execution.
Docker's verified mounts enforce host filesystem isolation.
The runner does not parse transcript commands or native file-tool calls for scope violations, and new runs do not record `scopeGuard` observations.
Contaminated transcripts may contain unrelated host inventories and must stay private.

```sh
npm run eval -- --scenario ambiguous-idea --mode without --stage baseline --adapter tests/eval/adapters/codex.json
npm run eval -- --scenario ambiguous-idea --mode with --stage baseline --adapter tests/eval/adapters/codex.json
npm run eval -- turn --run <id> --answer 1
npm run eval -- close --run <id>
npm run eval -- score --run <id> --answers answers.json --transcript tests/eval/results/runs/<id>/conversation.txt
```

Starting captures only the opening request.
The runner captures user messages, JSONL events and stderr in `conversation.txt`, including available command and file-open observations, subject to [evidence publication redaction](#evidence-publication).
Each turn also retains its child execution result and tool version in `run.json`.
Review the host's question and deliver the corresponding next scripted answer with `eval turn --answer`, using its one-based index.
This reviewer-driven delivery uses `codex exec resume` instead of guessing which prose question an answer addresses.
Do not send an answer merely because a turn completed.
If a question cannot be answered from the approved script, close the run, record the limitation and score the unmet outcome honestly.
The opening prompt never includes later scripted answers.
Every command returns immediately after its bounded child execution and remains blocked until human scoring.
At most one opening and one turn per scripted answer may succeed.
A failed, incomplete, malformed, truncated or wrong-session host result stays blocked and closes the isolated home.
Neither deterministic fake-host tests nor an unscored transcript claim an agent acceptance pass.

### Isolation and authentication

Every adapter run creates a new temporary home with mode 0700, an empty `.codex` state directory with mode 0700 and a fresh cache.
Child environment overrides set `HOME`, `USERPROFILE`, `CODEX_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `LOCALAPPDATA` without changing the invoking process.
The fixed Codex isolation format records `.agents/skills`, `.codex/skills`, `/etc/codex/skills` and the fixture's ancestor discovery paths.
These include the documented [Codex discovery locations](https://developers.openai.com/codex/skills/) and the legacy state-directory skill path.
Before execution and before closing or scoring, the runner inventories these paths and requires no skill named `repo-audit` in `without` mode.
Before the final checkpoint, `with` mode copies the current skill folder, including any built runtime resources, into the isolated home's `.agents/skills/repo-audit`.
Only that staged installation may be discoverable, and its authored-file snapshot must still match the staged bytes.
An inaccessible path or discovery through a symbolic link stays blocked for manual review.
Before the final checkpoint this staging is an evaluation helper, not the release installer.
At `--stage final`, with-skill adapter runs instead execute `install/install.mjs --scope user --host agents --json` with the isolated home and retain the completed result in `installer.json`.
The installer validates the complete package and pinned runtime; discovery and subsequent authored-file snapshots exclude `node_modules`.
Installer failure blocks the run before any agent turn.
Final requests explicitly name the active final checkpoint.
`final-new-project` and `final-existing-repo` cover the complete new-project and existing-repo paths respectively.
Re-audit, extension and maintenance use separate fresh conversations on the resulting maintained fixture.
The original intent and foundation scenarios retain their narrower approval scripts and are not full-path evidence.
Final adapter follow-ups can pass `--repo <disposable-maintained-root>` to reuse an explicit fixture rather than rebuild its original defects.
The record retains its starting commit and working-tree state, and the caller owns preservation and cleanup.
Use `final-independent-extension` in `without` mode for a fresh conversation with no discoverable repo-audit and only the resulting target guidance.
Use `final-maintained-maintenance` in `with` mode for a separate installed, bounded maintenance-only conversation on that maintained fixture.
Use `final-repeat-audit` for a fresh installed reassessment preserving the uncommitted user note.
The [scenario registry](../tests/eval/scenarios/scenarios.json) owns the scripted fixture author answers and their supervisor-delegated provenance; these do not change bstack product scope.
Bundled host system skills can remain available, but they cannot include repo-audit.

The captain approved `authentication: "throwaway-codex-login"` for this adapter on 2026-10-08.
Immediately before a host turn, the runner copies only the existing login file from the invoking user's `CODEX_HOME`, or its default home location, into the empty run state and sets the file mode to 0600.
It copies no configuration, skills or previous sessions.
Installer and host children inherit only runtime environment essentials, with fresh home/config/cache locations; provider credentials and unrelated parent environment are not forwarded.
The login copy is removed after every turn, including failure and timeout.
Only `authenticatedVia: "throwaway copy"` is recorded, never credential contents.
The fake-host tests use `authentication: "none"` or a dummy login created by the test.
If the invoking user's login is unavailable, the run is blocked, without attempting login or manufacturing a result.
Close each conversation immediately on completion with `eval close`, even if scoring will happen later.
Close verifies isolation, binds its proof to the captured conversation hash and deletes the entire isolated home.
Scoring a closed run checks that retained proof and hash, since the home is already gone.
Direct scoring also closes the home after its isolation check.
The caller removes the disposable fixture after preserving the run's output artifacts.

For a host without the supported conversation or isolation interface, use the manual start commands above, deliver the script in a fresh conversation and preserve the complete transcript and available discovery observations.
Keep unavailable interaction or isolation checks blocked with their specific reason and next prerequisite.
Do not substitute a one-shot prompt for later user answers or promote an unverified manual run into final acceptance evidence.

## Explicit manual scoring

### Existing-vision delta rubric

The T2.8 `existing-vision-delta` scenario retains an approved reading-queue vision and a newer approved personal-backup decision in design and history.
Score the candidate delta only when every item below is observed in the captured conversation.

- Discovery and cited evidence establish the missing accept/resist distinction before opening vision guidance.
- The proposal retains the existing purpose, save/find/mark-read commitments, local ownership and exclusions for accounts, sharing and recommendations.
- Exact candidate line edits add only personal backup of title, address and read status, with concrete accept/resist criteria.
- Review tests personal backup against sharing and ties any revision to the scripted author's reasoning.
- No project vision is replaced or applied without selection and approval of the exact revision.
- A missing browser, terminal feedback or board approval remains explicitly blocked, with scratch retained and no manufactured verdict.

This rubric scores an evidenced, reviewed candidate delta.
It does not turn scripted review of a candidate into a completed interactive board approval.
Full board interaction and the final release checkpoint remain separate evidence.
Compare `existing-repo` and `existing-repo-python` findings for actual differences in goals, ownership and native checks, rather than counting vocabulary changes.
The `clear-goals` loading score uses observed command/file-open events, never a search of the skill's source as proof of interpretation.

Create a scoring answers file using the checklist IDs printed by the run.
Every check needs a Boolean verdict and a one-based inclusive line range in the transcript, whether it passed or failed.
The reviewer is responsible for the judgement and for identifying unavailable observations as a failed check with the limitation in the transcript.
Reviewer identities must contain at least three characters and cannot be purely numeric.
Checks use human, machine or judge scoring.
An optional `machine` object names a deterministic assertion: `fixtureUnchanged`, `opened`, `notOpened`, `installerPassed`, `command`, `citeCheck`, `filesEqual` or `contains`.
Opened-path assertions take `patterns` with Node path glob syntax over captured command and file-tool events; a missing access trace cannot pass.
Commands take `executable` and `args`; citation checks take `report`, with `$HOME/` resolved inside the isolated home.
File comparisons take `paths`; content checks take `path` and `text`.
The runner captures fixture bytes and Git status before the conversation and evaluates assertions once after the last scripted answer, using `docker exec` in the live subject container before cleanup.
Host turns, native commands and citation reruns execute inside that container with its configured mounts and limits.
The citation grader is staged in private scratch only after the subject finishes and removed after grading, including for without-skill baselines.
Reviewer answers may omit machine check IDs, and supplied machine verdicts are replaced by captured results.
Manual hosts cannot supply machine evidence.
Mixed checks keep their conversation judgement separate from deterministic outcomes.
Fixture sanity remains deterministic in the existing builder and does not substitute for agent observations.

```json
{
  "schemaVersion": 1,
  "runId": "<printed-run-id>",
  "reviewer": "Reviewer name",
  "checks": [{ "id": "decision", "passed": true, "startLine": 1, "endLine": 2 }]
}
```

```sh
npm run eval -- score --run <id> --answers answers.json --transcript transcript.txt
```

Missing files, empty transcripts, incomplete or duplicate check IDs, non-Boolean verdicts, wrong run IDs and out-of-range citations leave the run blocked.
The runner never waits for missing manual evidence.
Successful scoring publishes redacted answers and transcript copies in a unique scoring artifact folder and records the anonymous reviewer placeholder and transcript location for every check.
For adapter runs, scoring also replaces the retained conversation with the redacted scoring transcript and updates its conversation hash.
All yes answers produce a passing score, and any no answer produces a failing score.
A scored run cannot be rescored.
Create a new run to retain earlier checkpoints and scoring history.
An identified grading error can instead receive one append-only correction without repeating an unchanged agent run:

```sh
npm run eval -- correct --run <id> --correction correction.json
```

The input contains `corrector`, `reason`, `evidence` with transcript `startLine` and `endLine`, and the complete corrected `checks` array.
The command creates `score-correction.json` with hashes of the original answers and transcript, preserving the original run and scoring files byte for byte.
It refuses overwrite, unchanged assessments, invalid evidence lines or stale original bindings.
Comparisons and acceptance use the validated correction; the original remains historical evidence.
AC-29 credit additionally requires captured successful Node unit execution with a positive pass count and zero failures, either directly or in a captured `run-checks` result.
An assistant assertion, unrun command or failed suite cannot establish that prerequisite.
Pass and fail describe the human score, with any isolation limitation retained in the record.
Adapter scoring requires completed host turns and the exact captured conversation, and retains the isolation proof taken before deletion.

```sh
npm run eval -- compare --without <baseline-id> --with <with-skill-id>
```

Comparison requires the same scenario, fixture revision, agent, model, checkpoint and criteria hash.
Adapter comparisons also require the same adapter hash, preserving execution settings across modes.
They require verified container execution, subject to the [approved archived baseline exception](#registry-and-final-selections).
When both runs have container execution records, their image ID, recipe hash and toolchain must match.
The scenario fixture, built fixture name, outcome request, ordered scripted answers and invocation mode must also match.
No previously passing check may fail with the skill.
At least one more check must pass with the skill, unless every check already passed in the baseline and still passes.
Unscored or incomparable runs stay blocked.

### Evidence publication

The runner redacts captured conversations, manual and closed run records, and every scoring transcript and answers copy using the local host's actual user and group names, fixture and home paths, scratch paths and thread identifiers.
Scoring also redacts the supplied reviewer identity in string values, including decoded JSON strings, and always publishes reviewer fields as `[redacted: user name]`.
JSON property names are retained, and transcript line breaks and citation ranges are preserved.
Conversation hashes bind the published bytes.

Open, unscored adapter run records retain private operational paths and session identifiers for resume and isolation checks, and must not be committed.
Manual scoring leaves the supplied source answers and transcript files unchanged; keep those private and commit only their redacted publication copies.

## Registry and final selections

```sh
node scripts/acceptance.mjs --check-registry
```

`tests/acceptance/cases.json` registers every numbered design acceptance case with an owner task, criterion source, evidence type and procedure.
`docs/design.md#AC-N` is a logical locator for numbered case N under the design's Acceptance cases heading.
`ownerTask` is a nonempty array of task IDs matching every assignment for that case in the implementation plan's procedure table.
Evidence types are `automated`, `agent` or `manual`.
A planned procedure has `status: planned` and a nonempty `description`.
A completed procedure has `status: completed`, `path`, `name` and nonempty `artifacts`.
Automated procedures name a registered suite and an exact test name, including table-driven names.
Registry validation executes that test through Node's test runner and rejects missing, skipped, todo or failing tests.
Agent and manual procedures name `tests/eval/scenarios/scenarios.json` and an existing scenario ID.
That scenario must contain a check for the registered acceptance case.
Completed procedure and artifact paths must exist as nonempty files.
Registry validation proves registration and definitions, and reports zero passed cases.
It never scores planned or completed definitions as acceptance evidence.
`--registry <file>` validates an alternate registry with the same repository authorities.

Final evidence explicitly selects a run for each case, checkpoint and source revision.
Never select by directory order, newest timestamp or number of repeated artifacts.

```json
{
  "schemaVersion": 1,
  "selections": [{
    "caseId": "AC-2",
    "stage": "final",
    "revision": "<full-source-commit>",
    "runId": "<printed-run-id>"
  }]
}
```

```sh
node scripts/acceptance.mjs --selections selections.json
```

Duplicate selections for the same case, checkpoint and revision are rejected even when they name the same run.
Every selected run must match that identity, have passing results for all checks of that case, retain its scoring artifacts and have verified host isolation.
All C7a manual runs therefore remain blocked as final acceptance evidence.
This command validates the supplied selections, not coverage of an entire release.
T5.2 owns complete release evidence, including automated cases and with-skill baseline comparison.

```sh
node scripts/acceptance.mjs --results tests/eval/results --require-complete
```

Complete validation reads `release/manifest.json` beneath the results directory.
Its version 1 format contains `cases` with one `{caseId, runId}` selection per agent or manual case except AC-46, and `comparisons` with one `{scenario, without, with}` pair per scenario.
AC-46 is established by all scenario comparisons together.
The independent extension is the approved without-only exception: its AC-64 procedure requires that repo-audit be undiscoverable.
All other selected cases must use the with-skill run of their declared final comparison.
The validator rejects incomplete registry procedures, duplicate or missing selections, stale fixture or scenario inputs, changed execution inputs, unsupported adapter settings, unverified scope or cleanup, and scored claims without matching retained transcript locations.
Execution bindings include unchanged package, installer, fixtures, host adapter implementation, effective adapter, exact request/scripted answers and tool versions.
The approved scope rerun retains the exact successful `scope-and-prerequisites` baseline `2026-10-11T19-10-46.903Z-8014183b-8ca5-4060-b239-5c8f9c176a89`, bound by its complete record hash.
Both `eval compare` and complete release validation accept only these exact archived record bytes without a container execution record; historical `scopeGuard` fields do not establish verified execution.
Its fixture, scoring criteria, request and tool versions must still match the container run.
All other final runs require verified container execution and unchanged host runner, container runner and image recipe inputs.
Grader-only repairs do not require repeating unchanged agent turns.
Package and installer changes invalidate with-skill captures; verified without-skill baselines remain comparable because those inputs were absent from their isolated execution.
Every final capture must complete all ordered scripted answers.
Historical process-only runs remain diagnostic history; no failed scope run is retroactively credited.
Every with-skill run must pass every check, and each pair must satisfy the design's improvement and regression rule.
Automated procedures execute their exact named tests against the current inputs, including the clean-checkout procedure and real Linux lifecycle execution.
Only complete passing evidence can produce the 75-case release result.

The commands reuse the shared schema, joining-ID, fingerprint, child-command and result libraries.
Their options parser has no target argument because evaluation creates targets through the fixture builder.
`--json` emits the version 1 result envelope.
Exit codes follow the shared contract: 0 passed, 1 failed, 2 blocked and 3 usage error.
`--help` prints usage and exits 0.

## Verification

`npm test -- --task T1.2` selects the registry and evaluation command suites.
They cover registration failures, incomplete manual evidence, explicit transcript scoring, history paths, invocation requests, final selection blocking and the baseline comparison rule.
They also cover fresh host state, discovery absence, resource staging, resumed scripted answers, transcript identity, authentication-copy cleanup and host failure paths.
Fake executables test the conversation boundary without spending model quota.
Task evidence records these interface checks separately from actual baseline procedures.

## Recorded initial baseline

Three scored `without` runs used Codex CLI 0.160.1, `gpt-6.1-sol`, Node 24 and Linux at the baseline checkpoint.
Before commit, baseline transcripts and every corresponding evidence copy are redacted for host paths, user and host names, out-of-fixture workspace inventories and host thread IDs.
Run-local markers retain distinct fixtures, isolated homes and conversations without publishing their original identifiers.
Redaction preserves JSONL events, transcript line numbers, commands, observations, reviewer verdicts and citations; conversation hashes bind the redacted bytes.
These are historical observations rather than byte-identical raw host logs, and cannot be used to resume their deleted host sessions.
All three retain distinct fixture paths, homes, thread IDs, transcripts and scoring artifacts.
Their fixture revision is `e15b941cb5ab07e9a1f99ce492a3a891c8cac91b`, and each preserves its registered criteria hash and the same adapter hash.
The [T1.2 task evidence](../tests/eval/results/tasks/T1.2.json) names their complete run records and transcript locations.

- Ambiguous-idea passed its unresolved-decision check after the corresponding scripted reply.
- New-idea failed all three checks: no intent interview, browser local storage included in its domain-term section, and a VISION declared approved without approval from the scripted user.
  The generated VISION is retained alongside the conversation.
  No scripted answer was sent because the agent asked no corresponding question.
- Clear-goals passed both checks by reusing the approved repo documents without repeating settled questions or opening a skill reference.
  Its trace includes a broad parent-directory filename search that the host interrupted, followed by recommendations based on the fixture documents.
  This observation is retained, not concealed or turned into an extra scoring criterion.

The first workspace-sandbox attempt stays blocked in the history with its real `bwrap` failure.
It is not one of the three scored baselines.
No baseline was required to fail, and the passing scenarios remain in the evaluation.
These are initial development observations, not final released-skill acceptance or a host and operating-system support matrix.

## First procedure checkpoint

The early T3.1 reference checkpoint supplies enforcement and architecture guidance before foundation integration.
Its [two-stack relevance rubric](../tests/eval/results/tasks/T3.1.verification.md) records a completed manual review of ts-shop and py-ledger, including distinct scopes, reused standards and signals that are not violations.
`npm test -- --task T3.1` validates package behaviour only.
The [task record](../tests/eval/results/tasks/T3.1.json) retains command execution evidence and limits.
This review does not establish final agent acceptance, native rule-proof or maintenance.

T1.3 supplies the bounded SKILL.md procedure and the [baseline gap map](../tests/eval/results/gap-map.md).
The map covers all three new-idea failures and retains ambiguous-idea and clear-goals as required passing scenarios.
No real agent sessions or ablation runs were added in this slice, and no advice was removed.
`npm test -- --task T1.3` reuses the existing package and metadata suites.
These checks validate packaging and the command surface, not the effectiveness of natural-language instructions.
The baseline-to-guidance review is recorded separately in [task evidence](../tests/eval/results/tasks/T1.3.json).
See [README](../README.md) for current procedure availability and [SKILL.md](../skills/repo-audit/SKILL.md#load-when) for conditional reference loading.
The interview checkpoint in T1.7 and subsequent foundation and final evaluations own their actual execution evidence.

## Intent checkpoint (C10b)

Two real with-skill Codex runs used --stage intent and the existing throwaway-login adapter.
Each run used a fresh private home and a non-Git fixture workspace.
The login copy was removed after every turn, and both homes were deleted immediately on close before transcript scoring.
The [ambiguous-idea summary](../tests/eval/results/intent-C10b/ambiguous-idea/summary.json) records a passing unresolved-decision check after the scripted answer.
The agent explained offline and online consequences while keeping the foundation blocked and selecting no stack.
The [new-idea summary](../tests/eval/results/intent-C10b/new-idea/summary.json) records interview and domain-term checks passing, with vision failing.
Its first scripted answer did not settle the proposed first-journey meaning, and the resumed agent reported read-only/unavailable terminal execution.
The transcript contains no failed child-command event supporting that report, so it remains a host-reported limitation.
No board verdict, revised scratch vision or author approval was obtained, and no remaining scripted approval was sent against an absent draft.
Both workspaces still contain only brief.md with bytes matching their fixture source and no Git directory.
The summaries record the actual implementation revisions evaluated, tool versions, turn outcomes, scoring citations and isolation cleanup.
Captured JSONL transcripts retain their line numbers with host paths, user names and thread IDs redacted.
These observations are intent checkpoint evidence, not final acceptance selections or complete project creation.
At this earlier checkpoint, T1.7 was blocked until the new-idea journey and board and scratch approval flow could complete on an available host.

## Phase 1 E2E follow-up

The [Phase 1 validation](../tests/eval/results/phase1-check/summary.md) records the corrected shopping-list answer and retained Codex resume permissions.
That summary owns the supported-flow observations, synthetic live board evidence, superseded experiment and historical verification counts.
See [build progress](implementation-plan.md#progress) for the remaining task prerequisites.

## Completed intent checkpoint (C11a prerequisite)

The [fresh scored new-idea run](../tests/eval/results/intent-C11a/full-capture/summary.md) completed the real shipped board workflow, semantic revision, glossary and explicit saved-revision approval.
The scripted fixture author supplied per-card verdicts and final approval through the shipped UI, using chrome-devtools-axi in a task-specific browser session.
Both real host turns exited 0 without timeout or truncation.
Close verified isolation and deleted the private home before scoring, which passed all three scenario checks.
The original brief-only workspace remained unchanged and non-Git.
The earlier passing ambiguous-idea procedure remains valid intent-stage evidence.
At this checkpoint, T1.7 was complete, while protected project creation and final acceptance remained later tasks.
The preceding blocked browser, timeout and capture attempts are retained as historical evidence, not promoted into this pass.
Redacted transcripts preserve line citations and conversation hashes bind the retained redacted bytes.

## Discovery checkpoint (C11a)

The scenarios `research-main-typescript`, `research-main-python` and `research-subagents` use `--stage discovery` with the existing isolated adapter.
The two main-thread evaluations use a scratch adapter adding `--disable multi_agent`, preserving the shipped model, authentication and capture settings.
The subagent evaluation uses the shipped adapter and observes the tools actually available to the host.
Unsupported subagent mode remains blocked rather than being credited for sequential execution.
Each scenario requests the same five-brief report outside the fixture, source review, a shipped citation check and no fixture writes or native checks.
Web access is unavailable by the scripted author's constraint; these runs do not claim a network sandbox.
Language and outside recommendations retain repo evidence and explicitly say "not researched" with the reason.
The [discovery summary](../tests/eval/results/discovery-C11a/summary.md) records actual modes, host capabilities, per-turn outcomes, scoring and cleanup.
Additional task-local session excerpts preserve actual delegation events omitted from Codex exec JSONL output.
The transcript and worker traces establish overlapping read-only work and the main thread's citation verification.
This evidence is discovery-only and does not establish full audit execution or approved recommendations.
