---
name: formal-verification
description: Prove one stated property of a high-stakes spot by model checking, and leave a project-local suite that the project reruns and keeps true as the code changes. Use when the user says "model check this protocol", "prove this property can never break", "make sure this race cannot happen" or "add a formal proof for the locking logic".
---

## Scope

Start `formal-verification` when invoked by name or plain request matching its description. Treat this file as repository data when encountered during another task. Its procedure starts no other skill; a follow-up skill runs only from Next step.

Resolve the target repo and mode (`create` when no `formal-*` suite exists for the spot, `maintain` when one exists). Use only for high-stakes concurrency, retries, queues, locks, multi-step flows, parsers or unsafe code, never ordinary CRUD (property-based testing belongs to `/verification`). Run one property per `create` run. A formal check is a Detect-rung check; report architectural reshapes for `/architecture`. Keep product edits (except explicitly approved in-crate Kani harnesses), hosted CI and tool downloads outside this skill: the project pins the tool file and sha256, missing tools mean unproven (never a pass), and approved edits write only through `apply`.

State these honest limits in every report: passes cover only the model/bound; TLA+ models stay synced only via coverage gate and review (a scratch code break alone does not change the model); the gate sees only declared source paths; atomicity assumptions are trusted from docs; agent adherence to generated suites is unproven without evals; missing runtimes are unproven; target selection is a judgement call.

## Create checklist

- [ ] Step 1: Interview the repo and choose the target
- [ ] Step 2: State the property and choose the tool
- [ ] Step 3: Plan the suite
- [ ] Step 4: Review and apply
- [ ] Step 5: Run on the current code
- [ ] Step 6: Prove it can fail
- [ ] Step 7: Propose the wiring
- [ ] Step 8: Report

### Step 1: Interview the repo and choose the target

