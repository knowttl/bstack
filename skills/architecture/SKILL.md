---
name: architecture
description: Propose or audit a project's module boundaries, dependency direction and shared edit targets, record real decisions and design standards, and keep them true as the project grows.
disable-model-invocation: true
---

## Scope

Only the user starts architecture.
Start this procedure only when the user's message explicitly invokes `$architecture`, `/architecture`, `/skill:architecture` or selects it through the host's skills menu.
A plain request such as "review the architecture" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target and the mode, `create` or `maintain`, before proceeding.
A new idea has no code yet and its target is an existing empty or non-Git directory, passed as `--workspace`.
An existing repo is passed as `--repo`.
Use `create` when the project has no design document or the user wants its boundaries audited or changed, and `maintain` when it has one and the user wants it checked against what changed since its last review; if the user's choice contradicts the project, say so and ask.

Create proposes or audits module boundaries, dependency direction and shared edit targets, and writes the selected design sections, import-boundary rules and decision records.
A new idea reviews its expected changes against proposed boundaries instead of inventing history, and an existing repo gets the full boundary audit.
Maintain reruns `measure` and `overlap` since the last review, checks new modules against the design, proposes new boundaries and proves their rules.
Both modes own the design judgement rules, such as DRY and KISS, and `CODING_STANDARDS.md` when the project needs a distinct home for them.
It writes the project's design document, native check configuration, decision records under `docs/adr/` and `CODING_STANDARDS.md`; Step 5 also permits selected registration in an existing contract and the pointer lines in the root `AGENTS.md`.
Vision, domain terms, the verification kit and the root instruction file belong to `/vision`, `/glossary`, `/verification` and `/agents-md`, and a conflict with one is reported with its source.
Neither mode moves or rewrites product code or opens pull requests: a refactor that a boundary implies is a separate change the user selects and runs elsewhere.
Signals such as size, import counts and change frequency indicate where to investigate and never establish a violation by themselves.
Return the result to the project's chosen workflow instead of starting another skill.
Keep drafts, candidate lists, evidence sheets and transcripts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Collect the evidence
- [ ] Step 2: Resolve the open decisions
- [ ] Step 3: Propose the boundaries and standards
- [ ] Step 4: Prove the rules
- [ ] Step 5: Review and apply
- [ ] Step 6: Check and report

### Step 1: Collect the evidence

Start with the reported area, the stated next change, the approved design and the relevant history, and expand only where evidence leads.
Read the design or architecture document, decision records, contribution guidance, scoped agent instructions and the native checks before proposing anything.
An existing repo gets the full boundary audit from the [architecture reference](references/architecture.md): inspect what it lists, collect dependency edges with the project's native analysis, and run `node scripts/architecture.mjs measure --repo <target> --range <base>..<head> --json` for revision-bound sizes, change frequency and co-change signals.
A new idea has no history, so list the expected changes from the user's explanation and any approved `VISION.md`, and review them against the proposed boundaries.
Choose two representative changes and record each as a declared plan following `schemas/overlap-plan.json`.
In a Git repo, run `node scripts/architecture.mjs overlap --repo <target> --plans <file> <file> --json` on them; `measure`, `overlap`, `rule-proof` and `baseline check` accept only `--repo`, so a new idea in a non-Git workspace reviews the two plans by reading and reports that the commands did not run.
Where the host supports subagents, give each independent area one read-only reader; otherwise read the areas one at a time.
Each reader reports findings with file and line citations, without editing or asking the user.
Record the citations in scratch following `schemas/research-report.json`, binding each cited file to the SHA-256 of the exact bytes read with state kind `sha256`, and run `node scripts/architecture.mjs cite-check --repo <target> --report <file> --json`, with `--workspace` for a new idea.
Open each cited source to confirm it supports the claim, because the checker establishes only locations and byte freshness.
Load the [boundary checks reference](references/boundary-checks.md) for the language research order and the coverage limits to report.

Done when: Every finding cites a source checked for exact-byte freshness, measurement and overlap output are in scratch with their limitations, documented intent, observed behaviour and inferred intent are separated, and no unsupported signal is reported as a violation.

### Step 2: Resolve the open decisions

Ask the user only about conflicting intent, missing facts and recorded decisions that conflict with a recommendation, and only when the answer would change it.
Each targeted question cites the sources, names the affected recommendation, offers the plausible readings and recommends one with its trade-off.
Resolve parent decisions first, group only independent questions into a small round and wait for answers.
Load the grilling guide when an unresolved choice would change a boundary, and the [decisions guide](references/decisions.md) when a recommendation conflicts with a recorded decision or needs a new one.
When the repo already answers the questions, proceed to the proposal without asking the user to reconfirm approved choices.
A choice the user has not confirmed stays a draft, and silence or an interrupted session is not confirmation.

