---
name: readme
description: Create or audit a project's README.md so people find it, understand it in thirty seconds and can install it, and so an agent can set it up and run it without asking. Use when the user says "write a README", "audit our README" or "make the README setup steps work for an agent".
disable-model-invocation: true
---

## Scope

Only the user starts readme.
Start this procedure only when the user's message explicitly invokes `$readme`, `/readme`, `/skill:readme` or selects it through the host's skills menu.
A plain request such as "write a README" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target before proceeding: an existing repo is passed as `--repo`, and an existing directory that is not a Git repo is passed as `--workspace`.

This skill writes the project's selected README, or the README of one package the user names, and audits it when one exists.
The README is the first impression: it opens with the problem and the promise, makes the first actions obvious and short, stays scannable and links to deeper documents.
It writes no other document, and it does not edit product code, `AGENTS.md`, `CONTRIBUTING.md` or any file the README links to.
When the audit finds content that belongs in another document, it reports the content and the file that should hold it and leaves both unchanged.
The repository description and topics live on the host, outside the repo, so it reports the exact values to set and sets nothing.
Return the result to the project's chosen workflow instead of starting another skill.
Keep drafts, audit notes and transcripts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Gather the project facts
- [ ] Step 2: Audit the existing README
- [ ] Step 3: Draft the README
- [ ] Step 4: Review and apply
- [ ] Step 5: Check and report

### Step 1: Gather the project facts

Read every `README` file in the target, the manifest, the real install and run path, the documents the README links to or should link to, and the existing `AGENTS.md`.
For a GitHub repository, identify the displayed README using precedence `.github/`, then the root, then `docs/`, including `.github/README.md` and `docs/README.md`.
Use the displayed file unless the user named another README; when that selection differs, report the displayed path and any shadowed README explicitly and ask which one to maintain before drafting.
For a new README or a target without a host, use root `README.md` unless the user names a package README.
Record the selected path and use it throughout the audit, draft, approval, apply and checks.
Read the host metadata, the repository description and topics, only when it is available read-only, and otherwise report it as not read.
Run a command's `--help` or `--version` only when it has no side effects, and never run an install, a write or a login to learn what the README should say.
Choose the profile of the project from the [structure guide](references/structure.md): command line tool, skill pack or plugin, library, or service.
Record every fact the README will state as scratch notes following `schemas/research-report.json`, each with a repo location, and run `node scripts/readme.mjs cite-check --repo <target> --report <file> --json`, with `--workspace` for a directory that is not a Git repo.
The checker establishes locations and byte freshness, so open each cited source to confirm it supports the claim.

Done when: Every fact the README will state has a cited source or is marked as the user's own statement, the profile and README path are chosen, the displayed and any shadowed README are recorded, and each unreadable input is named.

### Step 2: Audit the existing README

Skip this step when the target has no README, and say so.
Follow the [audit procedure](references/audit.md) and walk the [checklist](references/checklist.md) against the README, the project facts and the host metadata.
Mark every block that belongs elsewhere by the [leave-out list](references/leave-out.md).
Record each finding with its problem, consequence, evidence, fix, scope and verification, and run the cold-start test from the audit procedure.
Present the findings ordered by severity and let the user select which to fix.

Done when: Every checklist item is marked pass, fail or not applicable with evidence, the cold-start answers are recorded with their README lines, and each finding has a severity and a proposed fix, or the target has no README.

### Step 3: Draft the README

Draft the complete README in scratch following the [structure guide](references/structure.md), keeping the author's existing content and voice where the checklist passes it.
Open with the problem and the promise, then the install path, the single entry point, an example, the catalogue, configuration and the links to deeper documents.
State only facts from Step 1, and label anything unbuilt as pending.
Write the sentences by the [writing reference](references/writing.md), one sentence per line.
Add no section the project does not need, and leave out what the leave-out list names.

Done when: The draft is in scratch, every command, flag, path, version and link in it traces to a Step 1 source, and the draft passes the checklist or lists each item it deliberately leaves failing with its reason.

### Step 4: Review and apply

Record one finding in scratch following `schemas/findings.schema.json` with stage `audit`, the target and the README path as its reviewed scope, and a change set following `schemas/change-set.schema.json`.
The change set creates or replaces only the README path selected in Step 1 with the exact approved UTF-8 bytes and their hashes.
Include the displayed path and any shadowed README in the review so approval covers which file is maintained.
Include `starting-checks` in the findings' `requiredOutcomes`, as required by stage `audit`.
A repo uses mode `repo` with its current revision, and a directory that is not a Git repo uses mode `workspace` with a null revision.
Run `node scripts/readme.mjs apply --repo <target> --plan <file> --dry-run --json`, with `--workspace` for a directory that is not a Git repo, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.

Done when: Only the approved README has been written, with unchanged hash preconditions and a recoverable original, or the write remains blocked with its reason.

### Step 5: Check and report

Open the written README at the selected path and check every relative link resolves from its directory and every command matches the source it cites.
Run the cold-start test again on the written bytes.
State the target, the profile, the findings and which the user selected, and the written path.
Report the displayed path and any shadowed README explicitly; if the displayed file was outside the approved scope, say it remains unchanged.
Report the repository description and topics to set, with the exact values, and name them as not applied.
Report content that belongs in another file with the file that should hold it, and name `/agents-md` when `AGENTS.md` is missing or repeats the README.
Name every checklist item left failing, every input that could not be read and any step left blocked with its missing prerequisite.

Done when: The report names what was written or why nothing was, the cold-start result, the recommended host metadata, the content left for other files and every open decision.

## Review before apply

Keep drafts, audit notes, transcripts and previews in scratch until the user selects changes.
Present each edit's problem, consequence, fix, scope and verification, then the exact bytes.
A scope change needs a decision, not a silent widening.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/readme.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Choosing the profile, ordering sections or drafting from the template | `references/structure.md` |
| Judging a README or drafting to pass it | `references/checklist.md` |
| Deciding what the README must not hold | `references/leave-out.md` |
| Auditing an existing README or running the cold-start test | `references/audit.md` |
| Checking the source behind a rule | `references/sources.md` |
| Writing the sentences of the README | `references/writing.md` |
| Recording citations for evidence | `schemas/research-report.json` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |

## Next step

Suggest `/repo-audit` to find the gaps that remain. Name it only and do not start it.
