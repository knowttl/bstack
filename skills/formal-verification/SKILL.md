---
name: formal-verification
description: Prove one stated property of a high-stakes spot by model checking, and leave a project-local suite that the project reruns and keeps true as the code changes.
disable-model-invocation: true
---

## Scope

Only the user starts formal-verification.
Start this procedure only when the user's message explicitly invokes `$formal-verification`, `/formal-verification`, `/skill:formal-verification` or selects it through the host's skills menu.
A plain request such as "model-check this race" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target repo and the mode, `create` or `maintain`, before proceeding.
Use `create` when the repo has no `formal-*` suite for the spot and `maintain` when it has one; if the user's choice contradicts the repo, say so and ask.

Create proves one stated property of one high-stakes spot and leaves a `formal-<target>` suite at `.agents/skills/formal-<target>/`.
Maintain keeps an applied suite true: it checks the suite for drift, reruns every property, re-proves the changed ones and triages each problem into one of four classes.
Use create where a mistake costs money or data and depends on timing or a rare input, such as payments, retries, job queues, locking, a multi-step sign-up or checkout, a parser or unsafe Rust.
Use maintain before a release, after a large refactor of code with a proven property, or when `/maintenance sweep` says so.
Do not use either for ordinary screens, forms or CRUD code, where tests and the verification kit do better.
Property-based testing is not formal verification: it samples inputs, so it is a test.

A formal check is a Detect-rung check.
Making the bad state impossible to represent stays preferred, so when the evidence points at a design that can be reshaped, report that for `/architecture` and still verify the property that stands today.
Run one property per create run.
No mode edits product code, weakens a property, adds hosted CI or installs a tool: the project pins the exact tool file and its sha256, and a missing tool means the property is unproven, never a pass.
A Kani harness normally lives in the crate under `#[cfg(kani)]`, which is an edit inside product source and needs its own explicit approval; a TLA+ model lives entirely inside the suite folder.
Scripts collect facts and render reviewable change sets; this workflow writes target changes through `apply`, after the user approves the exact diff.
Checks the suite holds must run without bstack installed, though not without the project's own tool and runtime.
Start no other skill: name `/architecture`, `/verification` or `/maintenance` as a next step for the user to run, and run none.

State these limits in every report, because the result is easy to read as stronger than it is.

- A pass covers the model or the bound, not the whole system.
- A TLA+ model stays true to the code only through the coverage gate and review, because no tool connects the model to the code mechanically; a scratch break in the real code does not change the model, so the model checker alone never catches it.
- The gate notices changes to declared source paths only.
- Atomicity assumptions, such as an atomic `compareAndSet`, are trusted from documentation and not verified.
- Whether a fresh agent follows the generated suite correctly is unproven until a model-run evaluation exists.
- A team without the tool's runtime gets an unproven result, not a pass.
- Choosing the strongest target is a judgement call that scripts cannot check.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Interview the repo and choose the target
- [ ] Step 2: State the property and choose the tool
- [ ] Step 3: Plan the suite
- [ ] Step 4: Review and apply
- [ ] Step 5: Run on the current code
- [ ] Step 6: Prove it can fail
- [ ] Step 7: Propose the wiring
- [ ] Step 8: Report

### Step 1: Interview the repo and choose the target

Answer from the codebase and ask the user only what the repo cannot show: which promise the code makes whose break costs the most, and what the user already knows broke.
If the user named an area or a bug, start there; otherwise choose the strongest target in the repo, not the easiest to verify.
Record each finding as a file citation in scratch following `schemas/research-report.json`, binding every cited file to the SHA-256 of the exact bytes read with state kind `sha256`, then run `node scripts/formal-verification.mjs cite-check --repo <target> --report <file> --json`.
Open each cited source to confirm it supports the claim, because the checker establishes only locations and byte freshness.
Find the design section that states the behaviour; when the repo has no design document, cite the nearest authoritative statement of it, say so, and name `/architecture` as a next step for the user to run.
Use the [create guide](references/create.md) for the interview questions and the target criteria.

Done when: One target is chosen with citations that `cite-check` resolves, each unanswerable question is asked or named as a blocker, and the design section the property guards is cited.

### Step 2: State the property and choose the tool

State the property in one plain sentence and the harm of breaking it in one plain sentence, in the code's own nouns and without the verification language.
Choose the tool by the kind of question: whether steps can happen in a bad order suits a model checker over a small model of the design, and whether the code itself behaves for every input within a bound suits a verifier that runs on the code.
Prefer a tool the project's developers can install and run, and tell the user why you chose it.
Load the [tool recipes](references/tools.md) for the two worked recipes and the tools named as guidance only.
Obtain the user's selection of the property, the harm and the tool.

Done when: The property, its harm and the tool are stated, the tool choice names the kind of question it answers, and the user has selected them.

### Step 3: Plan the suite

