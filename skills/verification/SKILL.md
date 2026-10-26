---
name: verification
description: Create a project-local verification kit that launches and drives the real product, keep it true as the product changes, adopt testing and constraint guidance for it, and turn a repeated correction into a proven check.
disable-model-invocation: true
---

## Scope

Only the user starts verification.
Start this procedure only when the user's message explicitly invokes `$verification`, `/verification`, `/skill:verification` or selects it through the host's skills menu.
A plain request such as "set up verification" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target repo and the mode, `create`, `maintain` or `correct`, before proceeding.
Use `create` when the repo has no kit and `maintain` when it has one; if the user's choice contradicts the repo, say so and ask.
Use `correct` when the user keeps correcting agents for the same mistake; it needs no kit and works with or without one.

Create builds a kit in the target repo that tells an agent how to start and drive the product, plus a feature map of how a user reaches each feature.
Maintain keeps an applied kit true: it checks the kit for drift, drives every feature, triages what disagrees and proposes reviewed corrections.
Correct turns a repeated mistake into the highest-rung check that makes it impossible, proves the check on a real past occurrence and proposes it for review, without driving the product.
No mode edits product code, implements features, fixes product bugs or opens pull requests; when startup needs a product fix, report the blocker, and report a product bug instead of weakening the map.
It never adds hosted CI unless the user selects it.
Checks it proposes must run without bstack installed.
Scripts collect facts and render reviewable change sets; this workflow writes target changes through `apply`, after the user approves the exact diff.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Interview the repo
- [ ] Step 2: Plan the kit
- [ ] Step 3: Review and apply the kit
- [ ] Step 4: Prove the kit
- [ ] Step 5: Propose testing guidance
- [ ] Step 6: Propose constraints
- [ ] Step 7: Audit the existing suite
- [ ] Step 8: Propose no-mistakes wiring
- [ ] Step 9: Report

### Step 1: Interview the repo

Answer from the codebase and ask the user only what the repo cannot show: the surface a user touches, how the product starts locally, how an agent can drive it, what evidence is observable and whether two instances can run side by side.
Prefer the repo's own documented commands and existing drive harnesses before a generic recipe.
If the checkout does not build or start as it is, report the exact blocker instead of editing product code or generating a kit against a broken base.
Decide whether the third-party lens applies: it applies only when the product integrates with an outside service or API that needs authentication or secrets or can hit rate limits.
Use the [kit guide](references/create.md) for the interview questions and the [third-party lens](references/third-party.md) when it applies.

Done when: The surface, launch command, drive harness, evidence, isolation limits and third-party applicability are established from repo evidence, and each unanswerable question is asked or named as a blocker.

### Step 2: Plan the kit

Write the kit plan in scratch, following `schemas/kit-plan.json` and writing its prose by the [writing reference](references/writing.md), and show the user the app name, launch and doctor commands, helpers and the features it will map before writing anything.
Start with the top three to five user-facing features, each with its declared source paths, entry points, driving steps with observable matches and gotchas.
Every step command must assert something a user would see; a step that only checks an exit code is not proof.
Set `coverageGate` to `true` when the repo uses or will adopt no-mistakes, so the kit ships the feature-map coverage gate that Step 8 wires.
Obtain the user's selection of the plan.

Done when: The plan validates against the schema, every feature step has an observable match, and the user has selected it.

### Step 3: Review and apply the kit

Run `node scripts/verification.mjs kit scaffold --repo <target> --plan <file> --json` to render the change set in scratch.
Present its exact diff with `apply --repo <target> --plan <change-set> --dry-run --json`, then run the unchanged change set without `--dry-run` only after the user approves those bytes.
The change set creates the kit at `.agents/skills/verify-<app>/`, a thin `.claude/skills/verify-<app>/SKILL.md` pointer and an `AGENTS.md` pointer, so every host finds the same kit.
Use `state show` to inspect an interrupted apply, and repeat the unchanged plan to resume.
Never write kit files directly or bypass a missing command.

Done when: Only the approved change set has been applied, with unchanged hash preconditions and recoverable originals.

### Step 4: Prove the kit

Run `node scripts/verification.mjs kit prove --repo <target> --app <app> --feature <id> --json` once.
It launches the product, runs doctor, drives one mapped feature, captures evidence, cleans up what it started and confirms the evidence survived.
It runs the commands recorded in the kit exactly as written, so they must be the ones the user approved in the diff.
Fix harness failures in the kit through another reviewed change set, and report a product bug instead of weakening a step to make it pass.
An unproven kit is a draft.
If the proof ran in a stand-in for the real target, list every setup step the stand-in did that the target will not, and leave them unverified.

Done when: A proof run passed on the applied kit with its evidence present at the named location, or the kit is reported as a draft with the failing check named.

### Step 5: Propose testing guidance

