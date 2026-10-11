# Maintenance contract

Record change evidence against the project's maintained contract.
Routine maintenance uses the approved project sources and the current diff; it does not repeat the goal interview or the full repo audit.
Resolve the target, authorised change, explicit comparison base, contract path and selected review or delivery process first.
Read only affected sources and implementation, widening that scope when the evidence exposes a dependency or unresolved decision.

## Contents

- Collect the final scope
- Assess every candidate
- Validate locally
- Validate a standalone checkout
- Supply the selected delivery gate

## Collect the final scope

Use Node 24 or later and Git.
Run these commands from the installed skill, passing the target explicitly.

```sh
node scripts/repo-audit.mjs contract validate --repo <target> --contract .bstack/project.json --json
node scripts/repo-audit.mjs evidence collect --repo <target> --base <ancestor-commit> --json
```

Collect early to identify affected sources, then recollect after implementation so the assessment covers the final committed, staged, unstaged and new paths, including both sides of renames and deleted paths.
Use `--base empty` only before the first commit.
An unavailable base blocks comparison; fetch the required object rather than substituting a passing empty diff.
For a shallow checkout, run `git fetch --unshallow origin`, then `git fetch origin <required-base-commit>`.
The default contract is `.bstack/project.json`; pass `--contract <repo-relative-path>` when the project selected another location.
Custom previous authority needs `--previous-contract <base-policy-path>` on collection and validation.
Keep previous and proposed coverage when scopes, checks or document registrations change.
A missing or incompatible previous policy requires reconciliation or a reviewed migration, not silently reduced coverage.
A first contract requires the explicitly selected foundation finding.

Collection returns a scratch assessment skeleton at `data.path` without editing the project.
Complete that change-specific record instead of adding an agent activity log to the design or glossary.
Recompute candidates after source changes, integration or rebasing, and refresh review and affected execution evidence when relevant inputs or the comparison base change.

## Assess every candidate

Inspect each candidate document against the intended behaviour and the actual before/after implementation.
Assess every unmapped path explicitly too; unknown paths cannot bypass impact review.
Use the installed `schemas/evidence.schema.json` and `schemas/impact-assessment.json` formats.
Each entry names `changedBehavior`, all relevant `changedPaths`, a concrete `reason`, literal source `citations` with `path`, `pointer` and `version: base|current`, and `dependentWork`.
A document entry must cite that authoritative document itself.
List affected authoritative rule IDs in `coverage`.

| Change | Source to inspect | Assessment |
|---|---|---|
| Concept, name or meaning | Relevant glossary | Update confirmed language or explain the preserved definition |
| Responsibility, interface or dependency | Design and accepted decisions | Describe the actual structure and any approved decision change |
| Review expectation or repeated error | Existing standards source | Clarify the rule or propose a deterministic check |
| Purpose, boundary or non-goal | Vision | Surface the intent decision before dependent implementation |
| Setup, commands or document location | Contributor guidance and agent pointers | Keep maintained command and authority links accurate |
| Internal change preserving a contract | Relevant sources for that area | Explain specifically why the documented behaviour remains true |

Choose `updated`, `no-impact` or `decision-needed` for each entry.
An update includes `delta: {"before": "old excerpt", "after": "new excerpt"}` naming the actual changed definition or rule; empty excerpts represent additions or deletions.
A changed date, comment, whitespace or hash alone is not substantive maintenance.
Keep correct documents unchanged.

A substantive no-impact reason connects the concrete implementation change to the cited invariant that still holds.
For example: “The pricing implementation now names its intermediate total; DESIGN.md still requires quantity multiplied by the unit price, and the public quote and checkout outcomes are unchanged.”
Support that claim with the actual diff, literal authoritative excerpts and relevant executed checks.
“Internal change”, “tests pass” or “docs unaffected” alone does not explain impact.
An existing failing journey remains failed even if the changed function's unit checks pass.
If code violates an approved rule, propose correcting the code rather than changing the rule to excuse it.

