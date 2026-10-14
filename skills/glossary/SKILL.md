---
name: glossary
description: Find, resolve and write a project's domain terms in GLOSSARY.md or a glossary map, and keep them true as the project's language changes.
disable-model-invocation: true
---

## Scope

Only the user starts glossary.
Start this procedure only when the user's message explicitly invokes `$glossary`, `/glossary`, `/skill:glossary` or selects it through the host's skills menu.
A plain request such as "write a glossary" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target and the mode, `create` or `maintain`, before proceeding.
A new idea has no glossary and its target is an existing empty or non-Git directory, passed as `--workspace`.
An existing repo is passed as `--repo`.
Use `create` when the project has no glossary or map and `maintain` when it has one; if the user's choice contradicts the project, say so and ask.

Create finds, resolves and writes the project's domain terms.
Maintain compares the glossary with the names in code and docs since its last review and proposes edits for what drifted.
The glossary holds domain concepts only: no storage choices, frameworks, feature requirements, coding rules or implementation details.
It writes `GLOSSARY.md`, or `GLOSSARY-MAP.md` plus one glossary per real context; Step 4 also permits selected registration in an existing contract.
Decision records, design sections and the vision belong to other skills, and a conflict with one is reported with its source.
Neither mode renames code, edits product code or opens pull requests: a rename to match the glossary is a separate change the user selects and runs elsewhere.
Return the written glossary to the project's chosen workflow instead of starting another skill.
Keep drafts, candidate lists, evidence sheets and transcripts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Discover the existing language
- [ ] Step 2: Resolve the terms
- [ ] Step 3: Draft the glossary
- [ ] Step 4: Review and apply
- [ ] Step 5: Check and report

### Step 1: Discover the existing language

Read the project's vocabulary source and the documents that describe its domain before asking any naming question.
For a new idea, the sources are the user's explanation and any approved `VISION.md` in the workspace.
For an existing repo, derive candidate terms from documented domain concepts and the code that implements them, and distinguish established definitions from inferred meanings.
Code shows current behaviour, not the intended definition.
Record repo citations in scratch following `schemas/research-report.json` and run `node scripts/glossary.mjs cite-check --repo <target> --report <file> --json`, with `--workspace` for a new idea.
The checker establishes locations and byte freshness, so open each cited source to confirm it supports the claim.
Load the [glossary guide](references/glossary.md) for discovery, meanings and format.

Done when: Every candidate term has a cited source or is marked as the user's own statement, established definitions are separated from inferred ones, and no empty template or directory has been created.

### Step 2: Resolve the terms

Surface each conflicting definition with its file citations and one targeted question that names the plausible readings and recommends one with its trade-off.
Challenge vague or overloaded terms by proposing precise canonical names, and test relationships with concrete scenarios.
Resolve parent decisions first, group only independent questions into a small round and wait for answers.
Load the grilling guide when an unresolved choice would change a definition.
A new idea starts the draft as soon as the user agrees on its first project-specific term, without an interview for terms the project does not need yet.
An existing repo needs a glossary only when shared language would help, so say so and stop when the terms are already clear.
A term the user has not confirmed stays a draft, and silence or an interrupted session is not confirmation.

Done when: Each term to write has a confirmed meaning or a named unresolved decision, each conflict has an answer or blocks only its own term, and a repo whose terms are already clear has been told so and stopped here.

### Step 3: Draft the glossary

Draft one root `GLOSSARY.md` for one context, in the project's existing format when it has one.
Recommend a `GLOSSARY-MAP.md` with one glossary per context only when genuinely different contexts need separate vocabulary, and ask which context a term belongs to when it is unclear.
A new idea drafts only the agreed terms and never an empty template, and an existing repo drafts only terms with a confirmed meaning.
Each entry defines one concept in one or two sentences, with its canonical name and the conflicting synonyms to avoid where useful.
Use the confirmed vocabulary in the draft's own wording, and leave out every implementation detail.

Done when: The draft is in scratch, every entry is a confirmed domain concept with no implementation detail, and every term traces to a cited source or a confirmed user decision.

### Step 4: Review and apply

Record one finding in scratch following `schemas/findings.schema.json` with stage `audit`, the target and the glossary paths as its reviewed scope, and a change set following `schemas/change-set.schema.json` that creates the files with the exact approved UTF-8 bytes and their hashes.
Include `starting-checks` in the findings' `requiredOutcomes`, as required by stage `audit`.
A new idea uses mode `workspace` with a null revision, and an existing repo uses mode `repo` with its current revision.
Run `node scripts/glossary.mjs apply --repo <target> --plan <file> --dry-run --json`, with `--workspace` for a new idea, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.
When the repo already has `.bstack/project.json`, propose registering each new glossary document there as a separate selected edit in the same plan, as the guide describes; otherwise do not create a contract.

