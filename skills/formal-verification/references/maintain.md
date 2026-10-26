# Maintain a formal verification suite

Use this reference to keep an applied suite true as the code changes.
Maintain runs on demand, for example before a release or after a large refactor of code with a proven property.
It is the full pass over every property; the upkeep that the coverage gate and the maintained check command supply on every change covers only the properties a change touched.

## Contents

- [Passes](#passes)
- [Audit trailer claims](#audit-trailer-claims)
- [Replay before triage](#replay-before-triage)
- [Triage](#triage)
- [Correct the suite](#correct-the-suite)
- [Move the sync commit](#move-the-sync-commit)
- [Outcomes](#outcomes)

## Passes

Run the passes in this order.
The drift check must report no problems other than `source-changed-since-sync` and `sync-commit-missing` before source reading and rerun can proceed; those two problems remain for the final sync commit step.

| Pass | What it establishes | How |
|---|---|---|
| Drift check | The suite files are exactly what `suite.json` renders, each transition table matches the plan, every property file has its `Source paths:` line, no file lists a property the plan lacks, the `AGENTS.md` pointer exists, each source path still matches a file, each cited code step and design section still resolves, the pinned tool file has the pinned sha256 and each property's source paths are unchanged since its sync commit | `formal check --suite <name>`; one problem per finding |
| Source reading | Each property file and its table still describe what the code does, and each `No-proof-impact` claim since the sync commit holds against the model | One read-only reader per property where the host supports subagents, otherwise one property at a time in the main thread |
| Rerun | Every property still holds within its bounds, and its violation diagnostic appears only on a real violation | The property's check command, exactly as the suite shows it |

`formal check` compares the suite with what its own plan renders and with the repo.
It does not judge whether a model is true; that is what the readers and the rerun are for.
A missing tool is reported as unproven, and the passes that need it are blocked, never skipped as passing.

Give each source reader its property file, the transition table, the declared source paths and the diff since the property's sync commit, `git diff <sync commit> HEAD -- <source paths>`.
When the sync commit is absent or orphaned, `formal check` names the commit it fell back to, the last commit that changed the suite, and the reader takes the diff from that one.
A reader reports, with file and line evidence, each place where the code and the table disagree: a split or merged step, a reordered step, a removed check, a new write to the shared state, or code that moved outside the declared source paths.
A reader also looks for code that moved: a covered function that was renamed, split or moved to another file is still covered code, even when its new place is outside the declared source paths.
A reader also looks for new writers of the state the property guards, such as a new function that writes the same fields, wherever it lives in the repo.
The source-path diff cannot show either, so the reader also takes the repo-wide `git diff -M -C --stat <sync commit> HEAD` and searches the repo for the names the model's guarded state and its cited functions have in the code.
A reader never edits and never runs the tool.

## Audit trailer claims

The coverage gate lets a change to a source path through when its commit message says `No-proof-impact: <id>: <reason>`.
The message is a claim, not evidence, so check each such trailer for the property it names against the model.

1. List the trailers: `git log <sync commit>..HEAD --format=%H%n%B`, taking the commit from the fallback when the sync commit is absent or orphaned, and keep each commit whose message has a `No-proof-impact: <id>: <reason>` line for the property.
2. Read that commit's repo-wide diff: `git show -M -C <commit>`. Follow covered functions and their helpers that were renamed, split or moved, and writers of the guarded state, including outside the declared source paths; inspect the relevant code at that commit and its parent.
3. For each relevant edit found across those paths, ask whether it changes the behaviour of a cited code step, a branch or check the model encodes, or a bound or assumption. Judge its meaning from the model and the table, not from the reason in the message; touching modeled code alone does not establish proof impact.
4. A commit that preserves all modeled behaviour, bounds and assumptions holds the claim, including whitespace or other edits that preserve their meaning: record it as audited with the commit and the evidence for that verdict.
5. A commit that changes modeled behaviour, bounds or assumptions breaks the claim. The model no longer describes the code, so triage it as model drift with the commit and the semantic change as evidence, even if the rerun still passes.

Give the trailer's reason no weight in step 3.
A wrong claim is the cheapest way for a model to go stale while the check keeps passing.

## Replay before triage

Run this for every property whose check command reports its violation diagnostic, before sorting it into a class.
It also applies to a failure that first appears after a correction, which returns to this replay.
A broken trailer claim and a failure that the same commit causes are separate problems, each with its own class.

1. Get the counterexample: the trace the tool printed for the property, in order.
2. Walk it one step at a time. Look each step up in the transition table, open the code step it cites at `HEAD`, and ask whether that actor can do that step there, in that order, from the state the previous step left.
3. A step that cannot happen in the code means the model is wrong, not the code. Open the same cited step at the property's sync commit, or the fallback commit when it is absent or orphaned: if it could happen there, a later change removed or reshaped it, and this is model drift. If it could not happen then either, this is a modeling error.
4. A trace whose every step can happen is a real bug. Name the commit that made the complete failing sequence reachable, extending the search before the sync commit when necessary, including when a modeling correction exposes an older product bug. Use repo-wide history, such as `git log -S <the changed code>`, to find candidates, then replay the complete sequence against each candidate and its parent to establish the introducing commit; the last step may be unchanged, and a later move or correction can make `git blame` name the wrong commit.
5. When the replay is unclear, such as a step that depends on a documented atomicity assumption, decide from an agreed source, as Triage says. The replay narrows the question, and the agreed source stays the tie-breaker.

Tell the counterexample in the code's words, one step per line, in the report.
A scratch reproduction of a real bug, such as a test or a short script run against the real code, is evidence for the report.
Keep it in scratch and never commit it to product code.

## Triage

Sort each problem from the passes, and each failure that the replay classed, into exactly one class.

| Class | Evidence | Action |
|---|---|---|
| Model drift | The code changed on purpose and the model, table or source paths no longer describe it | Correct the suite through a reviewed change set, then re-prove |
| Modeling error | The tool rejects the model itself, such as a branch that leaves a variable unassigned, or replay finds a step impossible in the code both now and at sync (or the fallback commit), even with a violation diagnostic | Correct the model through a reviewed change set, never report it as a finding |
| Real bug | The model matches the code and the property is violated against an agreed source | Report it with the counterexample in the code's words and the commit that made the complete failing sequence reachable, even before sync, and change no product code |
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
This intermediate check must report no problems other than `source-changed-since-sync` and `sync-commit-missing`; resolve any other problem before proceeding to the final sync commit step, whose proposed-commit check must report no problems at all.

Add or remove a property by editing the plan's `properties`, and keep each property's `sourcePaths` narrow and true, because the coverage gate reads them.
A repin of the tool is a plan change: record the new file's sha256 and version only after the user has approved the new file.

## Move the sync commit

Each property records in `syncCommit` the commit at which it was last confirmed to describe the code at its source paths, and the property file shows it as `Synced at: <sha>`.
`formal check` reports two problems about it, and both route here.

| Problem | Meaning |
|---|---|
| `source-changed-since-sync` | The property's source paths differ between its sync commit and `HEAD`; a change that already reached the base branch causes it, and neither the coverage gate nor the model check notices it |
| `sync-commit-missing` | The property records no sync commit, as in a suite applied before the field existed, or the commit is no longer in the repo, as after a rebase or squash; drift is then checked from the last commit that changed the suite, and the problem says so |

Neither problem fails the project's maintained check command, which keeps the gate's per-change meaning.
The sync commit records that someone confirmed the property, so moving it is never a way to clear drift: it moves only at the end of a pass that confirmed every property.

Move it only when all of these hold.

- Every problem other than `source-changed-since-sync` and `sync-commit-missing` is gone.
- Every property the diff since its sync commit touched was re-proved; a property that fails on the corrected model is a real bug and is not re-proved.
- No check is blocked, such as a missing tool or a property that cannot run.
- The source paths have no uncommitted change, so `HEAD` is the code that was checked.

Then propose `git rev-parse HEAD` as the new sync commit and run `formal check --suite <name> --sync-commit <sha>`, which checks every property against that commit in place of the recorded ones.
Record it only when that rerun reports no problems at all; a commit from before a source change reports `source-changed-since-sync` again, so a stale or wrong commit cannot be recorded.
Recording it is a plan change: set `syncCommit` on each property in the scratch copy of the plan, run `formal scaffold --update`, apply the unchanged change set after the user approves those bytes, and run `formal check` again without the flag.
The `Synced at:` line is neither a source path nor a model file, so changing it alone never satisfies the coverage gate.
When any condition fails, leave the recorded sync commit where it is and say why in the report.

## Outcomes

Report exactly one outcome.

- **Clean.** `formal check` passes, every property reran within its bounds, no reader found a disagreement and no sync commit needed to move.
- **Changed.** A reviewed change set was applied and its verification passed; list the applied files, the class of each correction, every property re-proved and whether the sync commit moved.
- **Blocked.** A named prerequisite stopped a pass, such as a missing tool or runtime or a property that cannot run; state what was and was not covered.

A correction can bring a real bug to light: the corrected model describes the code again and then the property fails on it.
That is one **Changed** report that lists the applied correction and the real bug together, each with its own evidence.

Report a property that passed in the rerun before any correction and fails after one as an old pass on a stale description.
Say that the earlier pass checked a model that no longer described the code, so it was not evidence about the code, and name the correction that exposed it.

Report real bugs and unproven properties beside the outcome, never inside a "clean".
Report each audited trailer with its commit, whether the claim held and the evidence about modeled behaviour, bounds and assumptions.
For each real bug, name the commit that made the complete failing sequence reachable, even when it predates sync.
Maintain never fixes product code and never opens a pull request.
