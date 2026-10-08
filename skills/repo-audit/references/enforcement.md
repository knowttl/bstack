# Enforcement

Use this reference when recommending principles and their checks.
Start from the project's requirements, approved design and observed risks.
These examples are candidates, not defaults.
Checks catch defined mistakes, not every unsound future design decision.

## Contents

- [Record each principle](#record-each-principle)
- [Example mappings](#example-mappings)
- [Proof required before adopting an automated rule](#proof-required-before-adopting-an-automated-rule)
- [Integrate the maintained command](#integrate-the-maintained-command)
- [Control existing debt](#control-existing-debt)
- [One authoritative source per rule](#one-authoritative-source-per-rule)

## Record each principle

| Field | Required evidence |
|---|---|
| Reason | The project-specific risk or approved requirement, with a useful example |
| Scope | The packages, modules or public boundaries the rule governs |
| Source | The existing authoritative document or executable configuration and its exact locator |
| Enforcement | The concrete constraint, selected check or human review, and expected outcome |
| Exception policy | The reason, narrow scope and removal condition for an exception, or why none is allowed |

Inventory design documents, contribution guidance, scoped agent instructions and native checks before proposing a new rule.
Reuse the formatter, linter, type system or test framework already present when it expresses the required constraint reliably.
The language research brief selects any missing native capability for this project.
Use parsing or dependency analysis for semantic code rules rather than fragile text matching.
Propose a custom checker only when existing tools cannot express the constraint reliably.
Separate formatting from design checks so cosmetic changes cannot conceal an architectural failure.
Avoid arbitrary file, function or rule-count limits without a project-specific reason.

## Example mappings

| Principle | Concrete rule | Enforcement | Required evidence |
|---|---|---|---|
| Keep persistence behind one interface | UI modules cannot import the database adapter | Import boundary analysis resolving project paths and aliases | An allowed public interface import passes and a direct database import fails |
| Write each rule once | Generated settings match the authoritative source | Deterministic regeneration and comparison | A stale generated value fails |
| Validate external input | Reject invalid input at the actual public boundary | Behaviour tests and applicable schema or type checks | Invalid input is rejected and valid input succeeds |
| Keep behaviour stable during cleanup | Existing supported journeys remain compatible | Relevant integration or end-to-end checks | The same supported journeys pass before and after the change |
| Keep dependencies purposeful | New abstractions serve a current use and a clear responsibility | Human design review against vision and technical design | Review identifies the requirement, responsibility and simpler alternative |

Do not disguise a human design judgement as a deterministic violation.
Give the reviewer the relevant authority, example and evidence instead.

## Proof required before adopting an automated rule

Require a representative valid case and a deliberate violation in disposable fixtures.
The valid case must pass.
The violation must fail with the expected diagnostic and exit code.
The clean project must pass the selected final checks.
Use the selected tool's native rule-testing mechanism where available.
Include relevant syntax, aliases, re-exports, generated code and documented exceptions in the proof scope.
Record unsupported syntax and dynamic dependencies as coverage limits rather than assuming they pass.

After preparing native dependencies in the clean and independently seeded fixtures, run `rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json`.
The plan follows `schemas/check-plan.json`; the selected check supplies the native child-command object.
The command runs separate disposable copies, records versions, exits and diagnostics in scratch, and removes the copies.
Repeat for each private import, alias or equivalent resolution bypass and forbidden cycle, retaining public imports and permitted dependency direction in the clean control.
Unavailable native tools, interrupted execution and failed clean setup are blocked, never proof.

Capture the maintained command, tool version, output, exit code and relevant input state directly from execution.
The same maintained command must work locally and in the project's CI when the project selects one, without ignoring failures.
For behaviour compatibility, preserve agreed acceptance outcomes rather than proving only that unit checks are green.
These are evidence requirements for selected enforcement, not a development workflow.
Maintenance validation remains Phase 3a work.

## Integrate the maintained command

Use reviewed selected findings and `apply` to extend the project's existing check command rather than creating a competing entry point.
The target repo owns each checker or pins its declared development dependency; running checks must not require an installed bstack skill or agent session.
Scope each package rule in its native configuration or checker, and prove a sibling package's permitted use remains valid.
Apply the complete initial documented baseline through selected debt findings before expecting the audited project to pass.
Keep every known violation visible with its reason and removal condition; new violations fail and fixed entries must be removed.
Continue to prove each rule independently on clean fixtures without counting unrelated audited debt as new violations.

For integration proof, select the maintained command in the check plan, for example executable `npm`, args `["run", "check"]`, cwd `.` and versionArgs `["--version"]`.
Run the same rule-proof interface against separate disposable sources containing the integrated command, installed native dependencies and the accepted baseline, with one new seeded violation in the negative source.
Capture both exits and the specific new diagnostic; a tool setup failure does not prove enforcement.
The valid control must include a permitted sibling-package use where package scope matters.

Mark each integration edit's selected command paths with `checkIntegration`, such as `[["scripts", "check"]]` for the maintained package script.
Only those selected commands use the bounded failure-preserving grammar described in the command contract; unrelated reviewed edits and sibling commands retain their ordinary validation.
Use simple commands joined with `&&`; failure-masking shell operators and failure-tolerant CI settings are rejected before writes.
Selected arguments must not contain shell control syntax or substitutions, even when quoted or escaped; known shell-dispatch modes such as npm `--call` are unsupported.
The validator is bounded rather than a complete shell interpreter; the identical maintained-command disposable controls remain the enforcement proof.
If the project selects CI, apply the same maintained command to its configuration as another reviewed edit using JSON syntax, which is valid YAML.
Mark its exact `run` or `script` paths, such as `[["jobs", "check", "steps", "0", "run"]]`; the installed runtime does not parse general YAML.
CI examples are unverified adapters until actual hosted execution is observed; local disposable proof does not establish a merge gate.

## Control existing debt

Fix selected findings and keep the remaining findings visible.
When immediate cleanup is unsuitable, propose a narrow record of known violations for the user to accept as temporary debt.
Prefer the native tool's baseline or suppression mechanism where it exists.
New violations must fail, and fixed entries must leave the debt record so it shrinks as fixes land.
Do not silently refresh a baseline to accept new failures.
An exception must record its reason, scope and removal condition.
Never disable a whole rule or exclude a whole directory merely to obtain a green result.
A changed-file-only check cannot establish a constraint that depends on the complete import graph or generated outputs.

Where native research found no baseline feature, use `schemas/baseline.schema.json` and `baseline check --repo <target> --baseline <repo-relative-file> --violations <file> --json`.
Supply the complete current native violations as rule/path/key objects, preserving stable identities when lines move.
Keep native execution failures separate from the violation list; unavailable analysis cannot establish an empty list.
Checking reports retained debt and rejects new violations or entries whose violations were fixed.
`--refresh` removes fixed entries but cannot accept new debt by itself.
Adding one current violation requires `--refresh --finding <id> --findings <file> --entry <file>` for a selected unresolved debt finding covering that path, with a narrow reason and removal condition.
A failed refresh changes no baseline bytes.

## One authoritative source per rule

Preserve an existing standards source that already serves reviewers.
Missing `CODING_STANDARDS.md` is not a readiness failure.
Create that document only when non-mechanical review rules need a distinct maintained home.
An existing design section can suffice for a small project.
Keep review standards actionable and scoped, with a reason, example and exception policy where needed.

Tool configurations own formatting values and executable constraints.
Standards link to those checks rather than copying settings.
Agent instructions point to the relevant documents and commands while preserving distinct scopes.
If a selected edit moves a review rule, replace its old text with a link to the new authority.
Design documents may explain the structural decision without maintaining a second copy of the standard.
Read relevant existing decisions before proposing a conflicting rule.
Keep proposals as drafts until selected and preserve review before apply for documentation as well as code.