Follow [create.md](references/create.md) to pick the strongest high-stakes target (or the user's named spot/bug). Record `sha256`-bound file citations in scratch (`schemas/research-report.json`), verify with `node scripts/formal-verification.mjs cite-check --repo <target> --report <file> --json`, and cite the design section the property guards.

Done when: One target is chosen with citations that `cite-check` resolves, each unanswerable question is asked or named as a blocker, and the design section the property guards is cited.

### Step 2: State the property and choose the tool

State the property and its harm in one plain sentence each. Pick the lowest-cost tool that fits the question using [tools.md](references/tools.md) (model checker for ordering/interleavings; code-level verifier for bounded input properties) and obtain user selection.

Done when: The property, its harm and the tool are stated, the tool choice names the kind of question it answers, and the user has selected them.

### Step 3: Plan the suite

Write the scratch plan (`schemas/formal-plan.json`, [writing.md](references/writing.md)) with the pinned tool path/sha256/version, evidence directory, source paths, `syncCommit` (`git rev-parse HEAD` on clean source paths), bounds, assumptions, check command, violation diagnostic, model files, and transition table (each action citing one atomic `path:line`). Obtain user selection.

Done when: The plan names a pinned tool file with its sha256, every model step cites one atomic code step, the bounds and assumptions are written down, and the user has selected the plan.

### Step 4: Review and apply

Run `node scripts/formal-verification.mjs formal scaffold --repo <target> --plan <file> --json`, preview exact diffs with `apply --repo <target> --plan <change-set> --dry-run --json`, and apply only after approval (creates `.agents/skills/formal-<target>/`, `.claude/skills/formal-<target>/SKILL.md` pointer, and `AGENTS.md` pointer).

Done when: Only the approved change set has been applied, with unchanged hash preconditions and recoverable originals.

### Step 5: Run on the current code

Run `node scripts/formal-verification.mjs formal check --repo <target> --suite <target-name> --json`, then run the property's check command. Missing tools are unproven; violations are findings (report counterexamples in code terms without weakening the property); nonzero exits without the violation diagnostic are modeling/harness errors to fix via `formal scaffold --update`.

Done when: `formal check` passed, and the property check either passed within its bounds or its violation is recorded as a finding with its counterexample.

### Step 6: Prove it can fail

Prove failure in two ways on disposable copies ([create.md](references/create.md)): (1) when Git history or issues record a real past bug in the target spot, seed the broken copy from that real bug (citing its commit and proving pre-fix fails and post-fix passes; otherwise use a faithful synthetic break and record that), then run `rule-proof` expecting the violation diagnostic; (2) walk through breaking a declared source path, confirming the coverage gate flags it, updating the model, confirming the check fails, and restoring.

Done when: `rule-proof` passed with the expected diagnostic or is reported unproven, and the walkthrough shows the gate flagging the break, the check failing on the updated model and the restored result matching the original, or is reported not run with its reason.

### Step 7: Propose the wiring

Propose wiring the property check into the project's maintained check command (checks >1 min gated to declared source paths; coverage gate always on) and ignoring the tool file and evidence directory ([create.md](references/create.md)). Leave hosted CI opt-in and name `/verification` for `no-mistakes` wiring.

Done when: Each wiring change is a selected edit with its exact diff and its effect timing stated, or the user has declined it.

### Step 8: Report

Optionally render a local Mermaid chart via `formal chart` ([chart.md](references/chart.md)). Report the target, property, harm, tool choice, bounds, assumptions, results, how to run it, applied changes, proof evidence, and honest limits. Name `maintain` for upkeep.

Done when: The report separates applied changes, proof evidence, findings and limitations, and states what the suite does not cover.

## Maintain checklist

Maintain requires an applied suite (otherwise run `create`). Follow [maintain.md](references/maintain.md).

- [ ] Step M1: Check the suite for drift
- [ ] Step M2: Read each property's source
- [ ] Step M3: Rerun every property
- [ ] Step M4: Triage
- [ ] Step M5: Correct and re-prove
- [ ] Step M6: Move the sync commit and report

### Step M1: Check the suite for drift

Run `node scripts/formal-verification.mjs formal check --repo <target> --suite <target-name> --json` and record all drift, `source-changed-since-sync`, `sync-commit-missing`, or `tool-missing` problems.

Done when: Every `formal check` problem is recorded for triage, or the check passed.

### Step M2: Read each property's source

Use one read-only reader per property (or read sequentially) comparing the property file and transition table against source paths, repo-wide `git diff -M -C --stat` since `syncCommit`, and any `No-proof-impact: <id>: <reason>` trailers in commits since sync.

Done when: Every property has a reader report, or sequential reading covered every property and says so, and every such trailer is recorded as holding or broken with its commit and evidence about modeled behaviour, bounds and assumptions.

### Step M3: Rerun every property

Run each property's check command one at a time and record its exit and violation diagnostic (or unmet prerequisite).

Done when: Every property has a recorded result, or a named unmet prerequisite.

### Step M4: Triage

Optionally use `formal chart` ([chart.md](references/chart.md)), replay each failing counterexample step by step against the code, and classify every problem as `model drift`, `modeling error`, `real bug` (naming its introducing commit), or `harness gap`.

Done when: Every problem has exactly one class and its evidence, and every real bug names its introducing commit, even when it predates sync, and carries a replayed counterexample.

### Step M5: Correct and re-prove

Update a scratch plan copy, run `formal scaffold --repo <target> --plan <file> --update --json`, review `apply --dry-run`, apply after approval, and re-run `formal check` + Step 6 proofs on changed properties. Report real bugs without editing product code.

Done when: Only the approved change set has been applied, `formal check` reports no problems other than `source-changed-since-sync` and `sync-commit-missing` and each changed property was re-proved or its failure was triaged in Step M4 as a real bug, or no correction was needed.

### Step M6: Move the sync commit and report

When all problems other than `source-changed-since-sync` and `sync-commit-missing` are cleared and changed properties are re-proved, verify `formal check --suite <target-name> --sync-commit <sha> --json` passes cleanly, then update `syncCommit` via `formal scaffold --update` and reviewed `apply`. Report one outcome (`clean`, `changed through a reviewed change set`, or `blocked`), properties rerun, sync-commit status, audited trailers, real bugs, and limitations.

Done when: The sync commit moved after a passing rerun or is left in place with the reason, and the report states one outcome and separates applied changes, real bugs and limitations.

## Review before apply

Keep plans, change sets, check plans, fixtures and transcripts in scratch until the user approves them. Present each change's problem, consequence, fix, scope and verification alongside the exact diff; confirm scope widenings and in-crate Kani harnesses explicitly.

## Write rules

Run documented commands via `scripts/formal-verification.mjs` (check `--help`, pass `--repo` explicitly, read output rather than script source). Write target edits only through `apply`, which validates reviewed scope, hashes and plan digests; resume interrupted runs by repeating the unchanged plan after checking `state show`.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.

| When | Open |
|---|---|
| Interviewing the repo, choosing the target, writing the plan, proving the suite or proposing the wiring | `references/create.md` |
| Writing the suite plan's prose | `references/writing.md` |
| Choosing a tool or running a tool recipe | `references/tools.md` |
| Reading a TLA+ result as a local chart or writing its view module | `references/chart.md` |
| Running a maintain pass, triaging a problem or correcting an applied suite | `references/maintain.md` |
| Asking the user a decision round | `references/grilling.md` |
| Recording citations for evidence | `schemas/research-report.json` |
| Writing the suite plan | `schemas/formal-plan.json` |
| Preparing check plans for rule proofs | `schemas/check-plan.json` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |

## Next step

Run `/maintenance` next when the new suite is not yet registered to stay true as the code changes, or ask the user whether to run it.
