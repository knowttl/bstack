# Evaluation contract

C7a implements the T1.2 acceptance registry and manual evaluation interface.
C7b adds the current-host Codex adapter, verified discovery isolation, captured conversation turns and baseline runs.
No C7a manual score proves host isolation or an acceptance case for the released skill.

## Scenarios and runs

`tests/eval/scenarios/scenarios.json` is version 1.
Each scenario names a fixture registered by the existing builder, an outcome request, an ordered answer script, allowed checkpoints, invocation mode and yes-or-no checks.
Each check has a unique ID, design acceptance ID and scoring question.
The initial scenarios cover new ideas, ambiguous ideas, a seeded existing repo, clear goals and implicit invocation.
Maintenance and representative-extension scenarios are defined before their later owning tasks use them.
An approved scenario stays in the evaluation even when its baseline passes.

```sh
npm run eval -- --manual --scenario ambiguous-idea --mode without --stage baseline --agent <agent> --model <model>
npm run eval -- --manual --scenario ambiguous-idea --mode with --stage baseline --agent <agent> --model <model> --invocation /repo-audit
```

The runner calls the existing fixture builder and prints the fixture path, request, answer script and checklist in its run record.
The caller owns removal of the temporary fixture after the session.
Use a fresh conversation and preserve the complete conversation, including user answers and any available file-open record, as a UTF-8 transcript.
Deliver the scripted answers when the agent asks the corresponding questions.
Do not treat a one-shot prompt as delivery of later answers.
Ordinary with-skill requests require the host's explicit command through `--invocation`.
Without-skill and implicit-invocation requests reject that option.
The implicit request is exactly `audit this repo`.
Manual runs without an adapter do not stage the skill or verify discovery paths.
They retain unverified isolation even after human scoring.
`--manual` and `--adapter` cannot be combined; adapter starts capture the opening turn automatically.

Runs live under `tests/eval/results/runs/<timestamp-and-UUID>/` by default.
`--results <directory>` chooses another result directory on start, turn, close, score, compare or selection validation.
Starting a manual run creates a fresh fixture and unique record, with UTC timestamps, source revision, agent, model, OS, tool versions, fixture revision, checkpoint, criteria hash and case results.
TypeScript fixtures also record npm and fixture-local TypeScript versions.
The fixture revision is the committed `tests/fixtures` Git tree, so skill-only commits do not prevent comparison.
Run a committed checkout when recording evidence.
Manual records initially have status `blocked` and no answers, transcript or case results.

## Current-host adapter and conversation

[codex.json](../tests/eval/adapters/codex.json) is the current-host adapter.
Its version 1 format extends the shared child-command object with `invocation` and `isolation`.
It requires `executable`, string-array `args`, `cwd: "."`, `versionArgs` and `timeoutMs` from 1 to 600000.
It also requires `outputLimitBytes` from 1 to 16777216, bounding each captured output stream.
The Codex adapter allows ten-minute turns because real model revision turns exceeded two minutes during live board review.
It captures up to 16 MiB per stream because the real JSONL board conversation exceeded the ordinary 64 KiB child-command capture.
Ordinary child-command capture retains its 64 KiB default and truncation behaviour.
Truncated evaluation output still blocks scoring and closes the isolated home.
This evaluation-only bound does not change installed skill command defaults.
Unknown fields and shell command strings are rejected.
`invocation` names the agent, model, explicit command, `codex-exec-jsonl` protocol and string-array `resumeArgs`.
`{message}` and `{sessionId}` are replaced only when they occupy whole arguments.
Both command forms require JSONL, the declared model, ignored user config and a separate process.
The opening command creates a new resumable thread, and later turns must retain that exact thread ID.
The installed CLI's `codex exec --help` and `codex exec resume --help` define its supported options.
The host interface follows the official [non-interactive execution documentation](https://developers.openai.com/codex/noninteractive/).
The recorded Linux host cannot start Codex's workspace sandbox because `bwrap` cannot configure its loopback interface.
The adapter therefore selects `danger-full-access` for both opening and resumed turns in the disposable fixture, while separately isolating host state and verifying skill discovery.
The resume command explicitly sets `sandbox_mode="danger-full-access"` instead of relying on the opening command's `--sandbox` option to carry over.
This is discovery and conversation isolation, not an operating-system security boundary.

```sh
npm run eval -- --scenario ambiguous-idea --mode without --stage baseline --adapter tests/eval/adapters/codex.json
npm run eval -- --scenario ambiguous-idea --mode with --stage baseline --adapter tests/eval/adapters/codex.json
npm run eval -- turn --run <id> --answer 1
npm run eval -- close --run <id>
npm run eval -- score --run <id> --answers answers.json --transcript tests/eval/results/runs/<id>/conversation.txt
```

Starting captures only the opening request.
The runner preserves the exact user messages, JSONL events and stderr in `conversation.txt`, including available command and file-open observations.
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
In `with` mode it copies the current skill folder, including any built runtime resources, into the isolated home's `.agents/skills/repo-audit`.
Only that copy may be discoverable, and its complete file snapshot must still match the staged bytes.
An inaccessible path or discovery through a symbolic link stays blocked for manual review.
This staging is an evaluation helper, not the release installer.
Bundled host system skills can remain available, but they cannot include repo-audit.

The captain approved `authentication: "throwaway-codex-login"` for this adapter on 2026-10-08.
Immediately before a host turn, the runner copies only the existing login file from the invoking user's `CODEX_HOME`, or its default home location, into the empty run state and sets the file mode to 0600.
It copies no configuration, skills or previous sessions.
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

Create a scoring answers file using the checklist IDs printed by the run.
Every check needs a Boolean verdict and a one-based inclusive line range in the transcript, whether it passed or failed.
The reviewer is responsible for the judgement and for identifying unavailable observations as a failed check with the limitation in the transcript.
All current scenario checks are human scored.
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
Successful scoring copies the answers and transcript into a unique scoring artifact folder and records reviewer and transcript locations for every check.
All yes answers produce a passing score, and any no answer produces a failing score.
A scored run cannot be rescored.
Create a new run to retain earlier checkpoints and scoring history.
Pass and fail describe the human score, with any isolation limitation retained in the record.
Adapter scoring requires completed host turns and the exact captured conversation, and retains the isolation proof taken before deletion.

```sh
npm run eval -- compare --without <baseline-id> --with <with-skill-id>
```

Comparison requires the same scenario, fixture revision, agent, model, checkpoint and criteria hash.
Adapter comparisons also require the same adapter hash, preserving execution settings across modes.
The scenario fixture, built fixture name, outcome request, ordered scripted answers and invocation mode must also match.
No previously passing check may fail with the skill.
At least one more check must pass with the skill, unless every check already passed in the baseline and still passes.
Unscored or incomparable runs stay blocked.

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
T1.7 is complete at this checkpoint, while protected project creation and final acceptance remain later tasks.
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
