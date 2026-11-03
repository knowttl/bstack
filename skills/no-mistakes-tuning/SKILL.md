---
name: no-mistakes-tuning
description: Tune a repo's no-mistakes gate so review stays on likely, practical defects, fix loops stay bounded, and trivial or config-only changes skip agent review, writing only the approved .no-mistakes.yaml.
disable-model-invocation: true
---

## Scope

Only the user starts no-mistakes-tuning.
Start this procedure only when the user's message explicitly invokes `$no-mistakes-tuning`, `/no-mistakes-tuning`, `/skill:no-mistakes-tuning` or selects it through the host's skills menu.
A plain request such as "make no-mistakes faster" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target before proceeding: an existing repo is passed as `--repo`.

This skill proposes a balanced review profile for the repo's `.no-mistakes.yaml` and explains every choice.
The profile keeps review on defects a real user or caller would hit, bounds the automatic fix loop, and lets changes that touch only trivial or configuration files skip the agent review.
It edits only the review-tuning keys: `auto_fix`, `ignore_patterns` and `review.path_instructions`.
Every other key in the file stays byte-for-byte as it is.
Test and lint commands and gates belong to `/verification`, and the Document step's ownership map belongs to `/maintenance`; name those skills instead of editing their keys.
Settings that live only in the machine's global no-mistakes config, such as review models and effort, are reported as recommendations and never written.
Return the result to the project's chosen workflow instead of starting another skill.
Never start, stop, update or reconfigure the no-mistakes daemon, never run `no-mistakes init` and never push.
Keep notes, history summaries and drafts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Inspect the repo and its gate
- [ ] Step 2: Read the run history
- [ ] Step 3: Draft the profile
- [ ] Step 4: Review and apply
- [ ] Step 5: Report

### Step 1: Inspect the repo and its gate

