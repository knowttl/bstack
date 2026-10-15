# Constraints

Use this reference to turn a repeated mistake or a baseline principle into a hard constraint.
Checks catch defined mistakes, not every unsound future design decision.

## Contents

- [The ladder](#the-ladder)
- [Principles L1-L8](#principles-l1-l8)
- [Record each constraint](#record-each-constraint)
- [Prove every rule](#prove-every-rule)
- [Repeated corrections](#repeated-corrections)
- [Wire the maintained command](#wire-the-maintained-command)
- [Control existing violations](#control-existing-violations)

## The ladder

1. **Eliminate**: make the mistake unrepresentable through types, schemas or architecture.
2. **Detect**: fail the maintained command through lint, type or dependency-graph checks.
3. **Encode**: state it in agent instructions or skills.
4. **Review**: leave it to human or reviewer judgement.

Start at the top rung and move down only when the rung above cannot express the constraint.

## Principles L1-L8

- **L1** Beyond the default slop baseline, start from a mistake with two cited occurrences, drawn from commits, reverts, review comments, agent instruction files, workaround comments or the user's correction, not a style wish.
- **L2** Use the highest rung that works: make it unrepresentable before you lint it.
- **L3** Implement each slop principle with the language's native linter first; write a custom syntax-tree check only where nothing native exists.
- **L4** Semantic rules read the syntax tree or dependency graph, never raw text.
- **L5** Prove every rule: a valid example passes and a seeded violation fails with the expected message, which names the file, type or function to use instead.
- **L6** The rule fails the one maintained check command; CI runs that same command, wired only when the owner selects it.
- **L7** Existing violations go into a visible, shrinking baseline; new ones fail; exceptions are narrow, reasoned and have a removal condition.
- **L8** No arbitrary size limits, and no design call disguised as a lint error.

Separate formatting from design checks so a cosmetic change cannot conceal an architectural failure.
Do not disguise a human design judgement as a deterministic violation; give the reviewer the relevant authority, example and evidence instead.
A native duplication linter supplies review candidates, not proof that similar code is the same knowledge.

## Record each constraint

| Field | Required evidence |
|---|---|
| Reason | The mistake with its two cited occurrences, or the approved requirement, with a concrete example |
| Scope | The packages, modules or public boundaries the rule governs |
| Source | The existing authoritative document or executable configuration and its exact locator |
| Enforcement | The rung, the concrete check, the expected outcome and the file, type or function its diagnostic names to use instead |
| Exception policy | The reason, narrow scope and removal condition for an exception, or why none is allowed |

Inventory design documents, contribution guidance, scoped agent instructions and native checks before proposing a rule.
Reuse the formatter, linter, type system or test framework already present when it expresses the constraint reliably.
Tool configuration owns the executable rule; documents link to it instead of copying its settings.

## Prove every rule

Require a representative valid case and a deliberate violation in disposable fixtures.
In correct mode, reproduce a cited real occurrence from a review comment, issue or commit as the seeded violation, and attach its commit when available.
If a faithful reproduction is not possible, report the rule check as unproven.
After preparing native dependencies in the clean and independently seeded copies, run:

`rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json`

The plan follows `schemas/check-plan.json`; its selected check supplies the native command object.
The command runs separate disposable copies, records versions, exits and diagnostics in scratch, and removes the copies.
The valid copy must pass, and the violation must fail with the expected diagnostic.
Include relevant syntax, aliases, re-exports, generated code and documented exceptions in the proof, and record unsupported syntax and dynamic dependencies as coverage limits.
Unavailable tools, interrupted execution and failed clean setup are blocked, never proof.

Prove the one maintained command, not only the native tool, so the proof shows the constraint fails the command contributors run.
Rule names alone never prove equivalent enforcement across languages; each enabled mapping needs its own project configuration and proof.

## Repeated corrections

A mistake that recurs despite a written rule is a repeat of its class: a written rule sits on the Encode rung and nothing fails when an agent skips it.
Move the class up at least one rung in the same change instead of restating the rule.
Once a check enforces a written rule, replace the rule with a pointer to the check, so the rule has one authoritative home.
Keep prose only for a judgement call no check can express.

## Wire the maintained command

Extend the project's existing check command through a reviewed `apply` edit instead of adding a competing entry point.
The target repo owns each checker or pins its development dependency, and running checks must not require an installed bstack skill or agent session.
Scope each package rule in its native configuration or checker, and prove a sibling package's permitted use stays valid.
If the project selects CI, apply the same maintained command to its configuration as another reviewed edit; hosted behaviour that has not run remains unverified.

An edit that integrates selected checks declares `checkIntegration`: a nonempty list of unique command paths, each a nonempty array of string keys, such as `[["scripts", "check"]]` for a package script.
Apply then requires each selected path to resolve to a string command made of literal arguments joined by fail-fast top-level `&&` chains.
It rejects failure-masking operators, pipelines, background execution, shell dispatch, substitutions, redirection, quoted mixtures and escaping with `ignored-check-failure` before any write.
Failure-masking flags such as `continue-on-error` must be literal `false` on a selected CI command's ancestors.

## Control existing violations

Fix selected findings and keep the rest visible.
Prefer the native tool's own baseline or suppression mechanism where one exists.
Where none does, record known violations in a baseline following `schemas/baseline.schema.json` and run `baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --json`, with the complete current violations as rule, path and key objects whose keys stay stable when lines move.
The checker rejects new violations and entries whose violations were fixed.
`--refresh` removes fixed entries but cannot accept new debt; adding one entry needs `--refresh --finding <id> --findings <file> --entry <file>` for a selected unresolved debt finding covering that path.
Every entry records a reason, narrow scope and removal condition.
Never silently refresh a baseline to accept new failures, and never disable a whole rule or exclude a whole directory to obtain green.
A changed-file-only check cannot establish a constraint that depends on the complete import graph or generated outputs.