Propose the testing principles, the four-question gate and the offline default test command as selected changes in the target's existing authoritative documents and agent instructions, with pointers instead of copies.
Load the [testing reference](references/testing.md) for the principles and the exact text to adapt.
Prefer extending an existing policy to creating a new document.

Done when: Each selected testing change names its destination, the principle it states and why the destination is authoritative, or the user has declined it.

### Step 6: Propose constraints

Propose the default slop baseline and the prose-comment ban as selected changes, each implemented with the project's native tools first.
Research the project's language and tools; a rule name alone never proves equivalent enforcement.
Generate the comment-ban checker with `node scripts/verification.mjs comment-check generate --repo <target> --language <python|go|typescript> --json`, and propose it as a selected `create` edit wired into the project's one maintained check command.
Prove every enabled rule with `rule-proof` and put existing violations into a shrinking baseline with `baseline check`.
Load the [constraint reference](references/constraints.md) and the [slop baseline](references/slop-baseline.md).

Done when: Every enabled rule has a passing proof or is reported unproven, existing violations are in a visible baseline, and no whole rule or directory is disabled to obtain green.

### Step 7: Audit the existing suite

On an existing repo, review the current tests for the eight wasteful-test patterns and for journeys protected only by unit or mocked tests.
Record evidenced instances as findings with the tests, callers and smallest change; remove nothing until the user selects it.
Use the [testing reference](references/testing.md).
Skip this step for a repo with no tests.

Done when: Every pattern instance has cited evidence, or the audit states that none was found and which tests were read.

### Step 8: Propose no-mistakes wiring

Propose the pipeline configuration that makes the kit count: the coverage gate after Document, the kit named in the Test instructions, the testing criteria in Review and the feature map as the owner of how a user reaches each feature.
Extend an existing `.no-mistakes.yaml` instead of replacing it.
When the repo has none, offer no-mistakes setup as a selected step the user may decline, tell the user the one command that sets it up and never run it, and add no hosted CI workflow unless the user asks.
Load the [wiring reference](references/no-mistakes.md).

Done when: Each wiring change is a selected edit with its exact diff and the effect timing stated, or the user has declined it, and the reference's inferences are listed as limitations.

### Step 9: Report

State the kit location, the proof result with its evidence path, each selected change and its verification, unproven rules, audit findings and every limitation, including setup steps the proof did not cover.
Name `maintain` as the later pass that keeps the kit true; do not suggest a cadence unless asked.

Done when: The report separates applied changes, proof evidence, unresolved findings and limitations.

## Maintain checklist

Copy this checklist and tick a step only when its Done when criterion is met.
Maintain needs an applied kit; without one, run `create`.

- [ ] Step M1: Check the kit for drift
- [ ] Step M2: Read each feature's source
- [ ] Step M3: Drive every feature
- [ ] Step M4: Triage
- [ ] Step M5: Correct the kit
- [ ] Step M6: Mine repeated mistakes and audit the suite
- [ ] Step M7: Report

### Step M1: Check the kit for drift

Run `node scripts/verification.mjs kit check --repo <target> --app <app> --json`.
It compares every kit file, the `AGENTS.md` pointer and each feature's declared source paths with what `kit.json` renders and with the repo, and reports one problem per finding.
Use the [maintain guide](references/maintain.md) for the passes, triage classes and outcomes.

Done when: Every `kit check` problem is recorded for triage, or the check passed.

### Step M2: Read each feature's source

Where the host supports subagents, give each feature one read-only reader; otherwise read the features one at a time.
Each reader compares one feature file with the code at its declared source paths and reports disagreements with file and line evidence, without editing or running the product.

Done when: Every feature has a reader report, or sequential reading covered every feature and says so.

### Step M3: Drive every feature

Run `kit prove --repo <target> --app <app> --feature <id> --json` for each feature in `kit.json`, one at a time.
A feature that cannot be reached is reported with the attempted command and the unmet precondition, never counted as verified through another path.

Done when: Every feature has a proof result with its evidence path, or a named unreached prerequisite.

### Step M4: Triage

Sort each discrepancy from the earlier steps into doc drift, harness gap or product bug using an agreed source, never the product's current output.
Ask the user when no agreed source exists.

Done when: Every discrepancy has exactly one class and its evidence.

### Step M5: Correct the kit

Edit a copy of the kit plan in scratch, run `kit scaffold --repo <target> --plan <file> --update --json`, present its exact diff with `apply --dry-run`, and apply the unchanged change set only after the user approves those bytes.
Then rerun `kit check` and re-drive every feature whose steps, entry points or source paths changed.
Report product bugs without changing the map to hide them.

Done when: Only the approved change set has been applied, `kit check` passes and each changed feature proved again, or no correction was needed.

### Step M6: Mine repeated mistakes and audit the suite

