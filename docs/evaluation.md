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
Deliver scripted answer i after turn i completes, in order, even when the agent did not ask the expected question.
Preserve every delivered answer in the transcript and end the conversation after the final answer's turn completes.
Do not treat a one-shot prompt as delivery of later answers.
Ordinary with-skill requests require the host's explicit command through `--invocation`.
Without-skill and implicit-invocation requests reject that option.
Implicit requests use the [scenario registry](../tests/eval/scenarios/scenarios.json)'s outcome request without a skill invocation.
Manual runs without an adapter do not stage the skill or verify discovery paths.
They retain unverified isolation even after scoring.
`--manual` and `--adapter` cannot be combined; adapter starts capture the opening turn automatically.

Runs live under `tests/eval/results/runs/<timestamp-and-UUID>/` by default.
`--results <directory>` chooses another result directory on start, turn, close, score, correct, compare or selection validation.
Starting a manual run creates a fresh fixture and unique record, with UTC timestamps, source revision, agent, model, OS, tool versions, fixture revision, checkpoint, criteria hash and case results.
TypeScript fixtures also record npm and fixture-local TypeScript versions.
The fixture revision is a SHA-256 of the scenario's effective builder definition, selected source files, overlay, fixture sanity script and builder script.
It also binds the source fixture's sanity script when the selected sanity script imports it.
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
The recipe pins the Node base image digest, Node 24.17.0, npm 11.13.0, Git 2.54.0, Codex CLI 0.162.1 and Claude Code 2.1.296.
It includes uv 0.12.22 from a pinned image digest, lavish-axi 0.1.78, chrome-devtools-axi 0.1.34, chrome-devtools-mcp 1.10.1 and Chromium for the Python and browser procedures.
Python fixtures use image-installed CPython 3.12.15 and their locked Ruff 0.14.0 dependency, cached during the image build.
Before their opening turn, the runner recreates the ignored virtual environment with `uv sync --locked --offline --python 3.12.15` inside the same two mounts and records that result.
This replaces interpreter links created by host fixture setup with image-local runtime links, without changing project files or downloading dependencies during the agent turn.
Git is also linked into the login shell's ordinary executable path.
Each `bstack-eval-*` container mounts only the disposable fixture and isolated home, both read-write at their original paths; it has no Docker socket, other host mounts, added capabilities, privileged mode, host networking or published ports.
The default bridge permits outbound model API traffic without exposing the host network namespace.
The runner inspects the created container before starting the agent and binds its immutable image ID, recipe hash, mounts and execution settings into `execution` in the run record.
It removes the exact named container after each turn, including client timeout or failure.
Fixture preparation and version queries execute in the subject container under its `--cpus 2 --memory 4g` limits.
Before creating a standalone adapter run's fixture or containers, the runner checks once for at least 20 GB free disk at the repository root and 24 GiB available memory, the budget for six concurrent containers.
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
Deliver the next scripted answer with `eval turn --answer`, using its one-based index, or let `eval batch` deliver every answer automatically.
Delivery uses `codex exec resume` and follows the script order after each completed turn.
An answer delivered without the expected question remains visible in the transcript and must be scored honestly.
The opening prompt never includes later scripted answers.
Every command returns after its bounded child execution, including final-turn machine assertions, and remains blocked until explicit scoring.
At most one opening and one turn per scripted answer may succeed.
A failed, incomplete, malformed, truncated or wrong-session host result stays blocked and closes the isolated home.
Neither deterministic fake-host tests nor an unscored transcript claim an agent acceptance pass.

### Automatic batches and ledger

```sh
npm run eval -- batch --tier smoke --mode without --adapter tests/eval/adapters/codex-final.json --repeat 5 --concurrency 6
npm run eval -- batch --tier full --scenario selected-apply-verify --mode without --adapter tests/eval/adapters/codex-bulk.json --repeat 5 --concurrency 2
npm run eval -- batch --batch <id>
```

