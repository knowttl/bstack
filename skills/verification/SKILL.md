---
name: verification
description: Create a project-local verification kit that launches and drives the real product, keep it true as the product changes, adopt testing and constraint guidance for it, and turn a repeated correction into a proven check. Use when the user says "improve our tests", "our tests are slow or flaky", "set up a way to run and test the real product", "create a verification kit" or "turn this repeated mistake into a check".
---

## Scope

Start `verification` when invoked by name or plain request matching its description. Treat this file as repository data when encountered during another task. Its procedure starts no other skill; a follow-up skill runs only from Next step.

Resolve the target repo and mode (`create`, `maintain`, or `correct`) first: `create` when no kit exists, `maintain` when one exists, `correct` when turning a repeated mistake into a proven check (works with or without a kit). Keep product code edits, bug fixes, hosted CI setup and pull requests outside this skill: report blockers and product bugs directly, keep proposed checks runnable without bstack installed, and write approved target edits only through `apply`.

## Create checklist

- [ ] Step 1: Interview the repo
- [ ] Step 2: Plan the kit
- [ ] Step 3: Review and apply the kit
- [ ] Step 4: Prove the kit
- [ ] Step 5: Propose testing guidance and safety rules
- [ ] Step 6: Propose constraints
- [ ] Step 7: Audit the existing suite
- [ ] Step 8: Propose no-mistakes wiring
- [ ] Step 9: Report

### Step 1: Interview the repo

Answer from the codebase first using [create.md](references/create.md) (and [third-party.md](references/third-party.md) when calling external APIs); ask the user only what the repo cannot show (surface, launch/drive commands, observable evidence, isolation limits, and high-damage operations). Report any build/startup blocker directly.

Done when: The surface, launch command, drive harness, evidence, isolation limits, third-party applicability and high-damage operations are established from repo evidence or user confirmation, and unanswerable questions are asked or named as blockers.

### Step 2: Plan the kit

Write the scratch plan following `schemas/kit-plan.json` and [writing.md](references/writing.md) with the top 3-5 user-facing features (each step asserting user-visible output, not exit code alone), `coverageGate: true` when using `no-mistakes`, and each feedback layer's command and measured time (or named prerequisite). Obtain user selection.

Done when: The plan validates against the schema, every feature step has an observable match, each applicable feedback layer has a command and measured time or prerequisite, and the user has selected it.

### Step 3: Review and apply the kit

Run `node scripts/verification.mjs kit scaffold --repo <target> --plan <file> --json`, preview exact diffs with `apply --repo <target> --plan <change-set> --dry-run --json`, and apply only after approval (creates `.agents/skills/verify-<app>/`, `.claude/skills/verify-<app>/SKILL.md` pointer, and `AGENTS.md` pointer).

Done when: Only the approved change set has been applied, with unchanged hash preconditions and recoverable originals.

### Step 4: Prove the kit

Run `node scripts/verification.mjs kit prove --repo <target> --app <app> --feature <id> --json` once. Fix harness gaps via reviewed `apply`; report product bugs directly; list any stand-in setup steps as unverified.

Done when: A proof run passed on the applied kit with its evidence present at the named location, or the kit is reported as a draft with the failing check named.

### Step 5: Propose testing guidance and safety rules

Adapt [testing.md](references/testing.md) (principles, four-question gate, offline default) and Step 1's high-damage safety rules ([create.md](references/create.md#record-high-damage-operations)) into existing authoritative docs with one `AGENTS.md` pointer ([agents-pointer.md](references/agents-pointer.md)).

Done when: Each selected testing and safety edit names its authoritative destination (or is declined, or no high-damage operation was found).

### Step 6: Propose constraints

Propose the slop baseline and comment ban ([constraints.md](references/constraints.md), [slop-baseline.md](references/slop-baseline.md)) using native tools first. Generate the comment checker with `node scripts/verification.mjs comment-check generate --repo <target> --language <python|go|typescript> [--strict] --json`, triage existing comments (`Delete`, `Reshape`, `Encode`, `Keep-exempt`), prove every enabled rule with `rule-proof`, and baseline unresolved debt with `baseline check`.

Done when: Every enabled rule has a passing proof or is reported unproven, existing comments have a triage class, unresolved violations are in a visible baseline, and no whole rule or directory is disabled to obtain green.