Run Steps C1 and C2 of the [Correct checklist](#correct-checklist) over the project's recent no-mistakes findings and review comments where they are available, and propose each repeated mistake's rung without applying it.
Audit the suite for the eight wasteful-test patterns with the [testing reference](references/testing.md), recording evidenced instances as findings and removing nothing until the user selects it.

Done when: Each repeated mistake has a proposed rung and evidence, and each pattern instance has cited evidence or the audit states that none was found.

### Step M7: Report

Report one outcome: clean, changed through a reviewed change set, or blocked.
Name the features driven, the features not reached and why, the product bugs found and every limitation.

Done when: The report states one outcome and separates applied changes, product bugs and limitations.

## Correct checklist

Copy this checklist and tick a step only when its Done when criterion is met.
Correct needs no applied kit and does not drive the product, so it runs after a single correction without the full `maintain` pass.
Load the [constraint reference](references/constraints.md) for the ladder, the evidence sources, the proof and the repeat rules.

- [ ] Step C1: Collect mistake evidence
- [ ] Step C2: Classify each mistake and pick a rung
- [ ] Step C3: Prove each check on a real past mistake
- [ ] Step C4: Review and apply
- [ ] Step C5: Report

### Step C1: Collect mistake evidence

Start from the user's correction, then read recent commits, reverts and fix-ups, review comments, no-mistakes findings where they are available, agent instruction files and comments that explain a workaround.
Group the occurrences into classes and cite each one by commit, file or comment.
A class counts once it has two cited occurrences; name a single occurrence as below the threshold and leave it alone.
Count a mistake that recurs despite a written rule as a repeat of its class, and name that rule.

Done when: Each class lists at least two cited occurrences and any written rule it recurred against, or is named as below the threshold.

### Step C2: Classify each mistake and pick a rung

Give each class the highest rung of the ladder that can express it, and say why each higher rung cannot.
Move a class that recurs despite a written rule up at least one rung from the rung that rule sits on, in the same change.
For a check, write the diagnostic so that it names the file, type or function to use instead.

Done when: Each class has one rung with the reason each higher rung fails, and each check's diagnostic names its replacement.

### Step C3: Prove each check on a real past mistake

Seed the violation from a cited real occurrence of the class in a review comment, issue or commit, and attach its commit when available.
If a faithful reproduction is not possible, report the rule check as unproven.
Prove each rule with `rule-proof` and put existing violations in a shrinking baseline with `baseline check`, as Step 6 of the create checklist does.

Done when: Each check has a passing proof whose seeded violation faithfully reproduces a cited real occurrence, with its commit when available, or is reported unproven.

### Step C4: Review and apply

Present each class as a selected change with its problem, consequence, fix, scope and verification, then the exact diff from `apply --dry-run`.
Apply the unchanged change set only after the user approves those bytes.
Once a proven check enforces a written rule, propose replacing the rule with a pointer to the check.
Report a change that needs product code, such as removing a second way to do one task, with its files instead of making it.

Done when: Only the approved change set has been applied, or the user has declined each change.

### Step C5: Report

State each class with its evidence, the rung chosen and why no higher rung worked, each proof result, each prose rule replaced by a pointer, the product changes reported and not made, and every unproven check or limitation.
Commit nothing.

Done when: The report separates applied changes, proof evidence, reported product changes and limitations.

## Review before apply

Keep plans, change sets, generated checkers and transcripts in scratch outside the target until the user selects changes.
Present each proposed change's problem, consequence, fix, scope and verification, then the exact diff.
A scope change needs a decision, not a silent widening.
Machine configuration changes need approval for each change.

## Write rules

Use the `scripts/verification.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use `--help` for any command's syntax and never guess arguments.
Only `apply` makes project edits, including `AGENTS.md`; it validates reviewed scope, hashes and the plan digest before writing and refuses anything changed since review.
User changes block remaining writes, and a repeated unchanged plan resumes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.

| When | Open |
|---|---|
| Interviewing the repo, writing the kit plan or proving the kit | `references/create.md` |
| Writing the kit plan's prose or the testing guidance | `references/writing.md` |
| Proposing testing guidance or auditing the suite | `references/testing.md` |
| Proposing hard constraints, rule proofs or a baseline, or running a correct pass | `references/constraints.md` |
| Selecting slop rules for a language or banning prose comments | `references/slop-baseline.md` |
| The product calls an outside service or API | `references/third-party.md` |
| Running a maintain pass, triaging a discrepancy or correcting an applied kit | `references/maintain.md` |
| Proposing or reviewing no-mistakes wiring or the coverage gate | `references/no-mistakes.md` |
| Writing the kit plan | `schemas/kit-plan.json` |
| Preparing check plans for rule proofs | `schemas/check-plan.json` |