Done when: Only the approved glossary files, and any selected registration, have been written with unchanged hash preconditions and recoverable originals, or the write remains blocked with its reason.

### Step 5: Check and report

Run `node scripts/glossary.mjs docs check --repo <target> --json` and report its result when the glossary is registered in the project's contract.
Report every coverage limit it returns, because a document with a coverage limit was not fully checked.
When the glossary is not registered, or the target is a new-idea workspace, report that the structure check did not run and why instead of claiming the glossary was checked.
State the target, the sources read, the terms written with their sources, each conflict and its answer, and the written paths.
Name the unresolved decisions and any step left blocked with its missing prerequisite.
List decision records, `/architecture` and `/foundation` as next steps for the user to run when they apply, and start none of them.
Name `maintain` as the later pass that keeps the glossary true.

Done when: The report names what was written or why nothing was, whether the structure check ran, and every open decision.

## Maintain checklist

Copy this checklist and tick a step only when its Done when criterion is met.
Maintain needs a glossary in a Git repo; without one, run `create`.

- [ ] Step M1: Fix the baseline
- [ ] Step M2: Collect the names since the baseline
- [ ] Step M3: Classify and resolve
- [ ] Step M4: Review and apply
- [ ] Step M5: Check and report

### Step M1: Fix the baseline

Read the glossary, or the map and each relevant context glossary, and take the last review as the commit that last changed a glossary file unless the user names another baseline.
Run `node scripts/glossary.mjs docs check --repo <target> --json` when the glossary is registered, and record each problem for triage.
Use the [maintain guide](references/maintain.md) for the baseline, the three classes and the outcomes.

Done when: The glossary files, the baseline commit and the current revision are recorded, and each `docs check` problem is noted or the check is reported as not run with its reason.

### Step M2: Collect the names since the baseline

Collect the union of docs and code changed in commits since the baseline, staged changes, unstaged changes and untracked files, using the changed files and the real commit messages and never memory of earlier work.
Where the host supports subagents, give each independent area one read-only reader; otherwise read the areas one at a time.
Each reader reports candidate names with file and line citations, without editing or asking the user.
Record the citations in scratch following `schemas/research-report.json`, binding every cited file to the SHA-256 of the exact working-tree bytes read with state kind `sha256`, and run `node scripts/glossary.mjs cite-check --repo <target> --report <file> --json`.

Done when: Every candidate name has a cited location checked for exact-byte freshness, or the complete inventory has no committed changes since the baseline and no staged, unstaged or untracked changes in docs or code, and the report stops here as clean.

### Step M3: Classify and resolve

Give each candidate exactly one class from the maintain guide: a name missing from the glossary, a drifted meaning or a returning synonym.
Drop names that are implementation detail, with the reason, instead of proposing them.
Ask the user a targeted question with citations for each drifted meaning and each name whose context is unclear, and load the grilling guide when a choice would change a definition.
A returning synonym is evidence about the code and docs, so the glossary's avoided alias stays and the renames it implies are listed as separate changes.

Done when: Every candidate has one class and its evidence or a stated reason for being dropped, and each question has an answer or blocks only its own entry.

### Step M4: Review and apply

Propose each glossary edit independently with its evidence, the entries it keeps and the definition it changes, and obtain the user's selection.
Record the selection in scratch as a finding with stage `audit` and a change set that replaces each glossary file with the complete reviewed UTF-8 content, with the same target and `starting-checks` outcome as `create`.
Run `apply --repo <target> --plan <file> --dry-run --json`, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` to inspect an interrupted apply, and repeat the unchanged plan to resume.

Done when: Only the selected edits have been applied with unchanged hash preconditions and recoverable originals, or no edit was selected, or the write remains blocked with its reason.

### Step M5: Check and report

Run `docs check` again when the glossary is registered, report its coverage limits, and report that it did not run when the glossary is not registered.
Report exactly one outcome: clean, changed through a reviewed change set, or blocked.
Name the baseline, the names reviewed, each edit with its evidence, the renames left for the user to select and every limitation.

Done when: The report states one outcome and separates applied edits, renames left unselected and limitations.

## Review before apply

Keep drafts, candidate lists, transcripts and previews in scratch until the user selects changes.
Present each edit's problem, consequence, fix, scope and verification, then the exact bytes.
A scope change needs a decision, not a silent widening.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/glossary.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Discovering terms, resolving meanings or drafting a glossary | `references/glossary.md` |
| An unresolved decision would change a definition | `references/grilling.md` |
| Running a maintain pass or classifying a changed name | `references/maintain.md` |
| Recording citations for evidence | `schemas/research-report.json` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
| Registering a glossary in an existing contract | `schemas/project.schema.json` |
