---
name: repo-audit
description: Audit a repo at overview level and print which bstack skill to run next, in order, with one cited reason per skill.
disable-model-invocation: true
---

## Scope

Only the user starts repo-audit.
Start this procedure only when the user's message explicitly invokes `$repo-audit`, `/repo-audit`, `/skill:repo-audit` or selects it through the host's skills menu.
A plain request such as "audit this repo" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target before proceeding: an existing repo is passed as `--repo`, and a new idea or an existing directory that is not a Git repo is passed as `--workspace`.
An empty directory is a new idea, and an established repo can need only a scoped reassessment.

This skill reads the target at overview level and prints a checklist of the skills the user should run next.
It writes nothing to the target and keeps no audit record: keep the research report and notes in scratch outside the target, and rerun the skill to see which steps now look done.
It never starts another skill, interviews the user, drafts a vision, glossary, design, project, test guidance, contract or instruction file, opens a pull request or selects a delivery service.
Each of those belongs to the skill the checklist names: `/vision`, `/glossary`, `/architecture`, `/foundation`, `/verification`, `/maintenance`, `/agents-md` and `/plan`.
Security hardening of created skills and licensing review are outside scope.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Audit checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Resolve the target and path
- [ ] Step 2: Inspect and inventory
- [ ] Step 3: Research the documents
- [ ] Step 4: Print the checklist

### Step 1: Resolve the target and path

Resolve the target and requested area, and read the instructions and indexes the target itself provides.
Choose the new-idea path for an empty directory or an idea with no repo, and the existing-repo path otherwise.
Ask the user only when the target or path stays unclear after reading what the target provides, and wait for the answer.

Done when: The target, its flag (`--repo` or `--workspace`) and the chosen path are stated.

### Step 2: Inspect and inventory

For a Git repo run `node scripts/repo-audit.mjs inspect --repo <target> --json`, then run `node scripts/repo-audit.mjs inventory --repo <target> --json`, with `--workspace` in place of `--repo` for a directory that is not a Git repo.
Keep both outputs in scratch.
Inspect covers the Git state, manifests and prerequisite versions, and inventory lists the vision, design, glossary, context map, standards, decision, prior audit, README and instruction files by actual name, with absent kinds reported rather than failed.
Preserve uncommitted user work, and record unavailable tools or history as limitations instead of inventing evidence.
Inspect instruction files only inside the selected target, and do not inspect or report those outside it, including ancestor directories and user profiles.

Done when: Both outputs are in scratch, or the missing prerequisite is named, and every document kind is listed as found or absent.

### Step 3: Research the documents

Run the one documents research brief from the [research briefs reference](references/research-briefs.md) on the files inventory found, and on the user's brief when a new idea supplies one.
Record the report in scratch following `schemas/research-report.json`, then open every cited source and run `node scripts/repo-audit.mjs cite-check --repo <target> --report <file> --json` before relying on it, with `--workspace` for a directory that is not a Git repo.
State whether the brief ran in the main thread or through subagents.
Do not audit boundaries, tests, terms, instruction files or checks in depth: that is the work of the skills the checklist names.

Done when: The report passes `cite-check` against the current bytes, or the missing source is named, and each finding says whether it is documented, observed or inferred.

### Step 4: Print the checklist

Print the checklist for the chosen path, one line per skill in the order shown, each with one reason in the form `path:line` or an inventory kind reported absent, taken from the checked report and the inventory output.
Mark a line `looks done` when its output already exists and the cited source shows it, otherwise `to do`; this is a pointer for the user and not a verdict on quality.
A reason that cites nothing is not a reason: drop the claim or mark the line `no evidence` and say what could not be read.
Do not start any listed skill, and do not write the checklist into the target.

New idea:

- [ ] `/vision` - the purpose is not yet written, citing the user's brief or the absent vision kind
- [ ] `/glossary` - the terms the brief uses, citing where they appear
- [ ] `/architecture` - the boundaries and decisions the idea implies, citing the brief or the absent design kind
- [ ] `/foundation` - the stack, scaffold and first journey, which need the approved vision, glossary and design above
- [ ] `/verification create` - the testing rules and checks the new project will need, citing the chosen stack
- [ ] `/maintenance` - the docs the project will register so they stay true as code changes
- [ ] `/agents-md` - the root `AGENTS.md` of pointers to everything above
- [ ] `/plan` - the implementation plan that cites the documents and checks above, citing the user's design document or the absent design kind, last

Existing repo:

- [ ] `/repo-audit` overview - this audit, with the limitations it reported
- [ ] `/vision` (only for a gap) - the vision is missing, or conflicts with a cited design or newer work
- [ ] `/glossary` (only if terms are unclear) - the cited terms that are missing or compete
- [ ] `/architecture` - the cited boundary, decision or design gap, or the design document found absent
- [ ] `/verification create` - the cited test and check state from the manifests and standards
- [ ] `/maintenance` - the cited documents that no registered contract covers
- [ ] `/agents-md` - the cited instruction files, pointer gaps and `CLAUDE.md` merge candidates
- [ ] `/plan` - the cited approved design that has no implementation plan yet, or the design document found absent, last

`/foundation` is for new projects only and never appears on the existing-repo checklist, because it refuses a non-empty directory.
State the limitations and the decisions the audit could not make, then stop.

Done when: The checklist for the chosen path is printed with every line citing a reason, nothing has been written to the target, and no other skill has been started.

## Load when

Read only the one resource needed for the current step, once per run unless it changes.
Run scripts without loading their source.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Running the documents research brief | `references/research-briefs.md` |
| Recording citations for evidence | `schemas/research-report.json` |