Done when: Each boundary or decision to propose is confirmed or named as an open decision, each conflict with a recorded decision has an answer or blocks only its own proposal, and a project whose boundaries are already sound has been told so and stopped here only when no boundary, decision or standards proposal remains.

### Step 3: Propose the boundaries and standards

Present evidenced candidates and their alternatives for selection, and do not apply anything unselected.
Name each module's responsibility, owned knowledge, public contract and private implementation, then the allowed dependency direction and the scope of forbidden imports and cycles.
Record each boundary's project-specific reason, source, scope, enforcement and exception policy, and reuse existing decisions and standards instead of duplicating their rules.
Draft the design sections in the project's existing design document, or `DESIGN.md` when it has none, and keep the design to structure and links to the enforcing checks.
Offer a decision record only for a choice that is hard to reverse, surprising without context and the result of a real trade-off, following the decisions guide, and never one per setup choice.
Load the [design standards reference](references/design-standards.md) to recommend DRY, KISS and other judgement rules only where evidence supports them, and to decide whether `CODING_STANDARDS.md` is needed.
Keep proposed new principles separate from existing requirements and avoid universal architecture prescriptions, speculative layers and empty document templates.

Done when: Every proposal has a project-specific reason, evidence, consequence, scope and verification method, each rule has exactly one authoritative home, and unresolved decisions are visible.

### Step 4: Prove the rules

Prove every selected import-boundary rule with `node scripts/architecture.mjs rule-proof` using a clean control that includes a public import, and independent violations for each private, alias or equivalent-resolution bypass and each forbidden cycle, as the boundary checks reference describes.
Put existing violations into a visible baseline with `baseline check` instead of weakening the rule, and keep unproven rules and coverage limits next to their evidence.
Declare the selected command path of each integrating edit in its `checkIntegration` according to the reference.
A rule that cannot run for lack of a native tool or dependencies, or because the target is a non-Git workspace with no code to check yet, is reported unproven, never assumed.

Done when: Every selected rule has a passing proof or is reported unproven with its limits, and existing violations are in a visible baseline.

### Step 5: Review and apply

