---
name: plan
description: Write and check one implementation plan from an approved design document, with units that each cite their design, name the boundary they touch and say what proves them done. Never executes the plan.
disable-model-invocation: true
---

## Scope

Only the user starts plan.
Start this procedure only when the user's message explicitly invokes `$plan`, `/plan`, `/skill:plan` or selects it through the host's skills menu.
A plain request such as "write an implementation plan" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target before proceeding: an existing repo is passed as `--repo`, and a new idea whose target is an existing empty or non-Git directory holding the design is passed as `--workspace`.

Plan has one mode, `create`, and it writes one implementation plan for a project from an approved design document.
The design may be any document the user names and approves, such as requirements, stories and non-functional targets written by hand or in another tool.
The plan also reads the project's `VISION.md`, glossary, design document and verification kit when they exist.
A missing one is reported as a gap and its skill is never started.
The plan's units are the design's stories with their acceptance cases, core stories first, and each unit cites its design section, names the boundary it touches, states its Done when and names the check or verification kit feature that proves it.
Non-functional targets become acceptance checks of the units they constrain.
It writes the plan document and the one pointer line for it in the root `AGENTS.md`.
It starts no skill and no work, never executes a unit, assigns no agent, tracks no progress, prescribes no development method or tool, and edits no product code, design, vision, glossary or kit.
A conflict with one of those documents is reported with its source and left to the skill that owns it.
Return the result to the project's chosen workflow instead of starting another skill.
Keep drafts, reader reports, the plan record and transcripts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Collect the inputs
- [ ] Step 2: Run the builder check
- [ ] Step 3: Resolve the questions
- [ ] Step 4: Draft and check the plan
- [ ] Step 5: Review and apply
- [ ] Step 6: Check and report

### Step 1: Collect the inputs

Ask which document is the approved design when the user has not named one, and treat a document the user has not confirmed as approved as a draft the plan cannot rest on.
Look for `VISION.md`, the glossary, the project's design document and an applied verification kit under `.agents/skills/verify-<app>/`, read each one that exists and list each one that does not as a gap with the skill that would create it.
Name that skill as a next step for the user, and start none.
An existing repo also needs its real boundaries: where the host supports subagents, give each independent area one read-only reader, otherwise read the areas one at a time.
Each reader reports findings with file and line citations, without editing or asking the user.
Record the citations in scratch following `schemas/research-report.json`, binding each cited file to the SHA-256 of the exact bytes read with state kind `sha256`, and run `node scripts/plan.mjs cite-check --repo <target> --report <file> --json`, with `--workspace` for a new idea.
Open each cited source to confirm it supports the claim, because the checker establishes only locations and byte freshness.
A design that is one verifiable change needs no plan: say so and stop.

Done when: The approved design is identified and confirmed by the user, each other input is read or listed as a gap with its skill, and every repo finding cites a source checked for exact-byte freshness.

### Step 2: Run the builder check

Follow the [builder check](references/builder-check.md): a fresh read-only reader that cannot ask the author lists every place a builder would have to guess.
Filter its report against the inputs you read, and keep only the questions whose answers would change the plan.

Done when: Each remaining question names the design section it concerns and why its answer changes the plan, or the reader found nothing important and that is stated.

### Step 3: Resolve the questions

Ask the user only the questions Step 2 kept.
Each cites the sources, offers the plausible readings and recommends one with its trade-off.
Resolve parent decisions first, group only independent questions into a small round and wait for answers.
Load the grilling guide for the round shape.
A choice the user has not confirmed stays an open question in the plan, and silence or an interrupted session is not confirmation.
An answer that changes the design is the user's to write into it, so ask whether to update the design first or record the answer in the plan.

Done when: Each question has the user's answer or is recorded as open, and no answer is assumed.

### Step 4: Draft and check the plan

Follow the [plan format](references/plan.md).
Build the story map from the design, with each story's acceptance cases and the core stories first, then turn it into units that each end in a state a named check or kit feature can verify.
Carry each non-functional target as evidence on every unit it constrains.
Record the units in scratch following `schemas/plan.json`, binding each design citation to the SHA-256 of the exact bytes read, and run `node scripts/plan.mjs plan check --repo <target> --plan <file> --json`, with `--workspace` for a new idea.
Fix every reported problem by changing the plan, never by dropping the unit's evidence, dependency or citation to make the check pass.
Open each cited design section to confirm it supports its unit, because the checker establishes only that the citation resolves and the unit names evidence.
Then draft the plan document in scratch from the checked record.

Done when: `plan check` passes on the record, every unit's evidence names a check or kit feature that exists or says which unit adds it, every non-functional target is carried by a unit or recorded as open, and the document's units match the record's one for one.

### Step 5: Review and apply

Record one finding in scratch following `schemas/findings.schema.json` with stage `audit`, the target and the plan path as its reviewed scope, and include `starting-checks` in its `requiredOutcomes`.
Prepare a change set following `schemas/change-set.schema.json` that creates the plan with the exact approved UTF-8 bytes, or replaces an existing plan only after the user chooses to replace it.
Propose the pointer line as a separate selection and consolidate the selected line into one edit of `AGENTS.md` in the same plan, following the [pointer guide](references/agents-pointer.md): `Use the implementation plan in docs/plan.md to see what each unit depends on and what proves it done.` linking the plan's real path.
A new idea uses mode `workspace` with a null revision, and an existing repo uses mode `repo` with its current revision.
Run `node scripts/plan.mjs apply --repo <target> --plan <file> --dry-run --json`, with `--workspace` for a new idea, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.

Done when: Only the approved plan and any selected pointer have been written with unchanged hash preconditions and recoverable originals, or the write remains blocked with its reason.

### Step 6: Check and report

Run `plan check` again on the unchanged record, because the design may have changed while the user reviewed.
State the target, the design and the other inputs read, the gaps with the skills that fill them, the builder check's result, the questions asked and their answers, the units in dependency order with the evidence for each, and the written paths.
Name every question left open and any step left blocked with its missing prerequisite.
List the skills for any gap as next steps for the user to run, say that nothing here runs the plan, and start nothing.

Done when: The report names what was written or why nothing was, and every gap and open question.

## Review before apply

Keep drafts, reader reports, the plan record, transcripts and previews in scratch until the user selects changes.
Present the plan's problem, consequence, fix, scope and verification, then the exact bytes.
A scope change needs a decision, not a silent widening.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/plan.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Running the builder check | `references/builder-check.md` |
| Drafting the story map, the units or the document | `references/plan.md` |
| Asking the user the builder check's questions | `references/grilling.md` |
| Adding the plan's `AGENTS.md` pointer | `references/agents-pointer.md` |
| Recording citations for evidence | `schemas/research-report.json` |
| Recording and checking the plan | `schemas/plan.json` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