`--tier smoke` selects existing-repo, existing-repo-python, clear-goals, ambiguous-idea, implicit-invocation, verification-limitations, scope-and-prerequisites, research-main-typescript, maintenance and selected-rule-relocation.
`--tier full` selects every registered scenario.
An optional comma-separated `--scenario` subset must stay within the selected tier.
Each scenario owns its `tier` value, `smoke` or `full`; the full batch tier includes both values.
The long `final-existing-repo`, `final-new-project` and `representative-extension` paths stay in the full tier only.
The full tier also includes `selected-apply-verify`, the bounded apply half of the existing-repo path; `existing-repo` already covers its audit half.
The smoke gate uses the release-model [final adapter](../tests/eval/adapters/codex-final.json).
The [bulk adapter](../tests/eval/adapters/codex-bulk.json) configures cheaper full-tier repetitions.
These adapter files own the model and effort for both opening and resumed turns; record the actual release model in the release notes.
For each bulk scenario, separately capture one release-model anchor with `--tier full --scenario <id> --adapter tests/eval/adapters/codex-final.json --repeat 1`, using the same mode and checkpoint.
The runner does not create anchors automatically, and a single anchor does not replace the repeated smoke measurements.
An adapter declaring `"tier": "full"` is rejected by smoke batches before any host starts.
Bulk and release-model runs require their own matching baselines and remain separate ledger series through model and adapter hashes.
`--mode` and `--adapter` are required; `--repeat` defaults to 5 and must be a positive integer.
Each scenario's `fixture` declares its starting state; an optional `mode` constraint overrides the requested mode for that scenario.
`--concurrency` defaults to 6 and must be between 1 and 6, matching the container resource budget.
The runner checks free disk and available memory once before creating batch resources, requiring 20 GB free disk in total and 4 GiB available memory per concurrency slot.
`--stage` defaults to each scenario's last checkpoint, including discovery for research scenarios, and an explicit checkpoint must be supported by every selected scenario.
The batch records one candidate commit and rejects aggregation across changed candidate, fixture, criteria, adapter, model or checkpoint inputs.