Record the findings in scratch following `schemas/findings.schema.json` with stage `audit`, the target and the reviewed paths as its scope, and run `node scripts/architecture.mjs findings validate --repo <target> --findings <file> --json`, with `--workspace` for a new idea.
Keep each design section, rule configuration, baseline, decision record and standards proposal independently selectable.
After selection, consolidate all selected changes to the same resolved file into one complete edit following `schemas/change-set.schema.json`, with the exact reviewed UTF-8 bytes and their hashes; use `create` for a new file and `replace-file` for multiple changes to an existing file.
Include `starting-checks` in the findings' `requiredOutcomes`, as required by stage `audit`.
A new idea uses mode `workspace` with a null revision, and an existing repo uses mode `repo` with its current revision.
Run `node scripts/architecture.mjs apply --repo <target> --plan <file> --dry-run --json`, with `--workspace` for a new idea, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.
When the repo already has `.bstack/project.json`, propose registering the design document under the ID `design` independently for selection in the same review, following the [design standards reference](references/design-standards.md#register-the-design-document); otherwise do not create a contract.
Propose each pointer line independently for selection, then consolidate selected lines into one edit of `AGENTS.md` in the same plan, following the [pointer guide](references/agents-pointer.md): `Follow the module boundaries in DESIGN.md when adding or moving code.` linking the design document's real path, and `Review changes against the standards in CODING_STANDARDS.md.` only when that file was written.

Done when: Only the approved files, and any selected registration or pointer, have been written with unchanged hash preconditions and recoverable originals, or the write remains blocked with its reason.

### Step 6: Check and report

Rerun the maintained check command and the proofs on the written tree, and report whether the design is registered in a contract, since its structure check belongs to `/maintenance`.
State the target, the sources read, the boundaries and decisions proposed with their evidence, the rules proved or unproven with their coverage limits, the debt baseline and the written paths.
Name the unresolved decisions and any step left blocked with its missing prerequisite.
List `/foundation`, `/verification create`, `/maintenance` and `/agents-md` as next steps for the user to run when they apply, and start none of them.
Name `maintain` as the later pass that keeps the design true.

Done when: The report names what was written or why nothing was, which rules were proved, and every open decision.

## Maintain checklist

Copy this checklist and tick a step only when its Done when criterion is met.
Maintain needs a design document in a Git repo; without one, run `create`.

- [ ] Step M1: Fix the baseline
- [ ] Step M2: Rerun the measurements
- [ ] Step M3: Classify and resolve
- [ ] Step M4: Prove and apply
- [ ] Step M5: Check and report

### Step M1: Fix the baseline

Read the design document, its decision records and the standards, and use the last confirmed architectural review as the baseline unless the user names another.
Design or decision-record edits alone do not establish a review; when the evidence does not establish the baseline, ask the user for one before collecting changes or reporting clean.
Use the [maintain guide](references/maintain.md) for the baseline, the four classes and the outcomes.
Record the revision and working-tree state and preserve uncommitted user work.

Done when: The design files, the established baseline commit and the current revision are recorded, or the pass is blocked awaiting the user's answer about the missing baseline.

### Step M2: Rerun the measurements

Collect the union of paths changed since the baseline, staged, unstaged and untracked, as the guide describes.
Run `node scripts/architecture.mjs measure --repo <target> --range <baseline>..HEAD --json` and `overlap --repo <target> --plans <file> <file> --json` on two declared plans.
Where the host supports subagents, give each independent area one read-only reader who reports modules and dependency edges with file and line citations.
Record the citations in scratch following `schemas/research-report.json` and run `cite-check --repo <target> --report <file> --json`.

Done when: Every candidate has a cited location checked for exact-byte freshness and the measurement and overlap results are saved, or the complete inventory from the established baseline has no committed changes and no staged, unstaged or untracked changes in code, and the report stops here as clean.

### Step M3: Classify and resolve

Give each candidate exactly one class from the maintain guide: an undescribed module, a broken boundary, a shared edit target or a decision to record.
Drop signals that do not hold up on inspection, with the reason, and never report size or co-change alone as a violation.
Ask the user a targeted question with citations for each boundary whose intended direction the evidence cannot settle, and load the grilling guide when a choice would change a boundary.

Done when: Every candidate has one class with its evidence or a stated reason for being dropped, and each question has an answer or blocks only its own entry.

### Step M4: Prove and apply

Propose each design edit and each new boundary rule independently with its evidence and obtain the user's selection.
Prove every selected new rule as in Step 4 and keep existing violations in the baseline.
Record the selection in scratch as a finding with stage `audit` and prepare the change set as in Step 5, consolidating all selected changes into one complete edit per resolved file, with the same target and `starting-checks` outcome as `create`.
Run `apply --repo <target> --plan <file> --dry-run --json`, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` to inspect an interrupted apply, and repeat the unchanged plan to resume.

Done when: Only the selected edits have been applied with unchanged hash preconditions and recoverable originals and every selected rule is proved or reported unproven, or no edit was selected, or the write remains blocked with its reason.

### Step M5: Check and report

Report exactly one outcome: clean, changed through a reviewed change set, or blocked.
Name the baseline, the modules and boundaries reviewed, each edit with its evidence, the rules proved, the refactors left for the user to select and every limitation.

Done when: The report states one outcome and separates applied edits, refactors left unselected and limitations.

## Review before apply

Keep drafts, candidate lists, transcripts and previews in scratch until the user selects changes.
Present each edit's problem, consequence, fix, scope and verification, then the exact bytes.
A scope change needs a decision, not a silent widening.
Machine configuration changes, which include native check configuration and the maintained check command, need approval for each change.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/architecture.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Auditing boundaries, dependencies or planned changes | `references/architecture.md` |
| A recommendation conflicts with a recorded decision or needs a new one | `references/decisions.md` |
| Recommending DRY, KISS, other judgement rules or `CODING_STANDARDS.md` | `references/design-standards.md` |
| Researching dependencies, proving rules or recording a debt baseline | `references/boundary-checks.md` |
| Running a maintain pass or classifying a changed module | `references/maintain.md` |
| An unresolved decision would change a boundary | `references/grilling.md` |
| Adding the design's `AGENTS.md` pointers | `references/agents-pointer.md` |
| Recording citations for evidence | `schemas/research-report.json` |
| Measuring history or comparing planned changes | `schemas/measure-exclusions.json`, `schemas/overlap-plan.json` |
| Proving rules and recording debt | `schemas/check-plan.json`, `schemas/baseline.schema.json` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
| Registering the design in an existing contract | `schemas/project.schema.json` |