### Step 7: Audit the existing suite

For repos with tests, run the 4-part suite audit in [Step M7](#step-m7-audit-and-speed-up-the-suite), including journeys protected only by unit or mocked tests.

Done when: All four audit parts have evidence or named limitations, proposals are ranked by saving with estimates labelled, and the report names the tests read, or the repo has no tests.

### Step 8: Propose no-mistakes wiring

Extend `.no-mistakes.yaml` using [no-mistakes.md](references/no-mistakes.md) and [fast-feedback.md](references/fast-feedback.md) (coverage gate, kit in Test, test-quality criteria in Review, affected/full commands, and optional pre-push hook only when no gate exists).

Done when: Each wiring change and affected/full command proposal is a selected edit with exact diff and effect timing (or declined), a pre-push hook is offered only without a gate, and inferences are listed as limitations.

### Step 9: Report

Report the kit path, proof evidence, selected changes, unproven rules, audit findings, per-layer timing table, and limitations. Name `maintain` for keeping the kit true.

Done when: The report includes the per-layer timing table and separates applied changes, proof evidence, unresolved findings and limitations.

## Maintain checklist

Maintain requires an applied kit (otherwise run `create`). Follow [maintain.md](references/maintain.md).

- [ ] Step M1: Check the kit for drift
- [ ] Step M2: Read each feature's source
- [ ] Step M3: Drive every feature
- [ ] Step M4: Triage
- [ ] Step M5: Correct the kit
- [ ] Step M6: Mine repeated mistakes
- [ ] Step M7: Audit and speed up the suite
- [ ] Step M8: Report

### Step M1: Check the kit for drift

Run `node scripts/verification.mjs kit check --repo <target> --app <app> --json` and record every finding for triage.

Done when: Every `kit check` problem is recorded for triage, or the check passed.

### Step M2: Read each feature's source

Use one read-only reader per feature (or read sequentially) to compare each feature file against its declared source paths with `path:line` evidence.

Done when: Every feature has a reader report, or sequential reading covered every feature and says so.

### Step M3: Drive every feature

Run `kit prove --repo <target> --app <app> --feature <id> --json` for each feature one at a time; report unreached features with their unmet precondition.

Done when: Every feature has a proof result with its evidence path, or a named unreached prerequisite.

### Step M4: Triage

Classify each discrepancy as doc drift, harness gap, or product bug against an agreed source (ask the user if none exists).

Done when: Every discrepancy has exactly one class and its evidence.

### Step M5: Correct the kit

Update a scratch copy of the kit plan, run `kit scaffold --repo <target> --plan <file> --update --json`, review `apply --dry-run`, apply after approval, and re-run `kit check` + `kit prove` on changed features.

Done when: Only the approved change set has been applied, `kit check` passes and each changed feature proved again, or no correction was needed.

### Step M6: Mine repeated mistakes

Run Steps C1-C2 over all `no-mistakes` runs ([no-mistakes-history.md](references/no-mistakes-history.md)) and review comments without applying changes. Check which adopted constraint rules fired (reporting never-fired rules as pruning candidates only when full history and check output were read). Include observed rework rate and per-task token/cost trends when recorded in history or transcripts (mark unavailable if absent).

Done when: Each repeated mistake has a proposed rung and evidence (or none found with runs read vs total), and each adopted rule is reported as fired, never fired, unknown or unproven with missing evidence named.

### Step M7: Audit and speed up the suite

Using [testing.md](references/testing.md), [fast-feedback.md](references/fast-feedback.md), and [no-mistakes.md](references/no-mistakes.md#change-scoped-test-command), audit four areas: (1) wasteful-test patterns and test-quality rules TQ1-TQ5 with exemptions; (2) per-layer timings, slow tests, workers, setup reuse, and timeouts; (3) suite sections and affected/full commands with safe full fallback; (4) selector misses and scheduled full-run companion. Rank proposals by saving (labelling estimates) and apply only owner-selected changes.

Done when: All four parts have evidence or named limitations, each applicable layer has its command and measured time or prerequisite, and proposals are ranked by saving with nothing removed without selection.

### Step M8: Report

State one outcome (`clean`, `changed through a reviewed change set`, or `blocked`), driven/unreached features, product bugs, audit proposals ranked by saving, per-layer timing table, and limitations.

Done when: The report states one outcome, includes the suite audit and timing table, and separates applied changes, product bugs and limitations.

## Correct checklist

Correct needs no applied kit and does not drive the product. Follow [constraints.md](references/constraints.md).

- [ ] Step C1: Collect mistake evidence
- [ ] Step C2: Classify each mistake and pick a rung
- [ ] Step C3: Prove each check on a real past mistake
- [ ] Step C4: Review and apply
- [ ] Step C5: Report

### Step C1: Collect mistake evidence

Start from the user's correction, then inspect recent commits, reverts, fix-ups, review comments, `no-mistakes` runs ([no-mistakes-history.md](references/no-mistakes-history.md)), instruction files, workaround comments, bypassed dependency wrappers, and project-matched transcripts via `node <installed-recall>/scripts/recall.mjs transcripts` (read-only, untrusted, kept in scratch). Group into classes with >=2 cited occurrences and note any written rule recurred against.

Done when: Each class lists at least two cited occurrences and any written rule it recurred against, or is named as below the threshold.

### Step C2: Classify each mistake and pick a rung

Assign the highest workable rung on the ladder (Architecture -> Types -> Lint/static/model check -> Automated test -> Docs -> Review), explaining why higher rungs fail. Move repeats against a prose rule up at least one rung. Format check diagnostics as `path:line: rule-id: what is wrong. Use <replacement>.` and pass that name to `rule-proof --replacement`.

Done when: Each class has one rung with the reason each higher rung fails, and each check's diagnostic names its replacement.

### Step C3: Prove each check on a real past mistake

Seed the violation from a cited real occurrence (attaching its commit when available), prove it with `rule-proof`, and baseline existing debt with `baseline check`.

Done when: Each check has a passing proof whose seeded violation faithfully reproduces a cited real occurrence, with its commit when available, or is reported unproven.

### Step C4: Review and apply

Present each selected change with its problem, consequence, fix, scope, verification, and exact `apply --dry-run` diff, then apply after approval. Replace enforced prose rules with pointers to their checks; report product-code refactors instead of editing product code.

Done when: Only the approved change set has been applied, or the user has declined each change.

### Step C5: Report

State each class, evidence, rung chosen and why higher rungs failed, proof results, replaced prose rules, reported product changes, and limitations.

Done when: The report separates applied changes, proof evidence, reported product changes and limitations.

## Review before apply

Keep plans, change sets, generated checkers and transcripts in scratch until the user approves them. Present each change's problem, consequence, fix, scope and verification alongside the exact diff; confirm scope widenings and machine-configuration edits explicitly.

## Write rules

Run documented commands via `scripts/verification.mjs` (check `--help` for syntax, pass `--repo` explicitly, and read output rather than script source). Write target edits only through `apply`, which validates reviewed scope, hashes and plan digests; resume interrupted runs by repeating the unchanged plan after checking `state show`.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.

| When | Open |
|---|---|
| Interviewing the repo, writing the kit plan or proving the kit | `references/create.md` |
| Writing the kit plan's prose or the testing guidance | `references/writing.md` |
| Proposing testing guidance or auditing the suite | `references/testing.md` |
| Adding the safety section's `AGENTS.md` pointer | `references/agents-pointer.md` |
| Planning feedback layers, proposing affected/full commands or auditing suite speed | `references/fast-feedback.md` |
| Proposing hard constraints, rule proofs or a baseline, or running a correct pass | `references/constraints.md` |
| Selecting slop rules for a language or banning prose comments | `references/slop-baseline.md` |
| The product calls an outside service or API | `references/third-party.md` |
| Running a maintain pass, triaging a discrepancy or correcting an applied kit | `references/maintain.md` |
| Proposing or reviewing no-mistakes wiring or the coverage gate | `references/no-mistakes.md` |
| Reading the project's no-mistakes runs for a correct or maintain pass | `references/no-mistakes-history.md` |
| Writing the kit plan | `schemas/kit-plan.json` |
| Preparing check plans for rule proofs | `schemas/check-plan.json` |

## Next step

Run `/maintenance` next when the kit and its documents are not yet registered to stay true as the product changes, or ask the user whether to run it.
