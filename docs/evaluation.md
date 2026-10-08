# Evaluation contract

C7a implements the T1.2 acceptance registry and manual evaluation interface.
C7b owns the host adapter, verified isolation, automatic conversation delivery and recorded baseline.
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
Until C7b, the runner does not stage the skill or verify its discovery paths, and every manual run records isolation as unverified.
Automatic execution is blocked.

Runs live under `tests/eval/results/runs/<timestamp-and-UUID>/` by default.
`--results <directory>` chooses another result directory on start, score, compare or selection validation.
Starting a manual run creates a fresh fixture and unique record, with UTC timestamps, source revision, agent, model, OS, tool versions, fixture revision, checkpoint, criteria hash and case results.
TypeScript fixtures also record npm and fixture-local TypeScript versions.
The fixture revision is the committed `tests/fixtures` Git tree, so skill-only commits do not prevent comparison.
Run a committed checkout when recording evidence.
Manual records initially have status `blocked` and no answers, transcript or case results.

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
Pass and fail describe the human score, with the isolation limitation retained in the record.

```sh
npm run eval -- compare --without <baseline-id> --with <with-skill-id>
```

Comparison requires the same scenario, fixture revision, agent, model, checkpoint and criteria hash.
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

## C7a verification

`npm test -- --task T1.2` selects the registry and evaluation command suites.
They cover registration failures, incomplete manual evidence, explicit transcript scoring, history paths, invocation requests, final selection blocking and the baseline comparison rule.
Task evidence records these interface checks separately from unbuilt isolation and baseline procedures.