Use `decision-needed` with concrete `dependentWork` when intent, accepted architecture, an exception or conflicting authority needs an owner decision beyond the authorised scope.
Keep dependent work blocked until the decision is resolved and the assessment is reviewed again.
Replacing an acceptance source requires the old case, approved new case, affected work and a separate approval citation in `decisions`.
Passing checks cannot resolve a pending decision or authenticate approval.

## Validate locally

```sh
node scripts/repo-audit.mjs docs check --repo <target> --json
node scripts/repo-audit.mjs docs generate --repo <target> --check --json
node scripts/repo-audit.mjs evidence validate --repo <target> --base <ancestor-commit> --assessment <assessment.json> --json
```

Use the same selected `--contract` throughout.
For stale generated facts, run `docs generate` without `--check` to render proposals in scratch, review the exact delta, then apply selected edits through the protected apply path.
Validation recomputes coverage and returns `data.fingerprint`, including while review or required execution is missing.
Have the selected reviewer assess the substantive claims against the live diff before recording that value in the assessment's top-level `fingerprint`.
Binding a fingerprint is not automatic semantic approval.
Run required previous and proposed leaf checks through `run-checks` using the reviewed `schemas/check-plan.json` format, then attach `execution: [{"runId": "<run-id>", "plan": "<plan-file>"}]` and validate again.
Plans include the exact declared commands and version probes, check input scopes, changed and deleted inputs, both policy locations and authoritative sources.
Keep capture references outside leaf product scopes.
Refactors require passing original-state protection before edits and compatibility checks afterwards; bug fixes require a captured failing reproduction before the fix and a passing reproduction afterwards.
Outside dependencies also require the matching live `probe record` before/after pair and successful `probe compare`.
Unavailable, stale, skipped or failed required evidence cannot pass.
Local scratch captures cover declared inputs and are not portable attestations.

## Validate a standalone checkout

For portable review, commit implementation first, then collect with `--portable .bstack/assessment.json` and the explicit base.
Copy the returned skeleton to that selected path, complete and review it, obtain and bind the fingerprint through `evidence validate`, and commit the assessment separately.
Portable records use `repo: "."` and retain the reviewed implementation commit in `head`; only the selected assessment may change afterwards.
Pass one explicit record rather than guessing the newest evidence.

```sh
node .bstack/bin/bstack-check.mjs --repo <target> --base <ancestor-commit> --assessment <target>/.bstack/assessment.json --json
```

The installed dependency-free checker needs Node and Git, with no skill or agent session.
Run it in the working checkout and a different-root clean clone with isolated home and cache, the same explicit base and the unchanged committed assessment.
It validates structure, executes each distinct required leaf once with fresh results, then validates the results and review inputs again without editing the assessment.
Earlier saved successes cannot replace that invocation's checks.
The selected base must equal the computed merge base of the explicit source and base objects.
Changes to the checker or contract also execute the base's checker from scratch against the proposed tree; missing or incompatible prior checkers block for migration and explicit prior coverage.
For independent delivery checks, extract and invoke the prior checker with those same explicit inputs too.
Recollect, review, bind and commit again after rebase or base changes.

## Supply the selected delivery gate

Return the assessment, exact source and comparison objects, validation verdicts, fresh `checker-result.json` path, command captures, acceptance coverage, unresolved decisions and coverage limits to the project's selected reviewer or delivery gate.
Keep logs local unless that delivery process requires them; use committed portable review when it needs clean-checkout evidence.
The delivery process must actually invoke the maintained aggregate against submitted changes and assess the semantic claims.
It may be local review, a chosen pipeline or selected CI; do not start another delivery service or assume hosted CI.
Adding instructions, a hook or a workflow does not establish enforced merge protection.
Report failed and unverified outcomes honestly: scripts establish coverage and execution within the supported contract, while reviewers judge meaning and authorisation.