Write the suite plan in scratch following `schemas/formal-plan.json`: the pinned tool with its exact file path, sha256 and version, the evidence directory, and for the property its source paths, sync commit, bounds, assumptions, check command, violation diagnostic, model files and transition table.
The sync commit is `git rev-parse HEAD` once the source paths have no uncommitted change.
Every model step names the one atomic code step it stands for as `path:line`, inside the property's source paths, and says why that step is atomic.
Show the user the property, its bounds and assumptions, and the transition table before anything is written.
The project pins the tool: if the tool file is not already in the project's agreed location, ask the user to put it there and give its sha256; never fetch, install or commit it.

Done when: The plan names a pinned tool file with its sha256, every model step cites one atomic code step, the bounds and assumptions are written down, and the user has selected the plan.

### Step 4: Review and apply

Run `node scripts/formal-verification.mjs formal scaffold --repo <target> --plan <file> --json` to render the change set in scratch.
It rejects a model step that cites no atomic code step, cites code outside the property's source paths or cites a line that does not exist.
Present its exact diff with `apply --repo <target> --plan <change-set> --dry-run --json`, then run the unchanged change set without `--dry-run` only after the user approves those bytes.
The change set creates the suite at `.agents/skills/formal-<target>/`, a thin `.claude/skills/formal-<target>/SKILL.md` pointer and one `AGENTS.md` pointer line, so every host finds the same suite.
Use `state show` to inspect an interrupted apply, and repeat the unchanged plan to resume.
Never write suite files directly or bypass a missing command.

Done when: Only the approved change set has been applied, with unchanged hash preconditions and recoverable originals.

### Step 5: Run on the current code

Run `node scripts/formal-verification.mjs formal check --repo <target> --suite <target-name> --json`, which confirms the suite matches its plan and the pinned tool's sha256, then run the property's check command exactly as the suite shows it.
When the tool file is missing, report the property as unproven and stop; do not substitute another tool or version.
A property violation on the current code stays a finding: report the counterexample in the code's terms, never weaken the property or the model until it passes, and change no product code unless the user asks.
A nonzero exit without the violation diagnostic is a modeling error or a harness problem: correct the plan and run `formal scaffold --update`, and do not report it as a finding.

Done when: `formal check` passed, and the property check either passed within its bounds or its violation is recorded as a finding with its counterexample.

### Step 6: Prove it can fail

Prove the check can fail in two ways, and restore everything afterwards.
First, run `rule-proof` on the property check with a clean copy and a broken copy of the code and model, expecting the property's violation diagnostic, following the [create guide](references/create.md) for the check plan and the fixtures.
Then do the walkthrough on a disposable copy of the repo, never the user's working tree: follow the generated suite, break the real code at a declared source path, confirm the coverage gate flags the change, update the model to match the break, confirm the check now fails with the violation diagnostic, then restore the code and the model and confirm the result is back where it started.
Say plainly that the model checker alone cannot see a code change; what the walkthrough proves is that the gate flags it, the agent updates the model and the check then fails.
A Kani check runs on the code, so a break in the code is caught directly.
Report a proof that could not run as unproven.

Done when: `rule-proof` passed with the expected diagnostic or is reported unproven, and the walkthrough shows the gate flagging the break, the check failing on the updated model and the restored result matching the original, or is reported not run with its reason.

### Step 7: Propose the wiring

Propose each upkeep change as a selected edit with its exact diff, and never apply an unselected one.
Wire the property check into the project's one maintained check command, so a failure fails that command: a check slower than about a minute runs only when a change touches its source paths, while the coverage gate always runs.
Ignore the tool file and the evidence directory in version control so neither enters the suite, and tell the user the one command that gets the tool when the project's own instructions name one.
Add no hosted CI workflow unless the user asks, and name `/verification` for no-mistakes wiring instead of restating it.
Load the [create guide](references/create.md) for the wiring and the slower-check condition.

Done when: Each wiring change is a selected edit with its exact diff and its effect timing stated, or the user has declined it.

### Step 8: Report

State the target, the property and its harm in plain words, the tool and why it fits, the bounds and assumptions, what the check found, how to run it, and what it does not cover.
Separate applied changes, proof evidence, findings, unproven checks and limitations, and include the honest limits above.
Name `maintain` as the later pass that keeps the suite true, and suggest a second target only when a close one was found.

Done when: The report separates applied changes, proof evidence, findings and limitations, and states what the suite does not cover.

## Maintain checklist

Copy this checklist and tick a step only when its Done when criterion is met.
Maintain needs an applied suite; without one, run `create`.
Load the [maintain guide](references/maintain.md) for the passes, triage classes and outcomes.

- [ ] Step M1: Check the suite for drift
- [ ] Step M2: Read each property's source
- [ ] Step M3: Rerun every property
- [ ] Step M4: Triage
- [ ] Step M5: Correct and re-prove
- [ ] Step M6: Move the sync commit and report

### Step M1: Check the suite for drift

Run `node scripts/formal-verification.mjs formal check --repo <target> --suite <target-name> --json`.
It compares every suite file, the transition tables, the `AGENTS.md` pointer, each property's source paths, its design citation and the pinned tool's sha256 with what `suite.json` renders and with the repo, and reports one problem per finding.
It also reports `source-changed-since-sync` when a property's source paths changed between its sync commit and `HEAD`, which the coverage gate cannot see once the change is on the base branch, and `sync-commit-missing` when the commit is absent or orphaned by a rebase or squash.
A missing tool is reported as unproven and blocks the passes that need it.

