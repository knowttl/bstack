# Maintain a verification kit

Use this reference to keep an applied kit true as the product changes.
Maintain runs on demand, for example before a release.
It is the full pass over every feature; the per-change upkeep that no-mistakes supplies covers only the features a change touched.

## Contents

- [Passes](#passes)
- [Triage](#triage)
- [Correct the kit](#correct-the-kit)
- [Repeated mistakes](#repeated-mistakes)
- [Outcomes](#outcomes)

## Passes

Run the passes in this order; a later pass is meaningless on a kit the earlier one has flagged.

| Pass | What it establishes | How |
|---|---|---|
| Index hygiene | The kit files are exactly what `kit.json` renders, every feature has one file, no file lists a feature the plan lacks, the `AGENTS.md` pointer exists and every declared source path still matches a file | `kit check --app <app>`; one problem per finding |
| Source reading | Each feature file still describes what the code does | One read-only reader per feature where the host supports subagents, otherwise one feature at a time in the main thread |
| Live pass | Every feature still works as its file says | `kit prove --app <app> --feature <id>` for each feature in `kit.json`, one at a time |

`kit check` compares the kit with what its own plan renders and with the repo's file list.
It does not judge whether a feature file is true; that is what the readers and the live pass are for.

Give each source reader only its feature file, the feature's declared source paths and the sub-feature IDs.
A reader reports, with file and line evidence, each place where the code and the feature file disagree: a changed entry point, a removed or renamed sub-feature, a new user-visible behaviour the file does not mention, a changed handle or output the steps match on, or source that moved outside the declared paths.
A reader never edits and never runs the product.

Run the live pass sequentially, because every proof binds its own free port and run directory but a shared external dependency may not tolerate parallel drivers.
Report any feature that cannot be reached with the attempted command and the unmet precondition; never count a skipped feature as verified through another path.

## Triage

Sort each discrepancy from the three passes into exactly one class.

| Class | Evidence | Action |
|---|---|---|
| Doc drift | The product behaves correctly and the kit text, source paths or sub-features are out of date | Correct the kit through a reviewed change set |
| Harness gap | The kit's command, match or setup is wrong, flaky or missing a precondition, while the product behaves as a user would expect | Correct the kit through a reviewed change set, then re-drive the feature |
| Product bug | The product misbehaves against an agreed source | Report it with the failing command and evidence; never weaken a step or a match to hide it |

When a failure could be either a harness gap or a product bug, decide from an agreed source such as the documentation, a test written from the design or the user, not from the product's current output.
Ask the user when no agreed source exists.

## Correct the kit

Corrections go through the same reviewed boundary as creation.
Edit a copy of the kit plan in scratch, starting from the applied `kit.json`, so the plan stays the single source for every rendered file.
Run `kit scaffold --repo <target> --plan <file> --update --json`, present its exact diff with `apply --dry-run`, and apply the unchanged change set only after the user approves those bytes.
`--update` replaces files that differ from the plan, creates missing ones and deletes feature files the plan no longer lists.
It proposes nothing when the kit already matches the plan.
Never edit a rendered file by hand: the next `kit check` reports it as drift.
After applying, run `kit check` again and `kit prove` for every feature whose steps, entry points or source paths changed.

Add or remove a feature by editing the plan's `features`, and keep each feature's `sourcePaths` narrow and true, because the coverage gate reads them.
Set `coverageGate` to `true` to render the gate script into the kit; the no-mistakes wiring reference explains how it is wired.

## Repeated mistakes

Read the project's recent no-mistakes findings and review comments, where the host and the user make them available.
Group findings that recur, and for each group name the evidence and the rung of the constraint ladder it currently sits on.
Propose moving each group down one rung of the constraint ladder, using the constraint reference: a type or schema first, then a proven lint rule, then an instruction, with review as the last resort.
Propose the move as a selected change with its problem, consequence, fix, scope and verification; do not widen scope silently.

## Outcomes

Report exactly one outcome.

- **Clean.** `kit check` passes, every feature proved and no reader found a disagreement.
- **Changed.** A reviewed change set was applied and its verification passed; list the applied files, the triage class of each correction and every feature re-driven.
- **Blocked.** A named prerequisite stopped a pass, such as a product that no longer starts, missing credentials or a feature that cannot be reached; state what was and was not covered.

Report product bugs and unproven features beside the outcome, never inside a "clean".
Maintain never fixes product code and never opens a pull request.
