# bstack

bstack helps developers establish project-specific guidelines, rules and checks for agents.
The approved [design](docs/design.md#summary) owns the release scope, and the [implementation plan](docs/implementation-plan.md) tracks the repo-audit build.
The [standalone verification amendment](docs/design.md#standalone-verification-skill) is approved design with the shared runtime and the verification skill's `create` mode implemented; `maintain`, the no-mistakes wiring with its coverage gate, and installation remain pending.
The installation and usage below apply to the implemented repo-audit skill.

This checkout contains the [repo-audit procedure](skills/repo-audit/SKILL.md), interview, domain-language, vision, research, enforcement and architecture references, read-only starting-state inspection, document inventory, history measurement and planned-path overlap, findings validation and scratch reports, check-plan execution capture and live probe pairs, board build, launch and verdict ingestion with a pinned runtime, citation validation, and the completed T0.4 shared library described in the [command contract](docs/command-contract.md).
The procedure defines both audit checklists, review before apply, protected writes and outcome verification.
Use the load-when table to read the self-contained intent interview for a new idea, grilling for a material unresolved decision, or domain-language guidance for unclear terms.
These establish confirmed intent and draft vocabulary while keeping technical decisions in their existing sources.
Follow the [load-when table](skills/repo-audit/SKILL.md#load-when) for the enforcement and architecture references when reviewing test necessity and cost or recommending design principles, checks or module boundaries.
These provide project-specific guidance, native rule-proof, debt baseline checks and selected maintained local integration.
The existing-repo audit and selected apply path are available.
Protected new-project creation is available after the intent checkpoint and exact foundation review.
Use the [maintenance reference](skills/repo-audit/references/maintenance-contract.md) for bounded change assessment and local or standalone validation without repeating the interview or full audit.
The copy installer supports previews, verified no-op repeats, updates, uninstall and interrupted-run resume.
Link installation, explicit developer-checkout updates and owned-link removal are available.
The owner accepted Linux-only installer lifecycle evidence for C25c and AC-74 on 2026-10-10.
Windows and macOS execution remains unverified and is outside this acceptance scope.
Use the procedure for bounded planning and selected protected writes, keeping blocked steps visible.
Reviewed plans support protected writes, recoverable originals and hash-derived resume as described below.
Nothing is published to npm.

Clone the source and install its dependencies using Node 24 or later, Git and npm:

```sh
git clone https://github.com/knowttl/bstack.git
cd bstack
npm ci --ignore-scripts
npm ci --omit=dev --prefix skills/repo-audit
```

From this checkout, preview and then copy the complete skill into an existing project.
Replace `<project-path>` with the target directory; quote paths containing spaces:

```sh
node install/install.mjs --scope project --project <project-path> --host all --dry-run
node install/install.mjs --scope project --project <project-path> --host all --json
node scripts/check-package.mjs --skill <project-path>/.agents/skills/repo-audit
```

Use `--scope user --host agents` for the current home, or `--host claude` for Claude Code alone.
`--host all` selects both `.agents/skills/repo-audit` and `.claude/skills/repo-audit` beneath the selected home or project.
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
The [installer contract](docs/command-contract.md#installer-copy-and-preview-c25a) describes ownership, conflict decisions and failure recovery.
An exact clean semantic Git tag is reported as the source version, while untagged or dirty sources are explicitly labelled development.
Installation tests use disposable release snapshots and a locally packed fake runtime, and do not establish real Windows/macOS runs or current-agent skill loading.

To start an audit, open a fresh agent conversation in the target project and explicitly invoke the skill with the area to assess and the next change:

```text
$repo-audit
Audit this repo's checkout boundary before adding quantity support.
Use the existing design and acceptance cases; present findings for selection before editing.
```

That is the Codex invocation; use `/repo-audit` in Claude Code or `/skill:repo-audit` in Pi.
A plain request such as "audit this repo" does not start the skill.
For a new idea, install into its existing workspace and invoke the skill with the idea and first useful journey instead.
Answer unresolved intent questions, review the interactive vision board when needed, select findings, and approve the exact proposed changes before apply or creation.
The skill keeps proposals in scratch and reports blocked verification explicitly.
It does not select a delivery service for you.
See the [worked examples](docs/examples/README.md) for requests, findings, selections, results and reproduction steps.

The examples cover the six user-facing scenario fixtures: `new-idea`, `ambiguous-idea`, `clear-goals`, `existing-vision-delta`, `ts-shop` and `py-ledger`.
Rule-proof valid/violation controls, dirty-work and maintenance edge cases (`refactor`, `contract-removal`, `shallow-history`), and installer-collision fixtures are test infrastructure, not separate user skill runs.
They remain covered by command tests rather than worked examples.
Only `new-idea` and `ts-shop` have the completed installed final-path evidence from C27; the other four examples retain earlier checkpoint results and their limits.

Scripts check structure, references, selected paths, input freshness and captured command outcomes.
They cannot prove that an interview captured the user's goal, that a citation supports a claim, that prose or an impact explanation is true, or that an owner actually approved a design.
Measurements cannot prove semantic independence or predict every merge conflict, and passing native checks prove only their defined constraints.
Review and observed user journeys remain necessary; see the [design's machine-check limits](docs/design.md#what-machines-can-check).

The [recorded instruction-loading limit](docs/design.md#reusable-guidance-for-future-changes) matters before consolidating repo-owned guidance into `AGENTS.md`.
Claude Code reads it only when no `CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or above it.
Versions before v2.1.277, some Amazon Bedrock or no-telemetry sessions before v2.1.281, and sessions with the built-in `AGENTS.md` plugin disabled can read only `CLAUDE.md`.
Removing that file can therefore hide project instructions in those sessions.
Recheck the host's official documentation and observed loading behaviour before approving removal; bstack neither inspects nor changes instruction files outside the selected repo.

The examples' actual agent evidence uses one agent family and model: Codex with gpt-6.1-sol, not a host or model matrix.
The four earlier checkpoints ran on Linux 6.8.0-142-generic with Node v24.17.0 and codex-cli 0.160.1; the foundation audits used low reasoning.
C27's two installed full paths and its fresh repeat-audit, independent-extension and maintenance conversations ran on the same Linux kernel and Node version, using codex-cli 0.162.1 with medium reasoning.
The [C27 record](tests/eval/results/full-path-C27/summary.md#host-provenance-and-evidence-limits) names exact source revisions, native tool versions, isolated installations, manual scoring and browser/local HTTP observations.
Scoring came from the implementation agent, not an independent human study; fixture answers and approvals were scripted or delegated fixture verdicts.
No new real-agent run is claimed by this documentation change.
Separate script and installer records include local Node 24 and Node 26 runs, not real-agent runs on both versions.
Installer support and AC-74 acceptance are Linux-only under the owner's 2026-10-10 ruling R27; Windows and macOS execution is unverified.
Hosted CI behaviour, CI adapter execution and forge enforcement are unverified.
This repository has no hosted CI workflow; local clean-checkout results do not establish hosted execution.
Repeated-run release qualification and release approval remain separate work.

Use Node 24 or later:

```sh
npm ci --ignore-scripts
npm ci --omit=dev --prefix skills/repo-audit
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

`check` first verifies the [shared runtime](runtime/) copies, then runs the package checks for user-only metadata, local resource paths, reference loading, line limits, literal script imports, top-level constant comments, step completion lines and bundled language policy, followed by the [standalone checker freshness gate](docs/command-contract.md#standalone-checker-generation).
It reports every detected problem with a stable rule code and exits 1 on failure.
See the [package check contract](docs/command-contract.md#package-check) for exact syntax and limits.
Local validation installs both the root development lock and the nested skill runtime lock, then runs the package check and full tests.
T0.6 recorded Node 24 and Node 26, while each later task records the versions it actually tested.
The no-mistakes gate installs both locks, runs tests and runs the distinct package check through `commands.lint`.
Recorded runs on Linux do not prove support on Windows or macOS.
Follow the [existing-repo path](skills/repo-audit/SKILL.md#existing-repo-path-checklist) for audit-before-interview, selected apply, instruction consolidation, vision review and final verification requirements.
See the [C27 final-path evidence](tests/eval/results/full-path-C27/summary.md) for completed installed paths, repeated audit, independent extension, bounded maintenance and observed limitations.

Collect repeatable size and change-history signals, or compare two declared change plans:

```sh
node skills/repo-audit/scripts/repo-audit.mjs measure --repo <path> --range <base>..<head> --json
node skills/repo-audit/scripts/repo-audit.mjs measure --repo <path> --range HEAD --exclusions <file> --json
node skills/repo-audit/scripts/repo-audit.mjs overlap --repo <path> --plans <file> <file> --json
```

See the [measurement and overlap contract](docs/command-contract.md#measure-and-overlap) for input examples, lineage handling, exclusions and glob semantics.
Measurements include supporting commits, rename handling and the resolved revision range.
Only eligible files present at the range endpoint are measured, following detected lineage back through renames to addition commits.
If a path is deleted on one line of history and reused by an unrelated file, then merged with a branch that edited the old file, the old lifetime's commits and co-change pairs can be attributed to the new file.
Signals are advisory evidence, never violations, and do not establish semantic independence or observed conflicts.

Validate cited findings and render a proposed audit record outside the target:

```sh
node skills/repo-audit/scripts/repo-audit.mjs findings validate --repo <path> --findings <file> --json
node skills/repo-audit/scripts/repo-audit.mjs findings render --repo <path> --findings <file> --json
```

Use `--workspace` for a draft foundation without Git.
The [findings contract](docs/command-contract.md#findings) defines the schema, complete input examples, stage outcomes and verdict precedence.
Validation returns the current fingerprint for subsequent evidence capture.
Rendering returns a scratch path and one readiness result with documented, observed and inferred sources, selected findings and remaining debt.
Missing or stale evidence blocks readiness, and unresolved decisions require review.
These commands assess supplied evidence without executing checks or applying changes.

Preview selected edits, then apply the reviewed plan or resume its interrupted run:

```sh
node skills/repo-audit/scripts/repo-audit.mjs apply --repo <path> --plan <file> --dry-run
node skills/repo-audit/scripts/repo-audit.mjs apply --workspace <path> --plan <file> --dry-run --json
node skills/repo-audit/scripts/repo-audit.mjs apply --repo <path> --plan <file> --json
node skills/repo-audit/scripts/repo-audit.mjs state show --repo <path> --run <returned-run-id> --json
npm test -- --task T2.6
```

The [apply contract](docs/command-contract.md#apply-dry-run) documents the reviewed change set, exact-byte hashes, digest and supported operations.
Dry-run plain output prints the complete diff; dry-run JSON additionally returns complete proposed content and hashes.
Omit `--dry-run` to apply after review.
See the apply contract for resume and completed-plan behavior.
Use `replace-file` with complete reviewed UTF-8 content when a mechanical edit is unsupported, including the audit record rendered by T2.5.
`state show` reports actual applied, pending and conflicting files and affected checks to rerun.
See the apply contract for preflight protection, backup and journal recovery, and filesystem limits.

Create an approved minimal project inside the existing idea workspace:

```sh
node skills/repo-audit/scripts/repo-audit.mjs project create --workspace <idea-workspace> --plan <file> --dry-run --json
node skills/repo-audit/scripts/repo-audit.mjs project create --workspace <idea-workspace> --plan <file> --json
```

The [creation contract](docs/command-contract.md#protected-project-creation) documents the versioned plan, selected destination, scratch scaffold and exact diff.
The owner selects the stack, scaffold and first journey after approving the scratch vision.
Follow [Step 5](skills/repo-audit/SKILL.md#step-5-review-and-apply-selected-changes) for scratch verification and repair before presenting the exact files, declared commands and captured results or verification limits for approval.
Creation journals directories and files through the existing protected-write engine before initialising Git only at the reviewed destination.
Repeat the unchanged plan to resume directory, file or Git interruption.
Failed or interrupted setup and journey commands retain the project as unverified and are not rerun automatically.
Maintained enforcement is available through selected `apply` edits, as described below.
Project contract validation, change collection, local assessment validation and generated-fact freshness checks are available below.
Portable maintenance is available through the [standalone checker](docs/command-contract.md#standalone-checker-execution), using an explicit base and committed assessment.

Prove a selected native rule against prepared clean and independently seeded fixtures:

```sh
node skills/repo-audit/scripts/repo-audit.mjs rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json
npm test -- --task T3.2
```

Prepare native dependencies in the fixtures first.
See the [enforcement command contract](docs/command-contract.md#rule-proof-and-temporary-debt) for check selection, saved proof evidence and coverage limits.

Check a temporary baseline when the native tool has no baseline feature:

```sh
node skills/repo-audit/scripts/repo-audit.mjs baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --json
node skills/repo-audit/scripts/repo-audit.mjs baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --refresh --json
node skills/repo-audit/scripts/repo-audit.mjs baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --refresh --finding <id> --findings <file> --entry <file> --json
npm test -- --task T3.3
```

Prepare an existing baseline file and normalized native violations as described in the [enforcement command contract](docs/command-contract.md#rule-proof-and-temporary-debt), including the requirements for authorizing new entries.

Integrate selected native checks into the project's existing check command through a reviewed `apply` plan.
Keep package rules scoped to their owning package and prepare the complete documented initial debt baseline through selected findings before expecting an audited project to pass.
Prove each rule independently on the clean fixture variants, then use `rule-proof` with the identical maintained command, such as `npm run check`, on separate valid and seeded disposable copies.
The target owns the checker and its declared dependencies, so ordinary contributors can run it without an installed skill or agent session.
Declare selected command paths in each edit's `checkIntegration` using the [enforcement reference](skills/repo-audit/references/enforcement.md#integrate-the-maintained-command), which owns the supported command grammar and CI format.
The identical maintained-command disposable controls remain the enforcement proof.
CI integration requires the project's selection and its adapter behaviour remains unverified until hosted execution is observed.
Run `npm test -- --task T3.4` for the maintained-command, baseline and web/core scope controls.

Validate the project's small maintenance contract and collect the final changed paths:

```sh
node skills/repo-audit/scripts/repo-audit.mjs contract validate --repo <target> --contract .bstack/project.json --json
node skills/repo-audit/scripts/repo-audit.mjs evidence collect --repo <target> --base <ref> --json
# Before the first commit:
node skills/repo-audit/scripts/repo-audit.mjs evidence collect --repo <target> --base empty --json
npm test -- --task T3a.1
npm test -- --task T3a.2
node skills/repo-audit/scripts/repo-audit.mjs evidence validate --repo <target> --base <ref> --assessment <assessment.json> --contract .bstack/project.json --json
npm test -- --task T3a.3
```

`--contract` defaults to `.bstack/project.json` and accepts another repo-relative JSON contract path.
The [collection command contract](docs/command-contract.md#project-contract-and-change-collection) defines the schema, pointers, scopes, leaf checks and supported matching rules.
Follow the [maintenance procedure](skills/repo-audit/references/maintenance-contract.md) to assess each candidate, resolve decisions and supply evidence to the project's selected delivery gate.
Collection resolves the base, includes committed, staged, unstaged and new changes, and maps both paths of detected renames.
It returns candidate documents, unmapped paths and a scratch assessment path without changing the target.
Missing bases block collection; shallow history reports the required fetch commands.
The skeleton still needs semantic assessment and review; collection does not establish readiness.
Fill every candidate document and unmapped-path assessment with the changed behaviour, changed paths, source citations and a specific impact reason.
An `updated` result also names the actual before/after definition or rule excerpts; cosmetic changes cannot prove maintenance.
The [assessment validation contract](docs/command-contract.md#assessment-validation) documents review binding, initial foundation provenance, prior coverage and acceptance decisions.
Validation returns `data.fingerprint` even when review is stale.
Have the selected reviewer assess the substantive claims against the diff, then record that fingerprint in the assessment and validate again.
Attach `run-checks` captures as execution entries containing `runId` and the caller-relative `plan` path.
Required checks must match both previous and proposed policy; unresolved decisions remain blocked even when those checks pass.
Structural validation cannot prove semantic correctness or authenticate an owner's approval.

Check registered generated sections or prepare reviewed regeneration proposals:

```sh
node skills/repo-audit/scripts/repo-audit.mjs docs generate --repo <target> --check --json
node skills/repo-audit/scripts/repo-audit.mjs docs generate --repo <target> --json
```

The [generated-facts contract](docs/command-contract.md#generated-facts) defines registration, markers, exact-byte output and write detection.
Review scratch proposals through a selected protected `apply` change set before updating documents.

Check registered source paths, local Markdown links and context-specific glossary entries:

```sh
node skills/repo-audit/scripts/repo-audit.mjs docs check --repo <target> --json
npm test -- --task T3a.5
```

The [document-reference contract](docs/command-contract.md#document-references) defines supported links and glossary registration.
Duplicate terms fail only within one registered context; unsupported formats report coverage limits.
Use paired reviewed [`move-rule` edits](docs/command-contract.md#apply-dry-run) to preserve one authoritative rule and replace its old location with an exact link.
Prefer an existing standards source such as CONTRIBUTING.md or a design section before selecting a new file.

Capture a reviewed check plan with acceptance sources and input scopes:

```sh
node skills/repo-audit/scripts/repo-audit.mjs run-checks --repo <path> --plan <file> --json
node skills/repo-audit/scripts/repo-audit.mjs run-checks --repo <path> --plan <file> --phase before --json
# After the change, reuse the same plan and the returned before run ID:
node skills/repo-audit/scripts/repo-audit.mjs run-checks --repo <path> --plan <file> --prior-run <before-run-id> --json
npm test -- --task T2.7
```

For bug fixes and refactors, run the before capture before editing, then supply its run ID after the change.
Keep the returned scratch artifact as execution evidence.
The [check-plan contract](docs/command-contract.md#check-plans-and-capture) owns the schema, prerequisites, freshness rules, coverage verdicts and limitations.

For each outside dependency, record the same live call before and after the change:

```sh
node skills/repo-audit/scripts/repo-audit.mjs probe record --repo <path> --name <dependency> --phase before --spec <file> --json -- node scripts/probe.mjs <endpoint>
node skills/repo-audit/scripts/repo-audit.mjs probe record --repo <path> --name <dependency> --phase after --spec <file> --json -- node scripts/probe.mjs <endpoint>
node skills/repo-audit/scripts/repo-audit.mjs probe compare --repo <path> --name <dependency> --before <run-id> --after <run-id> --json
```

The [probe contract](docs/command-contract.md#live-probe-pairs) defines the descriptor, environment binding, per-call `--approved-by-user` flag and unavailable results.
The probe command must assert the agreed outcome and exit nonzero on disagreement.
Passing checks alone do not replace a successful probe comparison for an outside dependency.

The evaluation runner includes scenarios, all 75 acceptance procedures and a current-host Codex adapter.
Adapter runs create a fresh fixture, home, host state and cache, verify discovery isolation, and capture JSONL conversation turns.
See the [evaluation contract](docs/evaluation.md) for ordered reply delivery, bounded runs, throwaway authentication, scoring and comparison, and [automatic batches](docs/evaluation.md#automatic-batches-and-ledger) for repeated scenarios and aggregate ledger results.
Follow [evidence storage](docs/evaluation.md#evidence-storage-and-raw-run-archive) when publishing evaluation results and archiving raw runs.
Use [impact selection](docs/evaluation.md#impact-selection-and-comparison) to list scenarios affected by changes since a base commit.

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
The [release gate](docs/evaluation.md#release-gate) reads batch rates and candidate-bound hard-break results, requests confirmation below 3 of 5, and writes `release/<version>.json`.
Hard breaks and regressions block; other failures become known issues.
An adapter run also exits 2 until explicitly scored.
See the [recorded initial baseline](docs/evaluation.md#recorded-initial-baseline) for host provenance and scenario outcomes.
The [T1.3 gap map](tests/eval/results/gap-map.md) links every observed failure to the procedure and retains passing requirements.
The [intent checkpoint](docs/evaluation.md#intent-checkpoint-c10b) records two real with-skill runs and their limitations.
These runs do not establish complete audit execution or protected repo creation.
Close the conversation immediately when it finishes to delete its isolated home before reviewing the captured transcript.
The Codex adapter copies only the invoking user's existing login into throwaway state with private permissions, removes the copy after each turn, and deletes the whole home on close or a failed host turn.
See the [scoring contract](docs/evaluation.md#judge-and-human-scoring) for judge and human answers, transcript citations and captured machine verdicts.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.
For portable full-suite evidence, use `npm test -- --capture .cache/full-suite.json`, then `node scripts/task-evidence.mjs .cache/full-suite.json <task-id>`.
The [task evidence contract](docs/implementation-plan.md#task-evidence-contract) owns capture prerequisites, automatic capture during ordinary tests, input binding and refresh rules.
`npm test -- --task T0.4` selects the currently implemented shared-library tests.
`npm test -- --task T0.5` selects the currently implemented package-check tests.
See [task progress](docs/implementation-plan.md#progress) for the remaining slices.

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
See the [fixture contract](docs/fixtures.md) for sources and sanity commands.

Raw upstream development sources are committed outside the installed skill.
[The manifest](upstream/sources.json) owns their exact pins, copied paths and generated SHA-256 hashes, and [NOTICE](NOTICE) records adaptations.
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

The scripts and schemas behind `rule-proof`, `baseline check`, `run-checks`, `probe record`, `apply` and `state show`, with the `contract` and `findings` modules and shared libraries they import, have one source in [runtime/](runtime/).
`apply` and its protected-write libraries are shared so the standalone verification skill writes only reviewed, hash-checked change sets.
An installed skill cannot import outside its own folder, so [skills/repo-audit](skills/repo-audit/SKILL.md) and [skills/verification](skills/verification/SKILL.md) each commit a byte-for-byte copy at the same relative paths.
Edit only `runtime/`, then refresh the copies or verify them without writes:

```sh
node scripts/sync-runtime.mjs
node scripts/sync-runtime.mjs --check
```

`--check` exits 1 for a missing or modified copy, and both commands exit 1 if a runtime script imports a file outside `runtime/`.
Removing a file from `runtime/` also requires removing its copies by hand.
`npm run check` runs the verification, and `npm test` repeats it for the committed tree.

The [verification skill](skills/verification/SKILL.md) is started by the user and currently provides `create`: it interviews a repo, renders a verification kit as a reviewable change set, applies it after exact-diff approval and proves it once.
Its entry point and generators, documented in the [command contract](docs/command-contract.md#verification-skill-commands), run from a checkout like this:

```sh
node skills/verification/scripts/verification.mjs kit scaffold --repo <target> --plan <kit-plan.json>
node skills/verification/scripts/verification.mjs apply --repo <target> --plan <change-set.json> --dry-run
node skills/verification/scripts/verification.mjs kit prove --repo <target> --app <name> --feature <id>
node skills/verification/scripts/verification.mjs comment-check generate --repo <target> --language python
```

Its fixture acceptance needs Git, Python 3, Ruff and Go on `PATH`, and the TypeScript comment-checker test needs the `ts-shop` fixture's npm install.

Generate the standalone maintenance validator artifact from this checkout after installing the root development dependencies.
The generated file requires Node 24 or later and Git for repository validation.
Check freshness without writes, or generate current bytes and an installation proposal in scratch:

```sh
node scripts/generate-checker.mjs --repo . --check
node scripts/generate-checker.mjs --repo <target> --json
```

See the [generation contract](docs/command-contract.md#standalone-checker-generation) for scratch outputs, selected-plan installation and protection of existing copies.

Run the installed aggregate with an explicit repository, agreed ancestor base and selected assessment:

```sh
node .bstack/bin/bstack-check.mjs --repo <target> --base <commit> --assessment <assessment.json> --json
```

See the [execution contract](docs/command-contract.md#standalone-checker-execution) for portable review preparation, fresh leaf execution, previous-policy validation and the missing-base fetch prerequisite.
Hosted CI behavior remains unverified.

To view the available and planned commands:

```sh
node skills/repo-audit/scripts/repo-audit.mjs --help
```

`--help` prints help and exits 0.
No arguments print the same help and exit 3 (usage error).
Unsupported commands or arguments report problems using the [result contract](docs/command-contract.md#results).

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
See the [existing-repo apply procedure](skills/repo-audit/SKILL.md#step-10-review-and-apply-selected-findings) for which instruction candidates this path can apply.
Local instruction variants inside the repo are possible shadowing sources and are never proposed for modification.
Instruction files outside the repo, including ancestor directories and user profiles, are neither inspected nor reported.
Claude Code versions before v2.1.277, some Amazon Bedrock or no-telemetry sessions before v2.1.281, and sessions with the built-in `AGENTS.md` plugin disabled may read only `CLAUDE.md`.
Recheck current host loading behaviour before proposing removal.
Both commands are read-only and do not run native project checks.
See the [discovery contract](docs/command-contract.md#inspect-and-inventory) for the supported name families and traversal limits.

Run the five [research briefs](skills/repo-audit/references/research-briefs.md) as bounded read-only discovery, using independent subagents in parallel where available or the same briefs sequentially in the main thread.
Save the common [research report](skills/repo-audit/schemas/research-report.json) in scratch, open each cited source and check it before using the observations:

```sh
node skills/repo-audit/scripts/repo-audit.mjs cite-check --repo <target> --report <scratch-report.json> --json
```

Use `--workspace` for a non-Git target.
File citations record repo-relative `path:line` plus an exact-byte hash or full revision; missing paths, out-of-range lines and stale bytes fail the check.
Web citations record URL, read date and verification status, while the checker validates metadata without fetching sources.
Without web access, mark language and outside recommendations "not researched" with the reason.
The [T2.1 discovery checkpoint](tests/eval/results/discovery-C11a/summary.md) records real main-thread and parallel subagent runs, citation checks, no-web limits and unchanged fixtures.

To exercise the read-only shared contract test from this checkout:

```sh
node skills/repo-audit/scripts/repo-audit.mjs contract-test --workspace . --input tests/inputs/schema-valid.json --json
node skills/repo-audit/scripts/repo-audit.mjs contract-test --help
```

See the [public test command contract](docs/command-contract.md#c4c-public-test-command) for input and schema validation details.

Build a synthetic VISION board in scratch outside the target:

```sh
node skills/repo-audit/scripts/repo-audit.mjs vision-board build --workspace . --draft tests/inputs/vision-draft.md --proposals tests/inputs/vision-proposals.json --json
node skills/repo-audit/scripts/repo-audit.mjs vision-board build --help
```

For a real draft, supply nonempty UTF-8 Markdown and [versioned proposals](skills/repo-audit/schemas/vision-proposals.json) naming its exact-byte SHA-256 as `draftRevision`.
The JSON result returns the board path, run ID, revision and card IDs.
Scratch preserves the draft, proposals, manifest and stylesheet without changing the target.
The [board command contract](docs/command-contract.md#vision-board-build) documents inputs and failure behaviour.
Launch the returned scratch board with the same target, then run the listener executable and arguments returned by --json:

```sh
node skills/repo-audit/scripts/repo-audit.mjs vision-board launch --workspace . --board <returned-board.html> --json
node skills/repo-audit/scripts/repo-audit.mjs vision-board verdicts --workspace . --board <returned-board.html> --input <complete-round.json> --draft <agent-revised.md> --json
```

Open the runtime's printed URL in a reachable browser and use the pinned terminal listener to receive feedback.
Save the complete-round Context data JSON unchanged as --input.
The agent interprets author reasoning into --draft, and verdicts validates run, original draft and every card before preserving the revised bytes and decisions in new scratch.
Read the saved revision back and obtain explicit author approval, preserving that approval and the revision in the scratch transcript.
The previous draft and review decisions remain available for resume.
Missing runtime or unavailable interaction leaves the draft intact and the review blocked.
The [completed intent checkpoint](tests/eval/results/intent-C11a/full-capture/summary.md) records a real browser review, saved revision, glossary and explicit author approval with full adapter capture.
See [build progress](docs/implementation-plan.md#progress) for later slices and the [intent checkpoint](skills/repo-audit/SKILL.md#step-3-review-the-vision) for its completion boundary.

Task evidence follows [the versioned schema](tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