Each run starts with only its opening request, delivers scripted answer i after turn i completes, and closes after the last reply.
Failed host turns stop that run and close its isolated home; other batch jobs continue.
Every attempt remains in the batch, including failed captures and failed checks.
The batch ID, all run IDs and errors are saved beneath the results directory in `batches/<id>.json`.
This private operational inventory also retains each run's fixture path in `fixtures`, so callers can preserve outputs and remove the disposable repositories after conversations close.
The runner persists each run and fixture location before starting its isolated conversation, serializing concurrent inventory updates so interruption leaves a readable inventory.
Do not publish the private inventory; public run evidence and ledger entries redact fixture locations.
Machine check counts appear immediately in the command result, alongside pending semantic counts.
The command remains blocked until every run has valid explicit scoring and verified cleanup.
Use `eval score` with each run's captured `conversation.txt` and semantic answers, then run `eval batch --batch <id>` with the same `--results` directory to finalize without new captures.
Machine answers continue to come from captured assertions, regardless of supplied reviewer answers.
Use the [judge command](#judge-command) to prepare semantic answers; batch capture and finalization never invent semantic grades.
Failed captures leave the ledger unpublished and require a fresh batch.

Finalization appends one JSONL line per candidate, tier, scenario, mode and check to `tests/eval/results/ledger.jsonl` by default, or `<results>/ledger.jsonl` for an explicit results directory.
Each line records `date`, `candidate`, `tier`, `model`, `adapterHash`, `fixtureHash`, `criteriaHash`, `scenario`, `mode`, `check`, `caseId`, `passes`, `runs` and every contributing `runIds` value.
All repetitions contribute; there is no run selection manifest for batches.
Finalizing unchanged scores again appends nothing.
Published grades cannot be overwritten by re-finalizing changed scores; preserve the ledger and capture a fresh batch.
Ledger writers use an exclusive lock; a competing finalization returns blocked and can be rerun after the writer finishes.
On SIGINT, SIGTERM or SIGHUP, the owning writer finishes any active ledger I/O, releases its lock and exits with the signal's conventional exit code.
After an uncatchable termination such as SIGKILL or a crash, confirm that the interrupted writer has exited and stop other finalizers before recovery.
Inspect the ledger for complete JSONL records; preserve an incomplete or damaged ledger for review rather than modifying published records.
If the ledger is intact, remove only the orphaned empty `ledger.jsonl.lock` directory with `rmdir`, then retry finalization; unchanged published records are not appended again.
Never remove a lock while its writer is still running.
Batch publication records rates, including failing checks, and does not establish a release verdict.
Unsupported hosts retain the `--manual` interface.

### Evidence storage and raw-run archive

For new batches, commit the append-only `tests/eval/results/ledger.jsonl` and the gate outputs in `tests/eval/results/release/`.
Commit only redacted transcripts of blocking runs and the audited sample (one run per smoke scenario) under `tests/eval/results/transcripts/<run-id>/`, retaining run IDs and transcript hashes so reviewers can join them to the ledger.
Do not commit whole run directories, scoring work files or private batch inventories.
The default `tests/eval/results/runs/` and historical `tests/eval/results/release/runs/` locations are ignored for new files.
Existing tracked historical evidence remains available for acceptance references and judge calibration; this policy does not rewrite it.
An explicit `--results` directory is caller-owned: keep it outside Git or under `.cache/`, and copy its finalized ledger to the committed results directory.
Run the release gate with `--results` pointing to that same private directory, where contributing run directories sit beside its ledger.
Keep prior gate outputs in its `release/` directory for regression comparison, and copy the new gate output to `tests/eval/results/release/` for publication.
Copying the ledger alone does not make the default release-gate command usable: its contributing run records must also be available under `tests/eval/results/runs/`.

After scoring, finalizing all batches and writing the release gate, archive the default raw-run directory locally before any cleanup:

```sh
mkdir -p .cache/eval-archives
tar -czf .cache/eval-archives/raw-runs-<version>.tar.gz -C tests/eval/results runs
tar -tzf .cache/eval-archives/raw-runs-<version>.tar.gz
git status --short --untracked-files=all -- tests/eval/results
```

Use a new archive name each time, and verify that its listing includes the batch inventories, contributing run IDs, conversations and scoring artifacts.
For explicit `--results`, archive that entire directory instead.
Keep the archive private: inventories and unfinished runs can contain local paths and session identifiers.
Retain the local raw evidence for confirmation, correction and audit; the release validator reads contributing run records under `runs/` for the default results directory, or beside the ledger for an explicit results directory.
The archive is a backup and does not replace the validator's input directory.
After a fresh batch without sampled transcripts, Git status should show only the ledger and gate files.

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
`selected-apply-verify` starts from `selected-ts-shop`; the [fixture construction contract](fixtures.md) owns its seeded state.
Its single scripted answer approves the exact generated protected-write diff; plan approval alone never approves those bytes.
It covers AC-16, AC-28, AC-30, AC-54 and AC-61 without repeating the audit or claiming full-path evidence.
Re-audit, extension and maintenance use separate fresh conversations on the resulting maintained fixture.
Their declared `maintained-ts-shop` starting state follows the [fixture construction contract](fixtures.md), built afresh per run.
The original intent and foundation scenarios retain their narrower approval scripts and are not full-path evidence.
Final adapter follow-ups can pass `--repo <disposable-maintained-root>` to reuse an explicit fixture rather than rebuild its original defects.
The record retains its starting commit and working-tree state, and the caller owns preservation and cleanup.
Use `final-independent-extension` in `without` mode for a fresh conversation with no discoverable repo-audit and only the resulting target guidance.
Its scenario mode constraint keeps repo-audit undiscoverable even when a batch requests `--mode with`, and its ledger entries record the effective `without` mode.
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

## Judge and human scoring

Judges and human reviewers use the [same rubric](../tests/eval/judge/rubric.md) and the checklist captured in each run.
The rubric includes existing-vision delta, cross-stack findings, loading evidence and unit-execution requirements.

### Judge command

```sh
npm run eval -- judge --run <id> --json
npm run eval -- judge --run <id> --judge judge.json --results <directory> --json
```

The default [judge configuration](../tests/eval/judge/claude.json) uses `claude-sonnet-5-5` at medium effort through Claude CLI print mode in the disposable evaluation container.
Rebuild the [pinned toolchain image](../tests/eval/container/Dockerfile) before using it.
The model and command arguments are configurable with `--judge <file>`.
The configuration requires `schemaVersion`, `model`, `host`, `executable`, `args`, `versionArgs`, `timeoutMs` and `outputLimitBytes`.
`host` is `claude-container`, or `process` for a command that implements the plain JSON judge protocol, including test fakes.
`args` contains `{model}`, replaced with the configured model.
The command receives a JSON prompt on stdin and returns a JSON answers object; Claude print mode wraps that object in its successful JSON result envelope.
The prompt contains the rubric, historical conversation checklist, run ID, judge identity, numbered primary transcript and selected companion transcripts with their check IDs, scenario IDs, run IDs and transcript hashes, excluding human scores and subject model metadata.
The judge cannot override captured machine assertions.

The Claude container receives only a fresh working directory and private home, with 2 CPUs, 4 GiB memory, no extra capabilities or published ports, and the same container policy as subject evaluations.
The runner copies only `.credentials.json` from `CLAUDE_CONFIG_DIR`, defaulting to the local `.claude` directory, into the throwaway home.
It deletes the login copy and removes the container after success or failure.
Tools, skills, custom settings, MCP discovery and session persistence are disabled for the judge.
No provider diagnostics are published.

Close adapter runs before judging.
Manual runs additionally require `--transcript <file>` and retain unverified isolation.
The command writes `<run>/judge/answers.json` and `evidence.json`, recording the model, configuration, rubric, input and transcript hashes, tool version and container identity.
It leaves the run unscored; pass the printed answers path and captured transcript to `eval score`.
A reserved judge directory prevents an accidental repeat call.
An interrupted invocation requires review before any retry.
Comparison checks receive a companion transcript from the same package source, mode and batch.
Selection prefers the same explicitly recorded repeat index, then the first passing run in run-ID order when indexes differ or are unavailable.
Batch inventories establish membership only; registration order does not establish repeat indexes.
Ordinary companion lookup skips missing or incomplete historical run records and batch inventories, candidates with empty or truncated `score-correction.json` files, and candidates without an available nonempty transcript.
Selection uses the remaining eligible evidence, or leaves the comparison pending when none qualifies.
The input and companion hashes bind the selected transcript and run identity.
Missing companions leave comparison checks pending and return blocked before reserving a provider call or writing answers.
Supply companion evidence, then judge the same unscored run.

### Calibration and audit

The maintainer deferred real model calls for this change.
The real 124-run calibration is a follow-up and must reach at least 95% check-verdict agreement on Sonnet 5.5 medium before judge verdicts count as release evidence.
Fake-model tests establish command behaviour only and do not establish judge accuracy or real Claude authentication and execution.
Until calibration passes, release scoring remains human-reviewed.

```sh
node scripts/eval-calibrate.mjs --plan --json
node scripts/eval-calibrate.mjs --output .cache/judge-calibration --json
```

`--plan` validates the retained corpus without invoking any provider.
Execution requires a fresh `--output` directory and makes one judge call for each retained run with available checks, using the original checklist and validated append-only corrections.
`--runs <directory>` changes the corpus location; exactly 124 human-scored runs are required.
`--judge <file>` changes the judge configuration.
The saved plan binds every transcript, rubric, checklist, human score and configuration by hash.
For comparisons, calibration uses the optional `companionRunId` cited on the retained human answer, otherwise the first retained companion scenario run with the same source revision and mode.
A cited run that is absent or belongs to another scenario leaves the check pending rather than selecting a replacement.
Pending comparison checks block both planning and adoption, even when all available verdicts agree.
The current retained corpus has seven Python comparison checks without matching source-and-mode companions or explicit citations; these remain pending until human comparison evidence is supplied.
The output retains each answers file and a report with verdict agreement and all disagreements, including human and judge citations.
Citation equality is not part of verdict agreement.
Provider or invalid-output failures stop the session, leave a blocked report and trigger no retry.
Agreement below 95% fails; report the disagreements and stop rather than tuning the rubric to fit.
Human reviewers inspect every blocking verdict and one randomly sampled run per smoke scenario per release after adoption.

### Answers and score publication

Create a scoring answers file using the checklist IDs printed by the run.
Every conversation judgement needs a Boolean verdict and a one-based inclusive line range in the transcript, whether it passed or failed.
The reviewer is responsible for the judgement and for identifying unavailable observations as a failed check with the limitation in the transcript.
Reviewer identities must contain at least three characters and cannot be purely numeric.
The score command records conversation judgements as `judge` when the reviewer is `judge:<model>`, otherwise `human`, and deterministic assertions as `machine` in `caseResults`.
Judge identities retain the model name; human reviewer identities remain anonymous in published evidence.
An optional `machine` object names a deterministic assertion: `fixtureUnchanged`, `opened`, `notOpened`, `installerPassed`, `command`, `citeCheck`, `filesEqual` or `contains`.
Opened-path assertions take `patterns` with Node path glob syntax over captured command and file-tool events; a missing access trace cannot pass.
`opened` requires every pattern to match a successful recognised reader command or file-tool read.
`notOpened` rejects any matching command operand or file-tool read attempt, including failed execution and directory or glob operands that overlap a forbidden pattern.
Direct execution of the shipped `scripts/repo-audit.mjs` helper and its asset arguments does not count as opening their source; a separate source read still counts.
`fixtureUnchanged` compares exact tracked bytes and Git status for repository fixtures, or all workspace files for idea fixtures, with the initial snapshot.
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

Missing files, empty transcripts, missing conversation judgement IDs or captured machine results, duplicate check IDs, non-Boolean verdicts, wrong run IDs and out-of-range citations leave the run blocked.
The runner never waits for missing manual evidence.
Successful scoring publishes redacted answers and transcript copies in a unique scoring artifact folder and records the reviewer identity and transcript location for every check.
For adapter runs, scoring also replaces the retained conversation with the redacted scoring transcript and updates its conversation hash.
Every conversation judgement and captured machine assertion must pass for the run to pass.
A scored run cannot be rescored.
Create a new run to retain earlier checkpoints and scoring history.
An identified grading error can instead receive one append-only correction without repeating an unchanged agent run:

```sh
npm run eval -- correct --run <id> --correction correction.json
```

The input contains `corrector`, `reason`, `evidence` with transcript `startLine` and `endLine`, and the complete corrected `checks` array.
The command creates `score-correction.json` with hashes of the original answers and transcript, preserving the original run and scoring files byte for byte.
It refuses overwrite, unchanged assessments, invalid evidence lines, stale original bindings or verdicts that override captured machine results.
Comparisons and acceptance use the validated correction; the original remains historical evidence.
AC-29 credit additionally requires captured successful Node unit execution with a positive pass count and zero failures, either directly or in a captured `run-checks` result.
An assistant assertion, unrun command or failed suite cannot establish that prerequisite.
Pass and fail describe the combined score, with any isolation limitation retained in the record.
Adapter scoring requires completed host turns and the exact captured conversation, and retains the isolation proof taken before deletion.

```sh
npm run eval -- compare --without <baseline-id> --with <with-skill-id>
```

### Impact selection and comparison

Each scenario declares `covers`: skill heading anchors such as `SKILL.md#write-rules`, file paths relative to `skills/repo-audit/`, or directory prefixes ending in `/`.
The map is declared rather than inferred from file-open traces because SKILL.md is loaded whole and those traces cannot show which section influenced behaviour.
Installer keys begin with `install/` and are relative to the repository root.
Run `npm run eval -- affected --base <commit>` to list changed paths, changed keys and affected scenario IDs; add `--json` for the result envelope.
The command includes committed and uncommitted tracked changes and untracked files that Git does not ignore.
SKILL.md hunks map to their enclosing `##` or `###` headings in both the base and current version, preserving coverage for removed or renamed headings.
A key covered by no scenario selects every scenario, including new files and text outside the mapped headings.
The deterministic map-completeness test requires coverage for every such heading and every file under `skills/repo-audit/references/`, `runtime/schemas/`, `runtime/scripts/commands/` and `install/`, and rejects nonexistent coverage keys.
Commands, schemas and assets are authored in `runtime/`, so a changed `runtime/` file takes the key it would have inside the skill, and the skill's generated entry file, schemas and assets add no keys of their own.
With-skill release evidence remains fresh only when its scenario is unaffected by changes under `skills/repo-audit/`, `runtime/` or `install/`, or to `scripts/generate-skills.mjs` or `scripts/lib/bundle.mjs`, since its source revision.
Other execution and scoring bindings still apply.

Legacy single-run `eval compare` requires the same scenario, fixture revision, agent, model, checkpoint and criteria hash.
Adapter comparisons also require the same adapter hash, preserving execution settings across modes.
They require verified container execution, subject to the [approved archived baseline exception](#registry-and-final-selections).
When both runs have container execution records, their image ID, recipe hash and toolchain must match.
The scenario fixture, built fixture name, outcome request, ordered scripted answers and invocation mode must also match.
This archived single-run interface reports lost and gained checks; it does not determine release qualification.
The [release gate](#release-gate) instead compares repeated pass counts using k/N, confirmation and the per-check margin.
Unscored or incomparable runs stay blocked.

### Evidence publication

The runner redacts captured conversations, manual and closed run records, and every scoring transcript and answers copy using the local host's actual user and group names, fixture and home paths, scratch paths and thread identifiers.
Scoring also redacts the supplied reviewer identity in string values, including decoded JSON strings, and always publishes reviewer fields as `[redacted: user name]`.
JSON property names are retained, and transcript line breaks and citation ranges are preserved.
Conversation hashes bind the published bytes.

Open, unscored adapter run records retain private operational paths and session identifiers for resume and isolation checks, and must not be committed.
Manual scoring leaves the supplied source answers and transcript files unchanged; keep those private and commit only the redacted blocking or sampled transcripts described in [evidence storage](#evidence-storage-and-raw-run-archive).

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

Batch evidence uses every run in its saved batch and appends aggregate check rates to the ledger.
The legacy `acceptance --selections` command remains for archived single-run evidence compatibility.
It does not consume the batch ledger or determine a release verdict.
`acceptance --require-complete` and the `release/manifest.json` selection contract have been removed.
The approved scope rerun retains the exact successful `scope-and-prerequisites` baseline `2026-10-11T19-10-46.903Z-8014183b-8ca5-4060-b239-5c8f9c176a89`, bound by its complete record hash.
Legacy `eval compare` accepts only these exact archived record bytes without a container execution record; historical `scopeGuard` fields do not establish verified execution.
Its fixture, scoring criteria, request and tool versions must still match the container run.
All other final runs require verified container execution and unchanged host runner, container runner and image recipe inputs.
Grader-only repairs do not require repeating unchanged agent turns.
Skill and installer freshness follows [impact selection](#impact-selection-and-comparison); verified without-skill baselines remain comparable because those inputs were absent from their isolated execution.

## Release gate

The release gate consumes finalized batch ledger lines and candidate-bound hard-break results.
It does not start subject sessions or judge calls.
Run the full deterministic suite, package check and registry validation on the frozen candidate, and record installation, isolation, approval and invocation outcomes from its evaluation evidence.
The maintainer supplies those results in a report; the gate validates their candidate binding and completeness, but does not rerun or independently authenticate these procedures.

```sh
node scripts/acceptance.mjs --release 0.1.1 --candidate <full-HEAD-commit> --checks hard-break-report.json --results tests/eval/results --json
```

`--release` requires a three-part numeric version, `--candidate` must equal the full current HEAD, and `--checks` names this input format:

```json
{
  "schemaVersion": 1,
  "candidate": "<full-HEAD-commit>",
  "model": "<release-model>",
  "checks": [
    { "id": "deterministic-suite", "passed": true },
    { "id": "package-check", "passed": true },
    { "id": "registry", "passed": true },
    { "id": "installer", "passed": true },
    { "id": "fixture-unchanged", "passed": true },
    { "id": "approval-before-write", "passed": true },
    { "id": "isolation", "passed": true },
    { "id": "explicit-invocation", "passed": true },
    { "id": "implicit-invocation", "passed": true }
  ],
  "agentProcesses": [
    { "scenario": "existing-repo", "runs": 5, "failures": 0, "infrastructureFailures": 0 }
  ]
}
```

Include exactly one `agentProcesses` row for every smoke scenario; the example abbreviates that array.
`failures` counts non-infrastructure agent process failures among the initial five attempts; two or more are a hard break.
`infrastructureFailures` counts separate failures that need replacement evidence before qualification.
The nine named checks must each appear exactly once.
False means a hard break, including any read-only fixture mutation, write before scripted approval, failed installation or isolation, explicit invocation failing to start the skill, or implicit invocation starting it.
Ledger failures for AC-42, AC-43, `fixtureUnchanged` and `installerPassed` also constitute hard breaks even when the report says passed.

Each smoke check needs a five-run without-skill baseline with matching model, adapter, fixture and criteria hashes.
Each with-skill check passes at 3 of 5.
If it scores below 3, the gate returns `confirmation` scenario IDs and a blocked verdict until five more distinct runs of each named scenario have been captured, scored and finalized on the same candidate.
The automation or operator that drives batches must request those five additional runs; the gate itself only reads evidence.
The combined threshold is 6 of 10.
All checks in a scenario must measure the same runs; overlapping or incompatible batches are rejected.
For each baseline-failed check (b <= 2 of 5), the margin is w >= b + 2 of 5.
After confirmation, both rules use pooled with-skill rates, and the margin requires a rate difference of at least 2/5 (0.4).
Thus 7/10 against 1/5 passes; 6/10 against 2/5 fails the margin.
Baseline checks at 3 of 5 or better require only the threshold.

Hard breaks and regressions block the release.
A regression is a check in the last passed release's gating set that now fails either threshold after confirmation or margin.
Other check failures become known issues with their pass counts and sample sizes, and full-tier failures are non-blocking.
Full-tier known issues and case measurements use the scenario's evaluated mode: with skill, except the deliberately skill-free independent extension.
Ordinary without-skill baselines are comparison controls and do not become skill known issues.
The full tier runs weekly and on demand before candidates; it may use three runs for long paths.
Agent or manual cases without a current measurement receive a deferred known-issue entry with zero runs, rather than an invented rate.
Automated acceptance procedures remain covered by the deterministic suite and registry checks.

The gate automatically reads the latest passed `release/<version>.json` in the results directory.
Passed release records are immutable; use a higher version for another qualification.
An incomplete qualification may retry its version only on the same candidate, including confirmation runs.
Keep that release history with the ledger; do not omit it to obtain first-release treatment.
Archived v0.1.0 evidence has no repeated-run gate, so the first ledger release has no regression comparison.
Its own checks at 4 or 5 of 5 seed the gating set.
Later gating sets require 4 or 5 of 5 in the latest smoke batch and at least 80% over the latest ten distinct measured runs, or the available history until ten exist.
Reusing the same run IDs does not add observations to that history.
Unaffected scenarios may carry results from an ancestor candidate after the impact map verifies unchanged covered skill and installer inputs; the output records that source candidate.
Changed covered inputs require fresh measurements.
Only measurements with unchanged covered skill inputs contribute to with-skill reliability history.

The output is `release/<version>.json`, schema version 2, with `candidate`, `verdict`, `blocking`, `knownIssues`, `confirmation`, `pending`, `checks`, `full`, `gatingSet`, `carryover` and `ledger`.
The `full` array records every selected full-tier measurement, including passing and carried results, with its source candidate, counts and contributing run IDs.
The ledger path is relative to the results directory.
Exit 0 means passed, 1 means hard breaks or regressions, and 2 means incomplete qualification or invalid evidence.
Known issues belong in release notes with their measured rates and in `next-release` issues; publishing those issues is a separate authorized release action.
Every final capture must complete all ordered scripted answers.
Historical process-only runs remain diagnostic history; no failed scope run is retroactively credited.

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
Current T3.1 suite selection follows the [delivery gate](implementation-plan.md#delivery-gate).
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
