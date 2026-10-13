---
name: verification
description: Create a project-local verification kit that launches and drives the real product, and adopt testing and constraint guidance for it.
disable-model-invocation: true
---

## Scope

Only the user starts verification.
Start this procedure only when the user's message explicitly invokes `$verification`, `/verification`, `/skill:verification` or selects it through the host's skills menu.
A plain request such as "set up verification" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target repo and the mode before proceeding.

This version provides `create`.
If the user asks for `maintain`, say it is not available yet and stop; do not improvise a substitute pass.
No-mistakes wiring and the feature-map coverage gate arrive with `maintain`.

Create builds a kit in the target repo that tells an agent how to start and drive the product, plus a feature map of how a user reaches each feature.
It never edits product code, implements features, fixes product bugs or opens pull requests; when startup needs a product fix, report the blocker.
It never adds hosted CI unless the user selects it.
Checks it proposes must run without bstack installed.
Scripts collect facts and render reviewable change sets; only `apply` writes to the target, after the user approves the exact diff.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Interview the repo
- [ ] Step 2: Plan the kit
- [ ] Step 3: Review and apply the kit
- [ ] Step 4: Prove the kit
- [ ] Step 5: Propose testing guidance
- [ ] Step 6: Propose constraints
- [ ] Step 7: Audit the existing suite
- [ ] Step 8: Report

### Step 1: Interview the repo

Answer from the codebase and ask the user only what the repo cannot show: the surface a user touches, how the product starts locally, how an agent can drive it, what evidence is observable and whether two instances can run side by side.
Prefer the repo's own documented commands and existing drive harnesses before a generic recipe.
If the checkout does not build or start as it is, report the exact blocker instead of editing product code or generating a kit against a broken base.
Decide whether the third-party lens applies: it applies only when the product integrates with an outside service or API that needs authentication or secrets or can hit rate limits.
Use the [kit guide](references/create.md) for the interview questions and the [third-party lens](references/third-party.md) when it applies.

Done when: The surface, launch command, drive harness, evidence, isolation limits and third-party applicability are established from repo evidence, and each unanswerable question is asked or named as a blocker.

### Step 2: Plan the kit

Write the kit plan in scratch, following `schemas/kit-plan.json`, and show the user the app name, launch and doctor commands, helpers and the features it will map before writing anything.
Start with the top three to five user-facing features, each with its declared source paths, entry points, driving steps with observable matches and gotchas.
Every step command must assert something a user would see; a step that only checks an exit code is not proof.
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

### Step 8: Report

State the kit location, the proof result with its evidence path, each selected change and its verification, unproven rules, audit findings and every limitation, including setup steps the proof did not cover.
Name `maintain` as the later pass that keeps the kit true; do not suggest a cadence unless asked.

Done when: The report separates applied changes, proof evidence, unresolved findings and limitations.

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
| Proposing testing guidance or auditing the suite | `references/testing.md` |
| Proposing hard constraints, rule proofs or a baseline | `references/constraints.md` |
| Selecting slop rules for a language or banning prose comments | `references/slop-baseline.md` |
| The product calls an outside service or API | `references/third-party.md` |
| Writing the kit plan | `schemas/kit-plan.json` |
| Preparing check plans for rule proofs | `schemas/check-plan.json` |