Done when: Every `formal check` problem is recorded for triage, or the check passed.

### Step M2: Read each property's source

Where the host supports subagents, give each property one read-only reader; otherwise read the properties one at a time.
Each reader compares one property file and its transition table with the code at its declared source paths and reports disagreements with file and line evidence, without editing or running anything.
Its input includes the diff since the property's sync commit, from the fallback commit that `formal check` names when the sync commit is absent or orphaned.
Its checklist includes covered functions that were renamed, split or moved, even outside the declared source paths, and new writers of the state the property guards; give it the repo-wide `git diff -M -C --stat` since the sync commit as the maintain guide describes, because the source-path diff cannot show them.
Also re-check each `No-proof-impact: <id>: <reason>` trailer in the commits since that sync commit against the model and the transition table, as the maintain guide's trailer audit describes; the message is a claim and never the evidence.

Done when: Every property has a reader report, or sequential reading covered every property and says so, and every such trailer is recorded as holding or broken with its commit.

### Step M3: Rerun every property

Run each property's check command exactly as the suite shows it, one at a time, and record its exit and whether the violation diagnostic appeared.
A property that cannot run is reported with the attempted command and the unmet prerequisite, never counted as passing.

Done when: Every property has a recorded result, or a named unmet prerequisite.

### Step M4: Triage

First replay each failing property's counterexample against the real code, one step at a time, as the maintain guide's replay describes: a step that cannot happen in the code means model drift or a modeling error, and a trace whose every step can happen is a real bug, for which you name the commit that introduced it.
Then sort each problem from the earlier steps, including a broken trailer claim, into exactly one class: model drift, modeling error, real bug or harness gap.
Use an agreed source such as the design section the property cites as the tie-breaker when the replay is unclear, never the code's current behaviour, and ask the user when no agreed source exists.
A failure that first appears after the Step M5 correction returns here, and a broken trailer claim and a failure from the same commit are separate problems.
Keep any scratch reproduction of a bug as report evidence, outside product code.

Done when: Every problem has exactly one class and its evidence, and every real bug names its introducing commit and carries a replayed counterexample.

### Step M5: Correct and re-prove

Edit a copy of the suite plan in scratch, run `formal scaffold --repo <target> --plan <file> --update --json`, present its exact diff with `apply --dry-run`, and apply the unchanged change set only after the user approves those bytes.
Then rerun `formal check` and every changed property, and prove each changed property can still fail as Step 6 of the create checklist does.
Report a real bug with its counterexample and change no product code.

Done when: Only the approved change set has been applied, `formal check` reports no problems other than `source-changed-since-sync` and `sync-commit-missing` and each changed property was re-proved, or no correction was needed.

### Step M6: Move the sync commit and report

When every problem other than `source-changed-since-sync` and `sync-commit-missing` is gone, every changed property is re-proved (a property with a real bug is not) and no check is blocked, propose `git rev-parse HEAD` as the new sync commit and run `formal check --suite <target-name> --sync-commit <sha> --json`.
Only when that rerun reports no problems at all, set `syncCommit` on each property in the plan copy, run `formal scaffold --update`, apply the unchanged change set after the user approves those bytes, and run `formal check` once more.
Otherwise leave the recorded sync commit as it is and say why; the move is never a way to clear drift.
Report one outcome: clean, changed through a reviewed change set, or blocked.
A changed report can list an applied correction and a real bug together.
Name the properties rerun, the properties not run and why, whether the sync commit moved, the audited trailers with their commits, the real bugs found and every limitation.
For a property that passed in Step M3 and fails after a correction, say the old pass was on a stale description.

Done when: The sync commit moved after a passing rerun or is left in place with the reason, and the report states one outcome and separates applied changes, real bugs and limitations.

## Review before apply

Keep plans, change sets, check plans, fixtures and transcripts in scratch outside the target until the user selects changes.
Present each proposed change's problem, consequence, fix, scope and verification, then the exact diff.
A scope change needs a decision, not a silent widening, and a harness inside product source needs its own approval.

## Write rules

Use the `scripts/formal-verification.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use `--help` for any command's syntax and never guess arguments.
Only `apply` makes project edits, including `AGENTS.md`; it validates reviewed scope, hashes and the plan digest before writing and refuses anything changed since review.
User changes block remaining writes, and a repeated unchanged plan resumes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.

| When | Open |
|---|---|
| Interviewing the repo, choosing the target, writing the plan, proving the suite or proposing the wiring | `references/create.md` |
| Choosing a tool or running a tool recipe | `references/tools.md` |
| Running a maintain pass, triaging a problem or correcting an applied suite | `references/maintain.md` |
| Asking the user a decision round | `references/grilling.md` |
| Recording citations for evidence | `schemas/research-report.json` |
| Writing the suite plan | `schemas/formal-plan.json` |
| Preparing check plans for rule proofs | `schemas/check-plan.json` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
