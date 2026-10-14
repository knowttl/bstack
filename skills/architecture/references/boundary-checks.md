# Boundary checks

Use this reference to turn a selected boundary into a native check, prove it and keep existing violations visible.
Checks catch defined mistakes, not every unsound future design decision.
Prefer the project's existing architecture checker, linter or type system to another dependency engine, and use parsing or dependency analysis for semantic rules, never raw text matching.
Separate formatting from design checks so a cosmetic change cannot conceal an architectural failure.

## Contents

- [Record each boundary rule](#record-each-boundary-rule)
- [Collect the evidence](#collect-the-evidence)
- [Prove every rule](#prove-every-rule)
- [Wire the maintained command](#wire-the-maintained-command)
- [Control existing violations](#control-existing-violations)

## Record each boundary rule

| Field | Required evidence |
|---|---|
| Reason | The project-specific risk or approved requirement, with a concrete example |
| Scope | The packages, modules or public boundaries the rule governs |
| Source | The existing authoritative document or executable configuration and its exact locator |
| Enforcement | The native check or human review, and the expected outcome |
| Exception policy | The reason, narrow scope and removal condition for an exception, or why none is allowed |

Example rules: UI modules cannot import the database adapter, a package cannot import another package's private files, and a forbidden dependency cycle between layers fails the check.
Inventory design documents, contribution guidance, scoped agent instructions and native checks before proposing a rule, and reuse the one already present when it expresses the constraint reliably.
Propose a custom checker only when existing tools cannot.

## Collect the evidence

Research the project's language and tools in this order: repo configs, official language and tool documentation, then established community guides for remaining gaps.
Without web access, mark language and outside recommendations "not researched" with the reason and use repo evidence and general principles alone.
Collect dependency edges through the native analysis the research selects, resolving aliases, re-exports and package entry points.
Report unsupported syntax, dynamic dependencies and unresolved imports as coverage limits, because unresolved imports do not demonstrate independence.
Record citations in scratch following `schemas/research-report.json` and run `cite-check --repo <target> --report <file> --json`, with `--workspace` for a new idea, before a finding relies on the report.
The checker establishes locations and byte freshness, so open each cited source to confirm it supports the claim.

History and overlap come from scripts, not guesses.
`measure --repo <target> --range <base>..<head> --json` reports revision-bound sizes, change frequency and co-change signals with supporting commits.
It covers eligible files present at the endpoint and follows detected lineage back through renames to addition, but merged deletion and unrelated path reuse can attribute old-lifetime commits to the replacement.
Pass `--exclusions <file>` following `schemas/measure-exclusions.json` for generated paths, lockfiles and explicitly identified broad formatting commits.
`overlap --repo <target> --plans <file> <file> --json` compares two declared plans following `schemas/overlap-plan.json`.
Plan paths use forward slashes, case-sensitive `*` and `?` within segments and whole-segment `**` for recursive matching, including planned new files.
Both are advisory: signals do not establish violations, observed conflicts or semantic independence.

## Prove every rule

Require a representative valid case and a deliberate violation in disposable fixtures.
After preparing native dependencies in the clean and independently seeded copies, run:

`rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json`

The plan follows `schemas/check-plan.json`; its selected check supplies the native command object.
The command runs separate disposable copies, records versions, exits and diagnostics in scratch, and removes the copies.
The clean copy must pass and the violation must fail with the expected diagnostic.
Repeat for each private import, alias or equivalent-resolution bypass and each forbidden cycle, keeping public imports and the permitted dependency direction in the clean control.
The Python equivalent-resolution fixture exercises an intermediate public-looking bridge to private implementation; proof does not establish every possible re-export or dynamic dependency, so keep these coverage limits next to the rule evidence.
Unavailable tools, interrupted execution and failed clean setup are blocked, never proof.
Rule names alone never prove equivalent enforcement across languages; each enabled mapping needs its own project configuration and proof.
Verification requires representative allowed and forbidden imports and compatible public behaviour, not file-count targets.

## Wire the maintained command

Extend the project's existing check command through a reviewed `apply` edit instead of adding a competing entry point.
The target repo owns each checker or pins its development dependency, and running checks must not require an installed bstack skill or agent session.
Scope each package rule in its native configuration or checker, and prove a sibling package's permitted use stays valid.
Prove the maintained command itself with the same `rule-proof` interface on disposable sources that contain the integrated command, installed dependencies and the accepted baseline, with one new seeded violation in the negative source.
If the project selects CI, apply the same command to its configuration as another reviewed edit; hosted behaviour that has not run remains unverified.

An edit that integrates selected checks declares `checkIntegration`: a nonempty list of unique command paths, each a nonempty array of string keys, such as `[["scripts", "check"]]` for a package script or `[["jobs", "check", "steps", "0", "run"]]` for a CI step written in JSON syntax.
Apply requires each selected path to resolve to a string command made of literal arguments joined by fail-fast top-level `&&` chains.
It rejects failure-masking operators, pipelines, background execution, shell dispatch, substitutions, redirection, quoted mixtures and escaping with `ignored-check-failure` before any write.
`continue-on-error` and `allow_failure` on a selected CI command's ancestors must be literal `false` when present.

## Control existing violations

Fix selected findings and keep the rest visible.
Prefer the native tool's own baseline or suppression mechanism where one exists.
Where none does, record known violations in a baseline following `schemas/baseline.schema.json` and run `baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --json`, with the complete current violations as rule, path and key objects whose keys stay stable when lines move.
Keep native execution failures out of the violation list, because unavailable analysis cannot establish an empty one.
The checker rejects new violations and entries whose violations were fixed.
`--refresh` removes fixed entries but cannot accept new debt; adding one entry needs `--refresh --finding <id> --findings <file> --entry <file>` for a selected unresolved debt finding covering that path.
Every entry records a reason, narrow scope and removal condition.
Never silently refresh a baseline to accept new failures, and never disable a whole rule or exclude a whole directory to obtain green.
A changed-file-only check cannot establish a constraint that depends on the complete import graph or generated outputs.

Done when: Every selected rule has a passing proof or is reported unproven with its coverage limits, existing violations are in a visible shrinking baseline, and no whole rule or directory is disabled to obtain green.
