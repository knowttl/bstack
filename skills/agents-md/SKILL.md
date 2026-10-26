---
name: agents-md
description: Create and maintain one root AGENTS.md of pointers to a project's rules, evidence requirements and check commands, merging equivalent CLAUDE.md content into it.
disable-model-invocation: true
---

## Scope

Only the user starts agents-md.
Start this procedure only when the user's message explicitly invokes `$agents-md`, `/agents-md`, `/skill:agents-md` or selects it through the host's skills menu.
A plain request such as "write an AGENTS.md" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target before proceeding: an existing repo is passed as `--repo`, and an existing directory that is not a Git repo is passed as `--workspace`.

This skill creates the root `AGENTS.md` when the project has none and maintains it when it has one.
The file holds pointers to the project's rules, evidence requirements and maintained check commands, never full copies of them.
Every other skill adds only the one line for what it wrote; this skill owns the file, its structure, the `CLAUDE.md` merge and the pointer audit.
It keeps distinct nested instruction files as they are, reports `CLAUDE.local.md` as possible shadowing without editing it, and inspects and reports nothing outside the selected repo, including ancestor directories and user profiles.
It removes a `CLAUDE.md` only after rechecking the host's official loading documentation and getting the author's approval.
It writes no document other than instruction files, and it neither edits product code nor opens pull requests.
Return the result to the project's chosen workflow instead of starting another skill.
Keep drafts, audit notes and transcripts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Inventory the instruction files
- [ ] Step 2: Audit the pointers
- [ ] Step 3: Decide the merge
- [ ] Step 4: Draft AGENTS.md
- [ ] Step 5: Review and apply
- [ ] Step 6: Check and report

### Step 1: Inventory the instruction files

Run `node scripts/agents-md.mjs inventory --repo <target> --json`, with `--workspace` for a directory that is not a Git repo, and keep the output in scratch.
Read every instruction file it lists, and read the sources the project already has for rules, evidence requirements and check commands.
Classify each instruction file as the root `AGENTS.md`, a scoped file that governs a nested directory, a repo-owned `CLAUDE.md`, or a local variant.
Load the [AGENTS.md guide](references/agents-md.md) for the classes, equivalence and what counts as a source.

Done when: Every instruction file is classified, the merge candidates and shadowing reports from `inventory` are noted, and the project's rule, evidence and check-command sources are listed or reported as absent.

### Step 2: Audit the pointers

Check each existing pointer line in the root `AGENTS.md` against the repo.
Report a link whose target is missing, a pointer to something that is not a project source, a line that copies a rule instead of pointing to it, and a source of rules, evidence requirements or check commands that no line points to.
Check that a pointer to a check command names a command the project actually defines.
Leave each pointer another skill added as it is unless its target is gone or the user selects a change.
Content the root file holds that no other source holds stays in place and is reported, because moving it into a source is a separate change.

Done when: Every pointer is marked resolving, broken or copying with its evidence, every unpointed source is listed, and no existing line has been judged without opening its target.

### Step 3: Decide the merge

A repo-owned `CLAUDE.md` or `.claude/CLAUDE.md` whose content is equivalent to the `AGENTS.md` in its scope, including a file that only imports it, is a merge candidate.
Distinct scoped guidance keeps its file and its meaning, and `CLAUDE.local.md` is reported as possible shadowing and never proposed for change.
Before proposing a removal, recheck the current host's official loading documentation and the runtime where available, as the guide describes, and state the compatibility limits for sessions that read only `CLAUDE.md`.
Ask the author, with the limits and the alternative of keeping the import stub, before any removal is proposed.
Resolve parent decisions first, group only independent questions into a small round and wait for answers.
Silence is not approval.

Done when: Each candidate has a decision to merge, keep or leave, the host check and its date are recorded, and each shadowing report is stated.

### Step 4: Draft AGENTS.md

Draft the complete root file in scratch following the pointer shape in the [pointer guide](references/agents-pointer.md), keeping the lines other skills added and the author's order.
Add pointers only for sources that exist, and word each as one sentence saying when an agent should use the source.
Fold in repo-owned `CLAUDE.md` content that the author chose to merge, as pointers where a source already holds it and as kept text where none does.
Leave out vocabulary, vision, design and standards text.
Write the sentences by the [writing reference](references/writing.md).

Done when: The draft is in scratch, every line is a pointer or merged text the author chose to keep, and every link resolves.

### Step 5: Review and apply

Record one finding in scratch following `schemas/findings.schema.json` with stage `audit`, the target and the instruction paths as its reviewed scope, and a change set following `schemas/change-set.schema.json`.
The change set creates or replaces `AGENTS.md` with the exact approved UTF-8 bytes and their hashes, and deletes each selected `CLAUDE.md` with a `delete` edit in that same plan.
Include `starting-checks` in the findings' `requiredOutcomes`, as required by stage `audit`.
A repo uses mode `repo` with its current revision, and a directory that is not a Git repo uses mode `workspace` with a null revision.
Run `node scripts/agents-md.mjs apply --repo <target> --plan <file> --dry-run --json`, with `--workspace` for a directory that is not a Git repo, present the exact diff and the host compatibility limits, then run the unchanged plan without `--dry-run` only after the author approves those bytes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.

Done when: Only the approved instruction files have been written or deleted, with unchanged hash preconditions and recoverable originals, or the write remains blocked with its reason.

### Step 6: Check and report

Run `inventory` again with the same target flag and confirm that the file kinds and candidates match what the plan intended.
Open each pointer target in the written file to confirm it resolves.
State the target, the instruction files found and their classes, each pointer's result, the merge decisions with the host check and its limits, and the written and deleted paths.
Name every shadowing report, every unpointed source left for its skill or the author, and any step left blocked with its missing prerequisite.
Name the skills that add pointers, `/glossary`, `/vision`, `/architecture`, `/foundation`, `/verification` and `/maintenance`, as the way later pointers arrive, and start none of them.

Done when: The report names what was written or why nothing was, the host check behind any removal, and every open decision.

## Review before apply

Keep drafts, audit notes, transcripts and previews in scratch until the user selects changes.
Present each edit's problem, consequence, fix, scope and verification, then the exact bytes.
A scope change needs a decision, not a silent widening.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/agents-md.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Classifying instruction files, judging equivalence or checking the host before a removal | `references/agents-md.md` |
| Writing the sentences of the file | `references/writing.md` |
| Drafting the file or auditing its pointers | `references/agents-pointer.md` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
