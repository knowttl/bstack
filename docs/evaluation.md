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
It requires `executable`, string-array `args`, `cwd: "."`, `versionArgs` and `timeoutMs` from 1 to 120000.
Unknown fields and shell command strings are rejected.
`invocation` names the agent, model, explicit command, `codex-exec-jsonl` protocol and string-array `resumeArgs`.
`{message}` and `{sessionId}` are replaced only when they occupy whole arguments.
Both command forms require JSONL, the declared model, ignored user config and a separate process.
The opening command creates a new resumable thread, and later turns must retain that exact thread ID.
The installed CLI's `codex exec --help` and `codex exec resume --help` define its supported options.
The host interface follows the official [non-interactive execution documentation](https://developers.openai.com/codex/noninteractive/).

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
`--manual --adapter` prepares isolated state without executing the host.
`eval turn --run <id>` can subsequently capture its opening request without an answer index.
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
