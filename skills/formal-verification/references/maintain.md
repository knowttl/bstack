# Maintain a formal verification suite

Use this reference to keep an applied suite true as the code changes.
Maintain runs on demand, for example before a release or after a large refactor of code with a proven property.
It is the full pass over every property; the upkeep that the coverage gate and the maintained check command supply on every change covers only the properties a change touched.

## Contents

- [Passes](#passes)
- [Triage](#triage)
- [Correct the suite](#correct-the-suite)
- [Outcomes](#outcomes)

## Passes

Run the passes in this order; a later pass is meaningless on a suite the earlier one has flagged.

| Pass | What it establishes | How |
|---|---|---|
| Drift check | The suite files are exactly what `suite.json` renders, each transition table matches the plan, every property file has its `Source paths:` line, no file lists a property the plan lacks, the `AGENTS.md` pointer exists, each source path still matches a file, each cited code step and design section still resolves and the pinned tool file has the pinned sha256 | `formal check --suite <name>`; one problem per finding |
| Source reading | Each property file and its table still describe what the code does | One read-only reader per property where the host supports subagents, otherwise one property at a time in the main thread |
| Rerun | Every property still holds within its bounds, and its violation diagnostic appears only on a real violation | The property's check command, exactly as the suite shows it |

`formal check` compares the suite with what its own plan renders and with the repo.
It does not judge whether a model is true; that is what the readers and the rerun are for.
A missing tool is reported as unproven, and the passes that need it are blocked, never skipped as passing.

Give each source reader only its property file, the transition table and the declared source paths.
A reader reports, with file and line evidence, each place where the code and the table disagree: a split or merged step, a reordered step, a removed check, a new write to the shared state, or code that moved outside the declared source paths.
A reader never edits and never runs the tool.

## Triage

Sort each problem from the passes into exactly one class.

| Class | Evidence | Action |
|---|---|---|
| Model drift | The code changed on purpose and the model, table or source paths no longer describe it | Correct the suite through a reviewed change set, then re-prove |
| Modeling error | The tool rejects the model itself, such as a branch that leaves a variable unassigned, with no violation diagnostic | Correct the model through a reviewed change set, never report it as a finding |
| Real bug | The model matches the code and the property is violated against an agreed source | Report it with the counterexample in the code's words, and change no product code |
| Harness gap | The check command, the tool pin or a path is wrong, flaky or missing a precondition while the model and the code agree | Correct the suite through a reviewed change set, then rerun |

When a failure could be a modeling error or a real bug, decide from an agreed source, such as the design section the property cites or the user, not from the code's current behaviour.
Ask the user when no agreed source exists.
Never weaken a property, a bound or an assumption to turn a finding into a pass.

## Correct the suite

Corrections go through the same reviewed boundary as creation.
Edit a copy of the suite plan in scratch, starting from the applied `suite.json`, so the plan stays the single source for every rendered file.
Run `formal scaffold --repo <target> --plan <file> --update --json`, present its exact diff with `apply --dry-run`, and apply the unchanged change set only after the user approves those bytes.
Never edit a rendered file by hand: the next `formal check` reports it as drift.
After applying, run `formal check` again and every changed property, then prove each changed property can still fail as the create guide describes.

Add or remove a property by editing the plan's `properties`, and keep each property's `sourcePaths` narrow and true, because the coverage gate reads them.
A repin of the tool is a plan change: record the new file's sha256 and version only after the user has approved the new file.

## Outcomes

Report exactly one outcome.

- **Clean.** `formal check` passes, every property reran within its bounds and no reader found a disagreement.
- **Changed.** A reviewed change set was applied and its verification passed; list the applied files, the class of each correction and every property re-proved.
- **Blocked.** A named prerequisite stopped a pass, such as a missing tool or runtime or a property that cannot run; state what was and was not covered.

Report real bugs and unproven properties beside the outcome, never inside a "clean".
Maintain never fixes product code and never opens a pull request.