Run `no-mistakes --version` and record the installed version.
Read the [configuration surface](references/surface.md).
When the installed version is older than the earliest version the reference names, check each key you plan to propose in that version's `docs/src/content/docs/reference/repo-config.md` at its release tag in the no-mistakes source repository, and drop any key it does not document.
Never update no-mistakes to confirm a key; report the version gap instead.
Read `.no-mistakes.yaml` from the working tree and from the default branch, because no-mistakes honours `review.path_instructions`, `commands`, `gates` and other gate-control keys only from the default branch's copy.
Record which keys each copy sets and any difference between them.
Read the global config at `~/.no-mistakes/config.yaml`, read-only, for its `auto_fix` values and `review_agents`, so the proposal states the effective value of each key.
Inventory the repo: languages and manifests, lockfiles, generated or vendored trees, documentation folders, CI and editor configuration, agent instruction files and test layout.
List the files that count as trivial for this repo using the trivial-change list in the [profile reference](references/profile.md#trivial-changes), and check each glob against real paths in the repo.

Done when: The installed version, both copies of the config, the effective global values and the repo inventory are recorded, and every trivial-change glob matches at least one real path or is dropped.

### Step 2: Read the run history

Run `no-mistakes runs --limit 50` in the target for the run count, statuses, branches and head commits.
Run `no-mistakes axi status` for the IDs of the ten most recent runs, then for each `no-mistakes axi status --run <id>` and `no-mistakes axi logs --run <id> --step review --full`; older runs have no listed ID, so say how many runs the detail covers.
Use `no-mistakes stats --run <id>` for the review passes, fix turns and agent time of each run; plain `no-mistakes stats` reads every repo on the machine and is slow.
Record each step's share of run time: when configured test or lint commands dominate, say so, because the keys this skill edits cannot shorten them, and name `/verification`.
Find each run's changed files from its pull request on the host, read-only, or from `git diff --name-only` between its base and head when both commits are present.
Only read: never respond to a gate, rerun, abort or answer anything.
Count review rounds per run, findings by severity and action, findings the user skipped or approved without a fix, and runs whose changed files were all trivial.
Classify each sampled review finding with the classes in the [profile reference](references/profile.md#finding-classes).
When the repo has no run history, say so and use the profile's defaults unchanged.

Done when: The history summary in scratch states the runs read, rounds per run, the finding classes with counts, the trivial-change runs and any data that could not be read, or records that no history exists.

### Step 3: Draft the profile

Start from the [profile reference](references/profile.md) and adjust each value only with a reason from Steps 1 and 2.
Draft the complete `.no-mistakes.yaml` in scratch: the existing keys unchanged and in place, plus the proposed `auto_fix`, `ignore_patterns` and `review.path_instructions` values.
Merge with existing values instead of replacing them: keep every existing ignore pattern and path instruction unless the user selects its removal.
When an existing instruction asks the reviewer to widen scope, such as one that forbids limiting findings, propose deleting only those phrases as a separate selectable edit and keep the rest of the entry, so the review prompt never holds contradictory instructions.
When an existing instruction already says what the focus instruction says, propose no duplicate.
Edit within an existing entry by deleting the phrases in place, keeping its YAML scalar style, and write new entries in the style the file already uses.
For each proposed value, including values that already match the profile and stay unchanged, write one line with the setting, the current effective value, the proposed value, the reason, and the class of defect it trades away, if any.
When a value trades away detection of a class of defect, such as skipping review for a path that can carry behaviour, present it as a decision with its options instead of choosing silently.
Keep the review instructions short and in plain words; they share the review prompt's size budget.

Done when: The draft in scratch parses as YAML, every key outside `auto_fix`, `ignore_patterns` and `review.path_instructions` stays byte-for-byte unchanged, every proposed value has its reason and trade-off, and every decision has its options.

### Step 4: Review and apply

Present the proposal table, the decisions, and a unified diff of the current and drafted `.no-mistakes.yaml` made with `diff -u`.
Let the user select, change or reject each proposed value, then redraft and show the exact bytes again.
Record one finding in scratch following `schemas/findings.schema.json` with stage `audit`, category `debt`, status `selected`, the target and `.no-mistakes.yaml` as its reviewed scope, and a change set following `schemas/change-set.schema.json` that creates or replaces only `.no-mistakes.yaml` with the exact approved UTF-8 bytes and their hashes.
Category `decision` blocks `apply` until the decision is resolved, so settle every decision with the user before recording the finding.
Include `starting-checks` in the findings' `requiredOutcomes`, as required by stage `audit`.
Use mode `repo` with the current revision.
In the change set, `findings` is the findings file's path relative to the plan, each `reviewedScope` entry carries `path` and the absolute `resolvedPath`, and the one edit uses operation `create` when the file is absent and `replace-file` otherwise, with the bytes in `payload.content` and `proposedContent`.
`apply --help` states the digest rules for `findingsDigest` and `planDigest`.
Run `node scripts/no-mistakes-tuning.mjs apply --repo <target> --plan <file> --dry-run --json` and check that its proposed content equals the approved bytes.
Run the unchanged plan without `--dry-run` only after the user approves those bytes; `--approved-fingerprint` applies only to assessment writes, which this skill never makes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.
When the user wants a proposal only, stop after the dry run and write nothing.

Done when: Only the approved `.no-mistakes.yaml` has been written, with unchanged hash preconditions and a recoverable original, or the user chose a proposal only, or the write remains blocked with its reason.

### Step 5: Report

State the installed version, the history read, the selected and rejected values with their reasons, and the written path or that nothing was written.
State that the review instructions take effect only after the file reaches the default branch, and that `auto_fix` and `ignore_patterns` apply from the pushed branch.
Give the per-run skip commands from the [profile reference](references/profile.md#per-run-skips) for changes the config cannot recognise by path, and its [driving rules](references/profile.md#driving-rules), because no setting bounds the review passes a driver chooses.
List the global-config recommendations as not applied, with the exact keys.
Name `/verification` for test or lint command changes and `/maintenance` for documentation ownership, when the history points at them.

Done when: The report names what was written or why nothing was, when each value takes effect, the per-run skip commands, the global recommendations and every open decision.

## Review before apply

Keep notes, history summaries and drafts in scratch until the user selects changes.
Present each value's reason, trade-off and effective scope, then the exact bytes.
A scope change needs a decision, not a silent widening.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/no-mistakes-tuning.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Checking which keys exist, where each is read from and what no-mistakes cannot do | `references/surface.md` |
| Choosing values, classifying findings or listing trivial changes | `references/profile.md` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
