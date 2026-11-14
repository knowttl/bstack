## Standalone checker execution

```sh
node .bstack/bin/bstack-check.mjs --repo <path> --base <ancestor-commit> --assessment <file> [--contract <repo-relative-file>] [--json]
```

Node 24 and Git are required; the installed file needs no dependencies, skill installation or agent session.
The caller selects every input explicitly; the assessment path is caller-relative and the contract defaults to `.bstack/project.json`.
The result uses the shared exit codes: 0 passed, 1 failed, 2 blocked and 3 usage error.

Preflight validates the live inventory, previous/proposed contracts, substantive assessments, source citations, review fingerprint, document references and generated facts.
It inspects package script dependencies and every required previous/proposed leaf for cycles and obvious aggregate recursion before executing leaves.
Generated-fact commands retain their existing read-only contract.
Each distinct required leaf command runs once across the comparison and current invocation, with its declared version probe and normal timeout/cancellation handling.
Identical commands share that execution while retaining each previous/proposed declaration's coverage obligation.
Result validation uses only these current executions, never saved `execution` references in the assessment.
Final validation rechecks committed assessment bytes, document references and generated facts under both policies against the target tree, including ignored link destinations and generator inputs, outputs and command sources.
Results retain the [document reference coverage limits](#document-references) observed under either policy, including comparison and final validation results.
Changed review inputs block final validation, and failed or incomplete required executions cannot pass.
The leaf phase writes a fresh scratch `checker-result.json` containing source and base objects, their computed merge base, timestamps and captured command results, including failures.
Execution and final-validation exceptions retain results from already completed leaves.
The selected ancestor policy requires that merge base to equal the assessment's comparison object.
The checker never edits the assessment.
Opaque leaf programs retain the existing review boundary: only supported direct invocations and package aliases are inspected for recursion.

### Portable committed review

Commit implementation changes before collecting portable review:

```sh
node skills/maintenance/scripts/maintenance.mjs evidence collect --repo <target> --base <ancestor-commit> --portable .bstack/assessment.json --json
```

Copy the returned skeleton to the explicitly selected repo-relative assessment path and complete its substantive claims through the selected review process.
Then validate the completed record:

```sh
node skills/maintenance/scripts/maintenance.mjs evidence validate --repo <target> --base <ancestor-commit> --assessment <target>/.bstack/assessment.json --json
```

Validation returns the fingerprint to record after review, even while leaf execution is still missing.
Commit the completed, bound assessment separately and run the installed aggregate.
Portable records use `repo: "."` and retain the reviewed implementation commit in `head`.
That commit must be an ancestor of submitted HEAD, with no subsequent source changes except the selected assessment itself.
Portable inventory omits that record's own path, and portable fingerprints replace absolute roots with `.` and normalize modes to executable bits.
Collection, validation and committed blob lookup use the same physical repository and assessment identity for containment checks and inventory exclusion.
Collection resolves an absent planned assessment path through its existing parent directories.
The record's substantive claims are still hashed; this narrow self-exclusion avoids making its own commit or serialized hash self-referential.
Renaming the selected record together with a source path is unsupported.
The aggregate requires the selected file's bytes to match its committed HEAD blob.
Local records retain absolute-root and live-HEAD behavior and cannot claim portable clean-checkout evidence.
Neither format authenticates semantic review or owner approval.

Clone into a different root, use a fresh isolated home and cache with no installed repo-audit skill, and pass the same base and committed record explicitly.
No earlier cache entry or leaf success can satisfy that clone's current run.
Missing assessment files and missing comparison objects block rather than producing an empty diff.
A shallow checkout missing its base reports the required fetch:

```sh
git fetch --unshallow origin
git fetch origin <required-base-commit>
```

For a full clone with a missing object, fetch the required commit explicitly.
After rebasing or changing the agreed base, recollect, review, bind and commit the assessment again.
`--base empty` remains supported only before a repository's first commit, using an explicitly selected initial foundation assessment.

### Docs-only mode

```sh
node .bstack/bin/bstack-check.mjs --repo <path> --docs-only [--contract <repo-relative-file>] [--json]
```

`--docs-only` runs `docs check`, the `docs generate --check` comparison and the instruction growth check on the current tree and nothing else, so it takes no base or assessment and starts no leaf command.
Supplying `--base`, `--assessment` or `--workspace` with it is a usage error (exit 3, problem code `docs-only-input`).
When the contract records `instructions.baseline`, the check measures the loaded instructions as `instructions measure` does, applying `instructions.exclude`, and fails with `instructions-grew` when the total bytes exceed `baseline.bytes`.
A change that needs more instructions raises `baseline.bytes` and replaces `baseline.reason` in the same change, and a baseline without a nonblank reason is a schema violation.
The checker compares the selected contract with the same path at `origin/main` and reports `instructions-baseline-reason` when bytes increase without a changed reason or with `Measured when registered` as the new reason.
If `origin/main` or the selected prior contract cannot be read, a current baseline or any loaded instruction bytes fail with `prior-unavailable-fetch-the-ref`, regardless of reason, because the prior baseline cannot be verified.
If a readable prior contract has no baseline, first registration may use the initial reason.
If the prior contract has a baseline, removing it fails with `instructions-baseline-removed`; a readable prior contract without a baseline permits a contract without a baseline.
The full checker does not run the instruction check.
Results use the shared exit codes: 0 when links, supported glossary structures and generated sections are current and instructions are within the baseline, 1 for a broken link, invalid or duplicate glossary entry, stale generated section, grown instructions, a removed baseline or an increased baseline without a new reason, and 2 when the contract or a registered source cannot be read.
It is the command of the no-mistakes docs gate that the [maintenance skill](../skills/maintenance/SKILL.md) wires.

### Previous-policy execution

When a change modifies the installed checker or either contract location, the aggregate extracts the base's `.bstack/bin/bstack-check.mjs` to scratch and invokes its exported `runChecker` against the proposed target and selected assessment before its current leaf phase.
It does not recurse into another comparison invocation; command reuse follows the leaf execution rules above.
The explicit assessment carries the reconciled `previousContract` path, including custom prior authority.
Previous scopes and required checks remain obligations when the proposed policy removes them.
A deleted prior config without a clear Git rename stays blocked for reconciliation, including when a replacement checker would return success.
For independently selected delivery checks, extract and run the prior file directly with the same explicit inputs as well.
An absent or incompatible prior checker blocks for a recorded migration decision and explicit prior coverage; this slice does not silently waive that prerequisite.
A selected first-installation foundation with no previous policy has no prior checker to execute.
The delivery process must actually invoke these checks; changed scripts can omit their own checker, so forge enforcement and hosted CI behavior remain unverified.

The production interface is `node skills/<skill>/scripts/<skill>.mjs <command> [options]`; repo-audit ships only `inspect`, `inventory`, `history`, `cite-check` and the `contract-test` dispatch harness, and each other command ships with the skills that list it in `runtime/skills.json`.
Resource paths are relative to the installed skill, never the caller's current directory.
Command-specific options and input formats belong to their owning tasks and command help.
C4a establishes arguments, targets, paths, scratch and results.
C4c adds command dispatch and the explicitly supported schema subset.
