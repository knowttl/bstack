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
Execution-context example: a context root cannot import modules that perform work reserved for another context.
Discover those roots and responsibilities from entry points, build targets, process or worker spawns and runtime markers, not directory names alone.
For example, a desktop application's renderer may be forbidden from importing modules that perform main-process-only I/O; a real-time loop may exclude blocking work under an approved timing requirement.
An import rule proves only the selected dependency restriction, not a frame budget or the absence of every blocking call.

Sanctioned-wrapper example: only the wrapper module may call a restricted dependency API; other callers must use the wrapper, and the diagnostic names it.
Discover the intended wrapper through manifests, wrapper implementations, existing restricted-API configuration and repeated workarounds at call sites.
A framework hook exposed only through a project wrapper is one worked example, not a blanket ban on that hook or framework.
Prefer eliminating the footgun; use the native linter's restricted-import or restricted-API facility when detection is the highest workable rung.
If the wrapper does not exist, report the product change rather than implementing it as a check.
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
For execution-context rules, keep permitted context imports in the clean control and seed a forbidden cross-context import independently.
For sanctioned-wrapper rules, keep the wrapper's dependency access and callers' wrapper use valid, and seed a direct dependency bypass outside the wrapper.
Exercise alias and re-export bypasses where supported by the selected analysis, and record unsupported paths as coverage limits.
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
Where none does, prepare known violations in a scratch baseline following `schemas/baseline.schema.json`.
Check an existing target baseline read-only with `baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --json`, with the complete current violations as rule, path and key objects whose keys stay stable when lines move.
Keep native execution failures out of the violation list, because unavailable analysis cannot establish an empty one.
The checker rejects new violations and entries whose violations were fixed.
Prepare baseline changes in scratch and validate them in a disposable repo copy containing the proposed rules and baseline, never by refreshing the target baseline.
Remove fixed entries from the candidate and add only entries covered by selected unresolved debt findings with matching rule, path and key identities.
Run the native check or `baseline check` without `--refresh` against that copy with the complete current violations, then include the complete baseline content as one edit in the reviewed `apply` plan.
Use the same reviewed-write path for a new baseline and for native baseline or suppression configuration.
Every entry records a reason, narrow scope and removal condition.
Never silently refresh a baseline to accept new failures, and never disable a whole rule or exclude a whole directory to obtain green.
A changed-file-only check cannot establish a constraint that depends on the complete import graph or generated outputs.

Done when: Every selected rule has a passing proof or is reported unproven with its coverage limits, existing violations are in a visible shrinking baseline, and no whole rule or directory is disabled to obtain green.
