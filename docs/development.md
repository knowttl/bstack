# Development

Reference for working on the bstack checkout: implementation status, installer lifecycle, validation, fixtures, evaluation, the shared runtime and the full command list.
To install and use the skills, start with the [README](../README.md).

## Status

The approved [design](design.md#summary) owns the release scope, and the [implementation plan](implementation-plan.md) tracks the repo-audit build.
The [standalone verification amendment](design.md#standalone-verification-skill) is approved design with the shared runtime, the per-skill installer and the verification skill's `create`, `maintain` and `correct` modes implemented, with its no-mistakes wiring reference and generated coverage gate.
The design's [skill split](design.md#the-skill-split) owns the approved skill boundaries.
Its shared runtime, bundle generator and multi-skill installer are implemented, as are the verification, [vision](../skills/vision/SKILL.md), [glossary](../skills/glossary/SKILL.md), [architecture](../skills/architecture/SKILL.md), [foundation](../skills/foundation/SKILL.md), [agents-md](../skills/agents-md/SKILL.md), [maintenance](../skills/maintenance/SKILL.md), [plan](../skills/plan/SKILL.md), [formal-verification](../skills/formal-verification/SKILL.md), [how](../skills/how/SKILL.md), [why](../skills/why/SKILL.md) and [teach](../skills/teach/SKILL.md) skills, and repo-audit is slimmed to its overview audit and two checklists; rehoming its acceptance cases and evaluation scenarios to the skills they test is pending.
The vision, glossary, architecture and foundation skills take a design document the user names as the user's explanation and ask only about gaps, and both repo-audit checklists list `/plan` last ([T2.12](implementation-plan.md#t212-take-the-design-as-input-and-wire-plan-into-the-checklists)).
The `formal-verification` skill proves one stated property of a high-stakes spot by model checking and leaves a `formal-<target>` suite ([T2.13](implementation-plan.md#t213-add-the-formal-verification-skill)); the [`formal-charge-once` fixtures](../tests/fixtures/formal-charge-once/FIXTURE.md) are its proof input, `/maintenance sweep` checks its suites, `/architecture` proposes the explicit state model standard that feeds it and both repo-audit checklists list it only with cited risk evidence.
Its model-checker proof runs only where the pinned tool and Java are present: see [the skill's tests](#formal-verification).
The `how`, `why` and `teach` skills explain a codebase from cited evidence and write nothing ([T2.14](implementation-plan.md#t214-add-the-how-why-and-teach-skills)).
The `recall` skill summarises prior context from the project's local Claude Code and Codex transcripts, read-only, and keeps its output in scratch ([T2.15](implementation-plan.md#t215-add-the-recall-skill)).
The `prototype` skill builds throwaway variants in scratch clones, measures each with the project's verification kit and recommends one, writing nothing to the repo ([T2.16](implementation-plan.md#t216-add-the-prototype-skill)).
The installation below covers repo-audit, verification, vision, glossary, architecture, foundation, agents-md, maintenance, plan, formal-verification, how, why, teach, recall and prototype; audit usage applies to repo-audit.

This checkout contains the slim [repo-audit procedure](../skills/repo-audit/SKILL.md), which reads a target at overview level, prints the checklist of skills to run next with a cited reason per line and writes nothing, the document research brief, read-only starting-state inspection, document inventory and citation validation, and the completed T0.4 shared library described in the [command contract](command-contract.md).
The [vision skill](../skills/vision/SKILL.md) holds the purpose interview, the vision guide, board build, launch and verdict ingestion with a pinned runtime, and protected writing of the approved `VISION.md`; repo-audit lists `/vision` as a next step instead of reviewing the vision itself.
The procedure prints one checklist for a new idea and one for an existing repo; see the [repo-audit checklists](../skills/repo-audit/SKILL.md#step-4-print-the-checklist) for the skills the user runs next.
Review before apply, protected writes and outcome verification belong to the skill that makes each change.
The verification, architecture and foundation skills provide project-specific guidance, native rule-proof, debt baseline checks and selected maintained local integration.
Protected new-project creation is available through the [foundation skill](../skills/foundation/SKILL.md) after the approved vision and exact foundation review.
Use the [maintenance reference](../skills/maintenance/references/maintenance-contract.md) for bounded change assessment and local or standalone validation without repeating the interview or full audit; repo-audit lists `/maintenance` as a next step instead of registering documents itself.
The copy installer supports previews, verified no-op repeats, updates, uninstall and interrupted-run resume.
Link installation, explicit developer-checkout updates and owned-link removal are available.
The owner accepted Linux-only installer lifecycle evidence for C25c and AC-74 on 2026-10-10.
Windows and macOS execution remains unverified and is outside this acceptance scope.
Use repo-audit for overview discovery and follow its checklist by explicitly invoking the named skills, keeping blocked steps visible.
Reviewed plans support protected writes, recoverable originals and hash-derived resume as described below.
Nothing is published to npm.

## Install from a checkout

Clone the source and install its dependencies using Node 24 or later, Git and npm:

```sh
git clone https://github.com/knowttl/bstack.git
cd bstack
npm ci --ignore-scripts
for p in skills/*/package.json; do
  npm ci --omit=dev --prefix "$(dirname "$p")" || exit "$?"
done
```

From this checkout, preview and then copy every skill folder into an existing project.
Each skill folder under `skills/` installs on its own, so repeat `--skill <name>` to install only some of them.
Replace `<project-path>` with the target directory; quote paths containing spaces:

```sh
node install/install.mjs --scope project --project <project-path> --host all --dry-run
node install/install.mjs --scope project --project <project-path> --host all --json
node install/install.mjs --scope project --project <project-path> --host all --skill verification
node scripts/check-package.mjs --skill <project-path>/.agents/skills/repo-audit
```

Use `--scope user --host agents` for the current home, or `--host claude` for Claude Code alone.
`--host all` selects both `.agents/skills/<skill>` and `.claude/skills/<skill>` beneath the selected home or project.
Each skill keeps its own ownership and journal records beside the skill folders, so updating or uninstalling one skill leaves the others untouched.
A skill without a `package.json` pins no runtime and skips npm installation of skill dependencies.
Node 24 or later, Git and npm are prerequisites.
The installer stages the authored package, installs the locked runtime with npm and validates it before activation.
An occupied unowned destination blocks installation.
For an update, select the desired source revision and rerun the same command.
Unchanged owned files update, obsolete unchanged owned files are removed, and edited or unowned conflicts are preserved.
Conflicts show the actual difference and a specific `--replace <host>:<path>:<actual-hash|absent>` decision that can be passed on a later run.
Each accepted replacement backs up existing bytes outside the skill, and a changed hash invalidates an older decision.
Noninteractive conflicts return blocked exit 2 with per-file hashes and versions describing the actual mixed installation.
Use the same scope and host with `--uninstall` to remove unchanged owned files and the runtime directory created by the installer.
Edited and unowned content survives, retained paths are reported, and retained owned files keep their ownership record and return blocked until explicitly resolved.
Rerun the original command after an interruption to resume from verified actual hashes and its preserved journal.
Dry run writes no files and installs no dependencies.
Add `--link` to install a directory symlink, or a junction on Windows, to the source skill folder.
Preview declares any pinned runtime preparation in the source checkout before link activation.
Repeats verify the owned link and pinned runtime without reinstalling dependencies.
Review and update the developer checkout explicitly, then rerun with `--link` to record its current source state.
An existing source runtime that differs from the pin is preserved; prepare it explicitly in that checkout before retrying.
Link uninstall removes only the owned link and its external records, preserving the entire target, including its runtime and edits.
Changed or replaced links block instead of being adopted.
The [installer contract](command-contract.md#installer-copy-and-preview-c25a) describes ownership, conflict decisions and failure recovery.
An exact clean semantic Git tag is reported as the source version, while untagged or dirty sources are explicitly labelled development.
Installation tests use disposable release snapshots and a locally packed fake runtime, and do not establish real Windows/macOS runs or current-agent skill loading.

## Invoke a skill

To start an audit, open a fresh agent conversation in the target project and explicitly invoke the skill with the area to assess and the next change:

```text
$repo-audit
Review this repo at overview level before adding quantity support.
Use the existing design and acceptance cases; print the checklist with a cited reason per skill.
```

That is the Codex invocation; use `/repo-audit` in Claude Code or `/skill:repo-audit` in Pi.
A plain request such as "audit this repo" does not start the skill.
For a new idea, install into its existing workspace and invoke the skill with the idea and first useful journey instead.
Repo-audit prints the checklist and leaves the target unchanged.
Follow the [repo-audit procedure](../skills/repo-audit/SKILL.md) for its scope and checklist contract.
In the skills that make changes, answer unresolved intent questions, select findings, and approve the exact proposed changes before apply or creation; `/vision` runs the interactive vision board as its own skill.
See the [worked examples](examples/README.md) for requests, findings, selections, results and reproduction steps.

The examples cover `new-idea`, `ambiguous-idea`, `clear-goals`, `existing-vision-delta`, `ts-shop` and `py-ledger`; the [scenario registry](../tests/eval/scenarios/scenarios.json) owns the current scenario and fixture list.
Rule-proof valid/violation controls, dirty-work and maintenance edge cases (`refactor`, `contract-removal`, `shallow-history`), and installer-collision fixtures are test infrastructure, not separate user skill runs.
They remain covered by command tests rather than worked examples.
Only `new-idea` and `ts-shop` have the completed installed final-path evidence from C27; the other four examples retain earlier checkpoint results and their limits.

## Evidence limits

Scripts check structure, references, selected paths, input freshness and captured command outcomes.
They cannot prove that an interview captured the user's goal, that a citation supports a claim, that prose or an impact explanation is true, or that an owner actually approved a design.
Measurements cannot prove semantic independence or predict every merge conflict, and passing native checks prove only their defined constraints.
Review and observed user journeys remain necessary; see the [design's machine-check limits](design.md#what-machines-can-check).

The [recorded instruction-loading limit](design.md#reusable-guidance-for-future-changes) matters before the [agents-md skill](../skills/agents-md/SKILL.md) consolidates repo-owned guidance into `AGENTS.md`.
Removing `CLAUDE.md` can hide project instructions in sessions that cannot load `AGENTS.md` directly.
Follow the skill's [host loading check](../skills/agents-md/references/agents-md.md#host-loading-check) before approving removal; bstack neither inspects nor changes instruction files outside the selected repo.

The examples' actual agent evidence uses one agent family and model: Codex with gpt-6.1-sol, not a host or model matrix.
The four earlier checkpoints ran on Linux 6.8.0-142-generic with Node v24.17.0 and codex-cli 0.160.1; the foundation audits used low reasoning.
C27's two installed full paths and its fresh repeat-audit, independent-extension and maintenance conversations ran on the same Linux kernel and Node version, using codex-cli 0.162.1 with medium reasoning.
The [C27 record](../tests/eval/results/full-path-C27/summary.md#host-provenance-and-evidence-limits) names exact source revisions, native tool versions, isolated installations, manual scoring and browser/local HTTP observations.
Scoring came from the implementation agent, not an independent human study; fixture answers and approvals were scripted or delegated fixture verdicts.
No new real-agent run is claimed by this documentation change.
Separate script and installer records include local Node 24 and Node 26 runs, not real-agent runs on both versions.
Installer support and AC-74 acceptance are Linux-only under the owner's 2026-10-10 ruling R27; Windows and macOS execution is unverified.
Hosted CI behaviour, CI adapter execution and forge enforcement are unverified.
This repository has no hosted CI workflow; local clean-checkout results do not establish hosted execution.
Repeated-run release qualification and release approval remain separate work.

## Validate

After installing dependencies as described above, validate with Node 24 or later:

```sh
npm run check
npm test
npm test -- --task T0.1
npm test -- --task T0.2
npm test -- --task T0.3
npm test -- --task T0.4.C4a
npm test -- --task T0.4.C4b
npm test -- --task T0.4.C4c
npm test -- --task T0.5.C5a
npm test -- --task T0.5.C5b
npm test -- --task T0.6
npm test -- --task T1.1
npm test -- --task T1.2
npm test -- --task T1.3
npm test -- --task T1.4
npm test -- --task T1.5
npm test -- --task T1.6
npm test -- --task T1.7
npm test -- --task T2.1
npm test -- --task T2.2
npm test -- --task T2.3
npm test -- --task T2.4
npm test -- --task T2.5
npm test -- --task T2.8
npm test -- --task T2.9
npm test -- --task T3.1
node scripts/acceptance.mjs --check-registry
node scripts/check-package.mjs
```

`check` first verifies the generated files in each skill against the [shared runtime](../runtime/) and the README skills table against `skills/*/SKILL.md` (`node scripts/generate-readme.mjs` rewrites that table), then runs the package checks for user-only metadata, local resource paths, reference loading, line limits, literal script imports, top-level constant comments, step completion lines and bundled language policy, followed by the [standalone checker freshness gate](command-contract.md#standalone-checker-generation).
It reports every detected problem with a stable rule code and exits 1 on failure.
See the [package check contract](command-contract.md#package-check) for exact syntax and limits.
Local validation uses the [affected gate](#affected-validation) after dependency setup.

### Affected validation

Run `node scripts/gate-test.mjs` for the delivery gate, or `npm run check` followed by `npm test` for the full offline baseline.
For a manual union, repeat task IDs in one invocation, for example `npm test -- --task T2.4 --task architecture`.
The runner sorts and deduplicates suite files before execution and rejects unknown tasks, missing suites and malformed arguments.
It passes suite paths relative to its checkout so Node's test-path globbing cannot interpret brackets in the checkout's parent path.

[`tests/affected.json`](../tests/affected.json) is the source-to-suite and protocol-dependency map.
Command entries name task IDs and reverse dependents, including file imports and callers that exchange serialized protocols without imports.
The gate validates direct command imports against those declarations and refuses selection if a discovered suite is unregistered.
Owned schemas select their command and its dependents.
The runtime skill manifest supplies generated bundle and resource ownership, using the same authored-input distinction as evaluation scenario impact selection.
The evaluator's `affected` command still selects agent scenarios, not deterministic test suites.
See the [delivery gate](implementation-plan.md#delivery-gate) for full fallback conditions, including evaluation-contract and shared-infrastructure changes.
Skill prose selects its packaging and procedure contracts without unrelated installer suites.

The public gate regression suite, `npm test -- --task gate-test`, proves a clean module control, an independent seeded module failure, a changed protocol that breaks a dependent command, failure propagation, every fallback category, and committed/staged/unstaged/untracked/renamed/deleted input handling.
Its disposable Git fixtures execute the maintained runner with independently specified public-command results, including full fallback with missing base metadata and committed or uncommitted inputs, evaluation-contract changes and fallback failure propagation.
Record-only fixtures check the npm boundary for the remaining fallback categories without nesting the entire repository suite.
The runner's bootstrap suite separately proves overlapping tasks execute a shared suite once and reject an unknown task in a union.
During a user-started `/verification maintain`, compare selected results with `npm run check` and `npm test` on the same inputs, record any miss, correct its mapping or dependency, and add a public-gate regression before narrowing it again.
No scheduled full run is installed.
T0.6 recorded Node 24 and Node 26, while each later task records the versions it actually tested.
See the [delivery gate](implementation-plan.md#delivery-gate) for gate preparation and validation.
Recorded runs on Linux do not prove support on Windows or macOS.
Follow the [repo-audit checklists](../skills/repo-audit/SKILL.md#step-4-print-the-checklist) for the order of skills that own selected apply, instruction consolidation and final verification.
See the [C27 final-path evidence](../tests/eval/results/full-path-C27/summary.md) for completed installed paths, repeated audit, independent extension, bounded maintenance and observed limitations.

## Command reference

Each skill ships one generated entry file, `skills/<skill>/scripts/<skill>.mjs`, and `--help` on that file lists its commands.
The sections below group the commands by what they do.

### Architecture measurement

Collect repeatable size and change-history signals, or compare two declared change plans:

```sh
node skills/architecture/scripts/architecture.mjs measure --repo <path> --range <base>..<head> --json
node skills/architecture/scripts/architecture.mjs measure --repo <path> --range HEAD --exclusions <file> --json
node skills/architecture/scripts/architecture.mjs overlap --repo <path> --plans <file> <file> --json
```

See the [measurement and overlap contract](command-contract.md#measure-and-overlap) for input examples, lineage handling, exclusions and glob semantics.
Measurements include supporting commits, rename handling and the resolved revision range.
Only eligible files present at the range endpoint are measured, following detected lineage back through renames to addition commits.
If a path is deleted on one line of history and reused by an unrelated file, then merged with a branch that edited the old file, the old lifetime's commits and co-change pairs can be attributed to the new file.
Signals are advisory evidence, never violations, and do not establish semantic independence or observed conflicts.

### Findings, apply and project creation

Validate cited findings:

```sh
node skills/verification/scripts/verification.mjs findings validate --repo <path> --findings <file> --json
```

Use `--workspace` for a draft foundation without Git.
The [findings contract](command-contract.md#findings) defines the schema, complete input examples, stage outcomes and verdict precedence.
Validation returns the current fingerprint for subsequent evidence capture and one readiness result.
Missing or stale evidence blocks readiness, and unresolved decisions require review.
The command assesses supplied evidence without executing checks or applying changes, and no audit record is rendered or written.

Preview selected edits, then apply the reviewed plan or resume its interrupted run:

```sh
node skills/verification/scripts/verification.mjs apply --repo <path> --plan <file> --dry-run
node skills/verification/scripts/verification.mjs apply --workspace <path> --plan <file> --dry-run --json
node skills/verification/scripts/verification.mjs apply --repo <path> --plan <file> --json
node skills/verification/scripts/verification.mjs state show --repo <path> --run <returned-run-id> --json
npm test -- --task T2.6
```

The [apply contract](command-contract.md#apply-dry-run) documents the reviewed change set, exact-byte hashes, digest and supported operations.
Dry-run plain output prints the complete diff; dry-run JSON additionally returns complete proposed content and hashes.
Omit `--dry-run` to apply after review.
See the apply contract for resume and completed-plan behavior.
Use `replace-file` with complete reviewed UTF-8 content when a mechanical edit is unsupported.
`state show` reports actual applied, pending and conflicting files and affected checks to rerun.
See the apply contract for preflight protection, backup and journal recovery, and filesystem limits.

Create an approved minimal project inside the existing idea workspace:

```sh
node skills/foundation/scripts/foundation.mjs project create --workspace <idea-workspace> --plan <file> --dry-run --json
node skills/foundation/scripts/foundation.mjs project create --workspace <idea-workspace> --plan <file> --json
```

The [creation contract](command-contract.md#protected-project-creation) documents the versioned plan, selected destination, scratch scaffold and exact diff.
The owner selects the stack, scaffold and first journey after approving the vision.
Follow [Step 4](../skills/foundation/SKILL.md#step-4-verify-the-proposal-in-scratch) for scratch verification and repair before presenting the exact files, declared commands and captured results or verification limits for approval.
Creation journals directories and files through the existing protected-write engine before initialising Git only at the reviewed destination.
Repeat the unchanged plan to resume directory, file or Git interruption.
Failed or interrupted setup and journey commands retain the project as unverified and are not rerun automatically.
Maintained enforcement is available through selected `apply` edits, as described below.
Project contract validation, change collection, local assessment validation and generated-fact freshness checks are available below.
Portable maintenance is available through the [standalone checker](command-contract.md#standalone-checker-execution), using an explicit base and committed assessment.

### Rule proof, baselines and maintained checks

Prove a selected native rule against prepared clean and independently seeded fixtures:

```sh
node skills/verification/scripts/verification.mjs rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json
npm test -- --task T3.2
```

Prepare native dependencies in the fixtures first.
See the [enforcement command contract](command-contract.md#rule-proof-and-temporary-debt) for check selection, saved proof evidence and coverage limits.

Check a temporary baseline when the native tool has no baseline feature:

```sh
node skills/verification/scripts/verification.mjs baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --json
node skills/verification/scripts/verification.mjs baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --refresh --json
node skills/verification/scripts/verification.mjs baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --refresh --finding <id> --findings <file> --entry <file> --json
npm test -- --task T3.3
```

Prepare an existing baseline file and normalized native violations as described in the [enforcement command contract](command-contract.md#rule-proof-and-temporary-debt), including the requirements for authorizing new entries.
Both `architecture` and `verification` expose `baseline check --refresh`, which directly replaces the target baseline when validation passes, removing fixed entries.
New debt still fails unless `--finding`, `--findings` and `--entry` authorize a matching selected unresolved debt entry.
This command has no approval prompt and does not use `apply` or its recovery journal.
The skill workflow instead prepares the complete baseline in scratch, validates it in a disposable repo copy without `--refresh`, and includes it in the exact diff approved for `apply`.

Integrate selected native checks into the project's existing check command through a reviewed `apply` plan.
Keep package rules scoped to their owning package and prepare the complete documented initial debt baseline through selected findings before expecting an audited project to pass.
Prove each rule independently on the clean fixture variants, then use `rule-proof` with the identical maintained command, such as `npm run check`, on separate valid and seeded disposable copies.
The target owns the checker and its declared dependencies, so ordinary contributors can run it without an installed skill or agent session.
Declare selected command paths in each edit's `checkIntegration` using the [checks reference](../skills/foundation/references/checks.md#integrate-the-maintained-command), which owns the supported command grammar and CI format.
The identical maintained-command disposable controls remain the enforcement proof.
CI integration requires the project's selection and its adapter behaviour remains unverified until hosted execution is observed.
Run `npm test -- --task T3.4` for the maintained-command, baseline and web/core scope controls.

### Maintenance contract, documents and generated facts

Validate the project's small maintenance contract and collect the final changed paths:

```sh
node skills/maintenance/scripts/maintenance.mjs contract validate --repo <target> --contract .bstack/project.json --json
node skills/maintenance/scripts/maintenance.mjs evidence collect --repo <target> --base <ref> --json
# Before the first commit:
node skills/maintenance/scripts/maintenance.mjs evidence collect --repo <target> --base empty --json
npm test -- --task T3a.1
npm test -- --task T3a.2
node skills/maintenance/scripts/maintenance.mjs evidence validate --repo <target> --base <ref> --assessment <assessment.json> --contract .bstack/project.json --json
npm test -- --task T3a.3
```

`--contract` defaults to `.bstack/project.json` and accepts another repo-relative JSON contract path.
The [collection command contract](command-contract.md#project-contract-and-change-collection) defines the schema, pointers, scopes, leaf checks and supported matching rules.
Follow the [maintenance procedure](../skills/maintenance/references/maintenance-contract.md) to assess each candidate, resolve decisions and supply evidence to the project's selected delivery gate.
Collection resolves the base, includes committed, staged, unstaged and new changes, and maps both paths of detected renames.
It returns candidate documents, unmapped paths and a scratch assessment path without changing the target.
Missing bases block collection; shallow history reports the required fetch commands.
The skeleton still needs semantic assessment and review; collection does not establish readiness.
Fill every candidate document and unmapped-path assessment with the changed behaviour, changed paths, source citations and a specific impact reason.
An `updated` result also names the actual before/after definition or rule excerpts; cosmetic changes cannot prove maintenance.
The [assessment validation contract](command-contract.md#assessment-validation) documents review binding, initial foundation provenance, prior coverage and acceptance decisions.
Validation returns `data.fingerprint` even when review is stale.
Have the selected reviewer assess the substantive claims against the diff, then record that fingerprint in the assessment and validate again.
Attach `run-checks` captures as execution entries containing `runId` and the caller-relative `plan` path.
Required checks must match both previous and proposed policy; unresolved decisions remain blocked even when those checks pass.
Structural validation cannot prove semantic correctness or authenticate an owner's approval.

Check registered generated sections or prepare reviewed regeneration proposals:

```sh
node skills/maintenance/scripts/maintenance.mjs docs generate --repo <target> --check --json
node skills/maintenance/scripts/maintenance.mjs docs generate --repo <target> --json
```

The [generated-facts contract](command-contract.md#generated-facts) defines registration, markers, exact-byte output and write detection.
Review scratch proposals through a selected protected `apply` change set before updating documents.

Check registered source paths, local Markdown links and context-specific glossary entries:

```sh
node skills/maintenance/scripts/maintenance.mjs docs check --repo <target> --json
npm test -- --task T3a.5
```

The [document-reference contract](command-contract.md#document-references) defines supported links and glossary registration.
Duplicate terms fail only within one registered context; unsupported formats report coverage limits.
Use paired reviewed [`move-rule` edits](command-contract.md#apply-dry-run) to preserve one authoritative rule and replace its old location with an exact link.
For design standards and their placement, follow the architecture skill's [design standards reference](../skills/architecture/references/design-standards.md).

### Check plans and live probes

Capture a reviewed check plan with acceptance sources and input scopes:

```sh
node skills/verification/scripts/verification.mjs run-checks --repo <path> --plan <file> --json
node skills/verification/scripts/verification.mjs run-checks --repo <path> --plan <file> --phase before --json
# After the change, reuse the same plan and the returned before run ID:
node skills/verification/scripts/verification.mjs run-checks --repo <path> --plan <file> --prior-run <before-run-id> --json
npm test -- --task T2.7
```

For bug fixes and refactors, run the before capture before editing, then supply its run ID after the change.
Keep the returned scratch artifact as execution evidence.
The [check-plan contract](command-contract.md#check-plans-and-capture) owns the schema, prerequisites, freshness rules, coverage verdicts and limitations.

For each outside dependency, record the same live call before and after the change:

```sh
node skills/verification/scripts/verification.mjs probe record --repo <path> --name <dependency> --phase before --spec <file> --json -- node scripts/probe.mjs <endpoint>
node skills/verification/scripts/verification.mjs probe record --repo <path> --name <dependency> --phase after --spec <file> --json -- node scripts/probe.mjs <endpoint>
node skills/verification/scripts/verification.mjs probe compare --repo <path> --name <dependency> --before <run-id> --after <run-id> --json
```

The [probe contract](command-contract.md#live-probe-pairs) defines the descriptor, environment binding, per-call `--approved-by-user` flag and unavailable results.
The probe command must assert the agreed outcome and exit nonzero on disagreement.
Passing checks alone do not replace a successful probe comparison for an outside dependency.

## Evaluation

The evaluation runner includes scenarios, the [registered acceptance procedures](../tests/acceptance/cases.json) and a current-host Codex adapter.
Adapter runs create a fresh fixture, home, host state and cache, verify discovery isolation, and capture JSONL conversation turns.
See the [evaluation contract](evaluation.md) for ordered reply delivery, bounded runs, throwaway authentication, scoring and comparison, and [automatic batches](evaluation.md#automatic-batches-and-ledger) for repeated scenarios and aggregate ledger results.
Follow [evidence storage](evaluation.md#evidence-storage-and-raw-run-archive) when publishing evaluation results and archiving raw runs.
Use [impact selection](evaluation.md#impact-selection-and-comparison) to list scenarios affected by changes since a base commit.

```sh
npm run eval -- affected --base <commit>
npm run eval -- --manual --scenario ambiguous-idea --mode without --stage baseline --agent <agent> --model <model>
npm run eval -- --scenario ambiguous-idea --mode without --stage baseline --adapter tests/eval/adapters/codex.json
npm run eval -- turn --run <id> --answer 1
npm run eval -- close --run <id>
npm run eval -- score --run <id> --answers answers.json --transcript transcript.txt
npm run eval -- batch --tier smoke --mode without --adapter tests/eval/adapters/codex-final.json --repeat 5 --concurrency 6 --json
node scripts/acceptance.mjs --release <version> --candidate <full-HEAD-commit> --checks <hard-break-report.json> --json
```

An unscored manual run exits 2 as blocked.
The [release gate](evaluation.md#release-gate) reads batch rates and candidate-bound hard-break results, requests confirmation below 3 of 5, and writes `release/<version>.json`.
Hard breaks and regressions block; other failures become known issues.
An adapter run also exits 2 until explicitly scored.
See the [recorded initial baseline](evaluation.md#recorded-initial-baseline) for host provenance and scenario outcomes.
The [T1.3 gap map](../tests/eval/results/gap-map.md) links every observed failure to the procedure and retains passing requirements.
The [intent checkpoint](evaluation.md#intent-checkpoint-c10b) records two real with-skill runs and their limitations.
These runs do not establish complete audit execution or protected repo creation.
Close the conversation immediately when it finishes to delete its isolated home before reviewing the captured transcript.
The Codex adapter copies only the invoking user's existing login into throwaway state with private permissions, removes the copy after each turn, and deletes the whole home on close or a failed host turn.
See the [scoring contract](evaluation.md#judge-and-human-scoring) for judge and human answers, transcript citations and captured machine verdicts.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.
For portable full-suite evidence, use `npm test -- --capture .cache/full-suite.json`, then `node scripts/task-evidence.mjs .cache/full-suite.json <task-id>`.
The [task evidence contract](implementation-plan.md#task-evidence-contract) owns capture prerequisites, automatic capture during ordinary tests, input binding and refresh rules.
`npm test -- --task T0.4` selects the currently implemented shared-library tests.
`npm test -- --task T0.5` selects the currently implemented package-check tests.
See [task progress](implementation-plan.md#progress) for the remaining slices.

## Fixtures

Build isolated fixture workspaces with Node 24 or later and Git.
Native fixtures also require npm, Python 3.12 and uv, with fixture-local TypeScript and Ruff locks:

```sh
node tests/fixtures/build.mjs --all
node tests/fixtures/build.mjs clear-goals
node tests/fixtures/build.mjs ts-rule-proof-alias
node tests/fixtures/build.mjs py-rule-proof-cycle
```

The builder prints one JSON line per fixture with its `name`, absolute temporary `path` and `kind` (`idea` or `repo`) after its sanity check passes.
The caller owns removal of the printed temporary folders.
T1.1 includes the two native stacks, clean boundary proofs, independent private/alias/cycle seeds, dirty work, refactors, contract removal, shallow history and installer collisions.
Missing native tools exit 2 as blocked.
See the [fixture contract](fixtures.md) for sources and sanity commands.

## Upstream sources

Raw upstream development sources are committed outside the installed skill.
[The manifest](../upstream/sources.json) owns their exact pins, copied paths and generated SHA-256 hashes, and [NOTICE](../NOTICE) records adaptations.
To refresh the copies or verify them against their pinned remote bytes:

```sh
node upstream/fetch.mjs
node upstream/fetch.mjs --check
```

Both commands require network access and exit 1 if a listed remote file is missing or unavailable.
Fetching replaces local copies and regenerates each source's `sha256` map in the manifest only after every listed remote file downloads successfully.
`--check` writes nothing and also exits 1 for missing or modified local copies, missing or malformed hash entries, or hashes that differ from the pinned remote bytes.

To verify committed copies offline against the manifest:

```sh
node --test --test-name-pattern='committed upstream copies' tests/scripts/upstream.test.mjs
```

This check requires Git, verifies hash coverage and local bytes, and rejects tracked upstream copies absent from the manifest.
The fetch script and manifest are excluded from the copy inventory.
The check also runs in `npm test` and `npm test -- --task T0.3`.

## Shared runtime and generation

Authored commands, shared libraries, schemas, assets and shared references have one source in [runtime/](../runtime/), and [runtime/skills.json](../runtime/skills.json) lists the resources each skill ships, including vendored trees copied unchanged from `upstream/`.
Markdown parsing uses `marked` at the exact version pinned in `package.json` and `package-lock.json`.
The generator bundles its ESM entry into each consuming skill and the standalone checker, so installed scripts need no separate parser installation.
An installed skill cannot import outside its own folder, so the generator bundles only a skill's commands into one entry file, `skills/<skill>/scripts/<skill>.mjs`, and copies its listed schemas, assets and shared references beside it.
Each skill commits its generated files.
See the shared [writing reference](../runtime/references/writing.md) for drafting guidance and the [runtime manifest](../runtime/skills.json) for the skills that ship it.
The skills that ship `apply` share its protected-write libraries for reviewed, hash-checked change sets; the [manifest](../runtime/skills.json) owns each skill's command list.
The architecture and verification runtimes also expose direct baseline replacement through `baseline check --refresh`, as described under [baseline commands](#rule-proof-baselines-and-maintained-checks).
Edit authored runtime sources only in `runtime/`; refresh vendored sources through the [upstream workflow](#upstream-sources), then regenerate the skill files or verify them without writes:

```sh
node scripts/generate-skills.mjs
node scripts/generate-skills.mjs --check
```

`--check` exits 1 for a missing or modified listed output or an unlisted file under a registered skill's `schemas/`, `assets/` or declared vendored destinations; generation removes those unlisted files.
A skill's `references/` also holds its own authored files, so only the listed shared copies are checked.
Both commands exit 1 when a skill lists a command, schema, asset or reference that `runtime/` lacks or when a bundle would include a file outside `runtime/` other than the pinned `marked` ESM entry.
To add a skill, create its folder with `SKILL.md` and add an entry to `runtime/skills.json`; a new command needs a registry entry in `runtime/scripts/commands.mjs` and a listing in each skill that ships it.
`npm run check` runs the verification, and `npm test` repeats it for the committed tree.

## Skill commands

### verification

The [verification skill](../skills/verification/SKILL.md) is started by the user and provides `create`, `maintain` and `correct`: `create` interviews a repo, renders a verification kit as a reviewable change set, applies it after exact-diff approval and proves it once, `maintain` checks an applied kit for drift, drives every feature and proposes reviewed corrections, and `correct` turns a mistake you keep correcting into the highest-rung check that makes it impossible, proven on a real past occurrence, with no kit needed.
Test auditing and testing guidance live here and no longer in repo-audit, which now points the user to `/verification`.
Its entry point and generators, documented in the [command contract](command-contract.md#verification-skill-commands), run from a checkout like this:

```sh
node skills/verification/scripts/verification.mjs kit scaffold --repo <target> --plan <kit-plan.json>
node skills/verification/scripts/verification.mjs apply --repo <target> --plan <change-set.json> --dry-run
node skills/verification/scripts/verification.mjs kit prove --repo <target> --app <name> --feature <id>
node skills/verification/scripts/verification.mjs kit check --repo <target> --app <name>
node skills/verification/scripts/verification.mjs kit scaffold --repo <target> --plan <kit-plan.json> --update
node skills/verification/scripts/verification.mjs comment-check generate --repo <target> --language python
```

Its fixture acceptance needs Git, Python 3, Ruff and Go on `PATH`, and the TypeScript comment-checker test needs the `ts-shop` fixture's npm install.

### formal-verification

The [formal-verification skill](../skills/formal-verification/SKILL.md) is started by the user and provides `create` and `maintain`: `create` proves one stated property of one spot, renders the suite as a reviewable change set and proves the check can fail, and `maintain` checks an applied suite for drift, reruns every property and triages each problem.
Its commands are documented in the [command contract](command-contract.md#formal-verification-skill-commands), and run from a checkout like this:

```sh
node skills/formal-verification/scripts/formal-verification.mjs formal scaffold --repo <target> --plan <suite-plan.json>
node skills/formal-verification/scripts/formal-verification.mjs apply --repo <target> --plan <change-set.json> --dry-run
node skills/formal-verification/scripts/formal-verification.mjs formal check --repo <target> --suite <name>
node skills/formal-verification/scripts/formal-verification.mjs formal scaffold --repo <target> --plan <suite-plan.json> --update
```

The skill installs no tool: the project pins the tool file and its sha256, and a missing tool is reported as unproven.
`tests/scripts/formal.test.mjs` runs its tool-independent checks, including the missing-jar chart boundary, without a tool.
Its `rule-proof`, walkthrough, chart-violation and chart wrong-hash tests run only when `BSTACK_TLA2TOOLS_JAR` names the pinned `tla2tools.jar` and Java 11 or later is on `PATH`, and they skip, never pass, otherwise.
The [fixture notes](../tests/fixtures/formal-charge-once/FIXTURE.md) record the pinned jar, its sha256 and the expected results.

### Standalone checker

Generate the standalone maintenance validator artifact from this checkout after installing the root development dependencies.
Its committed home is [skills/maintenance/scripts/bstack-check.mjs](../skills/maintenance/scripts/bstack-check.mjs), and the maintenance skill installs it into a repo.
The generated file requires Node 24 or later and Git for repository validation.
Check freshness without writes, or generate current bytes and an installation proposal in scratch:

```sh
node scripts/generate-checker.mjs --repo . --check
node scripts/generate-checker.mjs --repo <target> --json
```

See the [generation contract](command-contract.md#standalone-checker-generation) for scratch outputs, selected-plan installation and protection of existing copies.

Run the installed aggregate with an explicit repository, agreed ancestor base and selected assessment:

```sh
node .bstack/bin/bstack-check.mjs --repo <target> --base <commit> --assessment <assessment.json> --json
```

See the [execution contract](command-contract.md#standalone-checker-execution) for portable review preparation, fresh leaf execution, previous-policy validation and the missing-base fetch prerequisite.
Hosted CI behavior remains unverified.

Add `--docs-only` to check the current tree's registered document links, glossary structure and generated sections with no base, assessment or leaf execution; this is the command of the no-mistakes docs gate:

```sh
node .bstack/bin/bstack-check.mjs --repo <target> --docs-only --json
```

### repo-audit

To view repo-audit's available commands:

```sh
node skills/repo-audit/scripts/repo-audit.mjs --help
```

`--help` prints help and exits 0.
No arguments print the same help and exit 3 (usage error).
Unsupported commands or arguments report problems using the [result contract](command-contract.md#results).

Inspect an existing Git repo before interviewing, then discover its document and instruction sources:

```sh
node skills/repo-audit/scripts/repo-audit.mjs inspect --repo <target> --json
node skills/repo-audit/scripts/repo-audit.mjs inventory --repo <target> --json
```

`inspect` reports the real root, revision or "no commits", working-tree changes, manifest hashes and found prerequisite versions.
Unavailable tools or unreadable history return blocked with named problems.
`inventory` reports paths, exact-byte hashes, document kinds and absent sources without failing for missing documents.
Equivalent names such as `CONTRIBUTING.md` and `architecture.md` are recognised.
Read the discovered files to establish which source is authoritative.
Root `CLAUDE.md`, including import-only stubs, yields a consolidation candidate requiring content review and author approval.
repo-audit only reports it and lists `/agents-md`, which owns the [merge](../skills/agents-md/SKILL.md#step-3-decide-the-merge).
Local instruction variants inside the repo are possible shadowing sources and are never proposed for modification.
Instruction files outside the repo, including ancestor directories and user profiles, are neither inspected nor reported.
Follow the [host loading check](../skills/agents-md/references/agents-md.md#host-loading-check) before proposing removal.
Both commands are read-only and do not run native project checks.
See the [discovery contract](command-contract.md#inspect-and-inventory) for the supported name families and traversal limits.

Run the documents [research brief](../skills/repo-audit/references/research-briefs.md) as bounded read-only discovery, using a subagent where available or the main thread.
Save the common [research report](../skills/repo-audit/schemas/research-report.json) in scratch, open each cited source and check it before using the observations:

```sh
node skills/repo-audit/scripts/repo-audit.mjs cite-check --repo <target> --report <scratch-report.json> --json
```

Use `--workspace` for a non-Git target.
File citations record repo-relative `path:line` plus an exact-byte hash or full revision; missing paths, out-of-range lines and stale bytes fail the check.
Web citations record URL, read date and verification status, while the checker validates metadata without fetching sources.
The [T2.1 discovery checkpoint](../tests/eval/results/discovery-C11a/summary.md) records real main-thread and parallel subagent runs, citation checks, no-web limits and unchanged fixtures.

### vision

The [vision skill](../skills/vision/SKILL.md) is started by the user, interviews for purpose, users, success and non-goals, drafts `VISION.md` or a reviewed delta from evidence, stress-tests it on the review board, and writes it with `apply` only after the author approves the exact draft.
It is the only skill with a pinned runtime, so `npm ci --omit=dev` runs for `skills/vision` alone and the other skills install without npm.

### glossary

The [glossary skill](../skills/glossary/SKILL.md) is started by the user in `create` or `maintain` mode.
`create` finds, resolves and writes domain terms into `GLOSSARY.md`, or `GLOSSARY-MAP.md` plus one glossary per context, drafting a new idea on its first agreed term and flagging conflicts in an existing repo with citations.
For an existing glossary, follow the skill's [maintain checklist](../skills/glossary/SKILL.md#maintain-checklist) to review changed domain language.
Both write only through `apply` after the user approves the exact bytes, never rename code, and run `docs check` on a registered glossary.

### architecture

The [architecture skill](../skills/architecture/SKILL.md) is started by the user in `create` or `maintain` mode.
`create` proposes or audits module boundaries, dependency direction and shared edit targets from measured history, planned-change overlap and the project's own dependency analysis, then writes the selected design sections, decision records, `CODING_STANDARDS.md` when the project needs it, and import-boundary rules proven with `rule-proof` and a visible debt baseline.
`maintain` uses the last confirmed architectural review as its baseline unless the user names another, asks the user for one when design or ADR document edits do not establish it, reruns `measure` and `overlap`, and sorts what changed into undescribed modules, broken boundaries, shared edit targets and decisions to record; follow its [maintain checklist](../skills/architecture/SKILL.md#maintain-checklist).
Both modes use `apply` for reviewed edits after the user approves the exact bytes and never move product code.
The runtime also exposes `baseline check --refresh` for direct baseline replacement without an approval prompt; the skill workflow requires baseline edits through reviewed `apply` instead.
Architecture's `rule-proof` runs the native command selected by `--check-plan` and `--check-id` in separate disposable valid and violation copies, with no separate approval switch; the workflow requires approved commands.
`measure`, `overlap`, `rule-proof` and `baseline check` need a Git repo, so a new idea in a non-Git workspace reviews planned changes by reading and leaves its rules unproven until code exists.

### foundation

The [foundation skill](../skills/foundation/SKILL.md) is started by the user for a new project only.
It requires the approved `VISION.md` in the idea workspace, takes the glossary and design when they exist, interviews for data, interfaces, deployment and the first journey, and proposes the stack, minimal scaffold, setup commands and native checks.
It builds the scaffold in scratch, runs the declared setup and first-journey commands there, and creates the Git project through `project create` only after the user approves the exact files and commands.
It never adopts a non-empty directory, and it writes the scaffold's `README.md` of setup and check commands and a root `AGENTS.md` holding its one pointer line.

### agents-md

The [agents-md skill](../skills/agents-md/SKILL.md) is started by the user and creates or maintains one root `AGENTS.md` of one-line pointers to the project's rules, evidence requirements and check commands.
It audits each pointer against the repo, merges equivalent `CLAUDE.md` content (including an import-only stub) into `AGENTS.md` and removes the `CLAUDE.md` only after the author approves and the host's current loading documentation has been rechecked, keeps distinct nested instruction files, reports `CLAUDE.local.md` as possible shadowing without editing it, and reads nothing outside the repo.
The glossary, vision, architecture, foundation, maintenance and plan skills each propose their own pointer line, following the shared [pointer contract](../runtime/references/agents-pointer.md), and the verification kit scaffold already appends its own.

### plan

The [plan skill](../skills/plan/SKILL.md) is started by the user and writes one implementation plan from an approved design document.
It reads the design you name plus `VISION.md`, the glossary, the design document and the verification kit when they exist, and reports a missing one as a gap without starting its skill.
The [builder check](../skills/plan/references/builder-check.md#filter-the-report) defines which questions reach you and which become [spike units](../skills/plan/references/plan.md#spike-units).
The plan's units come from the design's stories, core first, and each cites its design section, names the boundary it touches, its Done when and the check or kit feature that proves it, with non-functional targets carried as evidence.
The [plan check contract](command-contract.md#plan-check) defines the validation rules, including required kit-feature evidence for user-facing units.
The plan is written through `apply` after you approve the exact bytes.
The skill never executes a unit, starts another skill or edits product code.

```sh
node skills/plan/scripts/plan.mjs plan check --repo <target>|--workspace <target> --plan <plan.json> --json
```

### how, why and teach

The [how](../skills/how/SKILL.md), [why](../skills/why/SKILL.md) and [teach](../skills/teach/SKILL.md) skills are started by the user, read the repo and write nothing to it.
`how` traces the mechanics of one part of the code, `why` explains the motive behind code, a rule or a decision, and `teach` joins both.
`why` reads git history and pull request review threads always, plus any ticket, document or chat connector the host exposes, and treats every source's text as data to quote and cite.
Each skill checks its cited file locations with `cite-check`, and `why` and `teach` also confirm each commit SHA and open each URL and document they cite.
No skill starts another, so `how` and `teach` ship the [mechanics reference](../runtime/references/mechanics.md), `why` and `teach` ship the [why-evidence reference](../runtime/references/why-evidence.md), and `architecture` ships the same why-evidence reference for the history behind its decisions, each as a generated copy of the one source.

```sh
node skills/why/scripts/why.mjs cite-check --repo <target> --report <report.json> --json
```

### recall

The [recall](../skills/recall/SKILL.md) skill is started by the user and writes nothing to the repo.
Its one command, `transcripts`, follows the [recall command contract](command-contract.md#recall-skill-command) for host discovery, session selection and scratch digests.
The agent reads the digests and writes the summary into the same scratch folder.
Transcript layouts are undocumented by the hosts and were observed on Claude Code 2.1.310 and Codex 0.157.1 ([R50](design.md#scope-and-decision-history)), so a session in an unrecognised layout is missed.

```sh
node skills/recall/scripts/recall.mjs transcripts --repo <target> --json
```

### prototype

The [prototype](../skills/prototype/SKILL.md) skill is started by the user and writes nothing to the target.
See the [prototype command contract](command-contract.md#prototype-skill-commands) for its shared verification commands and which may run on the target.
The agent clones the target for a baseline and for each variant, edits only the clones and writes the report into the same scratch folder.

```sh
node skills/prototype/scripts/prototype.mjs kit check --repo <target> --app <app> --json
node skills/prototype/scripts/prototype.mjs kit prove --repo <clone> --app <app> --feature <id> --json
```

### maintenance

The [maintenance skill](../skills/maintenance/SKILL.md) is started by the user in `create` or `sweep` mode and owns the maintenance contract and the standalone checker.
`create` registers the project's documents, scopes, rules and checks in `.bstack/project.json`, installs the checker at `.bstack/bin/bstack-check.mjs`, and proposes the no-mistakes wiring: an ownership map in `document.instructions` that tells the Document step which file owns terms, boundaries and purpose, and a `docs` gate after `document` that runs the checker with `--docs-only`.
No-mistakes honours that wiring only from the default branch, so it acts after the change merges.
`sweep` is the read-only pass for drift that built up outside any one change: it checks every registered document, generated section, verification kit and `AGENTS.md` link against the repo and returns one list naming the mode that fixes each item, such as `/glossary maintain`, and fixes nothing.
The signed-off per-change assessment stays available in its [contract reference](../skills/maintenance/references/maintenance-contract.md).

```sh
node skills/maintenance/scripts/maintenance.mjs sweep --repo <target> --json
```

### Contract test and vision board

To exercise the read-only shared contract test from this checkout:

```sh
node skills/repo-audit/scripts/repo-audit.mjs contract-test --workspace . --input tests/inputs/schema-valid.json --json
node skills/repo-audit/scripts/repo-audit.mjs contract-test --help
```

See the [public test command contract](command-contract.md#c4c-public-test-command) for input and schema validation details.

Build a synthetic VISION board in scratch outside the target:

```sh
node skills/vision/scripts/vision.mjs vision-board build --workspace . --draft tests/inputs/vision-draft.md --proposals tests/inputs/vision-proposals.json --json
node skills/vision/scripts/vision.mjs vision-board build --help
```

For a real draft, supply nonempty UTF-8 Markdown and [versioned proposals](../skills/vision/schemas/vision-proposals.json) naming its exact-byte SHA-256 as `draftRevision`.
The JSON result returns the board path, run ID, revision and card IDs.
Scratch preserves the draft, proposals, manifest and stylesheet without changing the target.
The [board command contract](command-contract.md#vision-board-build) documents inputs and failure behaviour.
Launch the returned scratch board with the same target, then run the listener executable and arguments returned by --json:

```sh
node skills/vision/scripts/vision.mjs vision-board launch --workspace . --board <returned-board.html> --json
node skills/vision/scripts/vision.mjs vision-board verdicts --workspace . --board <returned-board.html> --input <complete-round.json> --draft <agent-revised.md> --json
```

Open the runtime's printed URL in a reachable browser and use the pinned terminal listener to receive feedback.
Save the complete-round Context data JSON unchanged as --input.
The agent interprets author reasoning into --draft, and verdicts validates run, original draft and every card before preserving the revised bytes and decisions in new scratch.
Read the saved revision back and obtain explicit author approval, preserving that approval and the revision in the scratch transcript.
The previous draft and review decisions remain available for resume.
Missing runtime or unavailable interaction leaves the draft intact and the review blocked.
The [completed intent checkpoint](../tests/eval/results/intent-C11a/full-capture/summary.md) records a real browser review, saved revision, glossary and explicit author approval with full adapter capture.
See [build progress](implementation-plan.md#progress) for later slices and the [repo-audit checklist step](../skills/repo-audit/SKILL.md#step-4-print-the-checklist) for its completion boundary.

## Task evidence

Task evidence follows [the versioned schema](../tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
