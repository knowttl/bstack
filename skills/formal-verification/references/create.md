# Create a formal verification suite

Use this reference to choose a target, write the suite plan, prove the suite and propose its upkeep.
The suite is written for the next agent, which reads it cold, mid-change, without having seen your work.
A reader must be able to trust the result and act on it without learning the verification language.

## Contents

- [Choose the target](#choose-the-target)
- [Interview the repo](#interview-the-repo)
- [State the property](#state-the-property)
- [Write the suite plan](#write-the-suite-plan)
- [What scaffold generates](#what-scaffold-generates)
- [Prove it can fail](#prove-it-can-fail)
- [Propose the wiring](#propose-the-wiring)

## Choose the target

A good target is a promise the code makes, where a break harms users and tests rarely reach the case that breaks it.
Choose the strongest such target in the repo, not the one that is easiest to verify.

| Signal | Why it suits a formal check |
|---|---|
| Money or data changes hands, and a repeat or a lost step is costly | The harm is concrete and a counterexample is easy to explain |
| Retries, queues, locks, background jobs or two writers of one record | The bad outcome needs one unlucky order of steps that tests rarely produce |
| A multi-step flow with states, such as sign-up, checkout or a job lifecycle | The states and the allowed moves can be listed and checked in every order |
| A parser, a decoder or unsafe code on untrusted input | The bad outcome needs a rare input, and a bound on input size is enough |

Skip ordinary screens, forms and CRUD code, and skip a spot where a unit test already pins the whole behaviour.
Prefer a spot whose steps are few: a model of two to four actions that the code visibly makes is worth more than a large model nobody can map to the code.

When the same state is held in scattered booleans or phases, the stronger fix is often a state machine that makes the bad state impossible to represent.
Report that for `/architecture` as evidence, and still verify the property that stands today.

## Interview the repo

Answer each question from the codebase and ask the user only what the repo cannot show.

| Question | Where to look |
|---|---|
| Which promise matters most, and what is the harm of breaking it? | The design section the property guards, the README, support issues, past incidents and fix commits |
| Which steps make up the behaviour, and which of them is one indivisible call? | The functions on the path, the store, queue or gateway calls and their documentation |
| What is shared between concurrent callers? | Database rows, caches, files, in-memory maps, external services |
| Which tool can the project run? | Existing tool versions, a Java or Rust toolchain in the manifests, the maintained check command |
| What is the cost of a rerun? | Whether a check of about a minute or less is realistic for this model |

Cite each answer with file and line.
A claim that cites nothing is not evidence: drop it or say what could not be read.

## State the property

State the property in one plain sentence and the harm in one plain sentence, in this repo's nouns.
Examples: "However two workers interleave, an order is charged at most once." and "A customer is charged twice for one order."
A property of the form "something bad never happens" is checkable; a property of the form "it works" is not.
Write one property per create run.

## Write the suite plan

The plan follows `schemas/formal-plan.json` and is the single source for every generated file.
Every command is an argument array run without a shell, so quote nothing and expand nothing.

| Field | What it holds |
|---|---|
| `target` | The name of the spot, which becomes the `formal-<target>` folder |
| `tool` | The tool name, the repo-relative path of the pinned file, its sha256 and its version output; `formal check` compares the file with this pin |
| `evidenceDirectory` | A directory outside the suite for the tool's working files and results, ignored by version control |
| `properties[].design` | The design section the property guards, as a `path:line` location with the SHA-256 of the exact bytes read |
| `properties[].sourcePaths` | The repo paths whose change can invalidate the model, as paths or `**` globs; the coverage gate reads them, so keep them narrow and true |
| `properties[].bounds` and `assumptions` | The size the check covers, such as two workers and one order, and each fact trusted without proof, such as an atomic store call |
| `properties[].check` | The command that runs the model check from the repo root, and the diagnostic text that proves a violation |
| `properties[].modelFiles` | The model and its configuration, each written under the suite's `model/` folder |
| `properties[].steps` | The transition table: one row per model action, naming the one atomic code step it stands for as `path:line` and why that step is atomic |

Each model action stands for one code step the code cannot be interrupted in.
If two code lines are separated by an interruption point, such as a read and a later write, they are two actions.
The model's own comments name the code line each action stands for, and the table repeats them in a form `formal check` can render and compare.
Model only the steps the property depends on, and use names from this repo.

Direct the tool's working files to the evidence directory, never into the suite, and write the check command so a violation prints its counterexample without leaving files beside the model.

## What scaffold generates

`formal scaffold` renders `.agents/skills/formal-<target>/` from the plan and shows the exact diff.

| File | Content |
|---|---|
| `SKILL.md` | The properties, the pinned tool and how to confirm it, the run commands, how to read the result, how to keep the model true and the honest limits |
| `suite.json` | The plan, so the next maintain pass starts from it |
| `properties/<id>.md` | The property, harm, source paths, design citation, model files, check, bounds, assumptions and the rendered transition table |
| `model/` | The model files |
| `map-coverage.mjs` under `scripts/` | The coverage gate, which needs no bstack |

It also adds a `.claude/skills/formal-<target>/SKILL.md` pointer and one `AGENTS.md` pointer line.
Never edit a rendered file by hand: the next `formal check` reports it as drift, and the transition table is checked apart from the rest of the file.

## Prove it can fail

A check that has never been seen failing proves nothing.
Prove it twice, in scratch, and keep every product file as it was.

1. Mechanical proof with the unchanged `rule-proof` command.
   Write a check plan in scratch following `schemas/check-plan.json` with one check of role `protection` that runs the property's check command, with the tool's own version arguments and a timeout that fits the model.
   Prepare a clean copy of the repo and a broken copy in which the code and its model are both changed the way a real mistake would change them, such as a read and a write split apart, and put the pinned tool at its path in each.
   Run `rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <clean copy> --violation <broken copy> --expect '<violation diagnostic>'`.
   The clean copy must exit 0 and the broken copy must exit nonzero with the diagnostic.
   The proof records the version of the executable it ran, so it names the runtime and nothing identifies the model checker; the pinned hash in the suite is what identifies the tool.
   A nonzero exit without the diagnostic is a modeling error, not a violation, and the proof fails on it.
2. Walkthrough on the real code, in a disposable copy of the repo.
   Follow the generated suite as the next agent would.
   Break the real code at a declared source path in a way that violates the property.
   Run the suite's coverage gate and confirm it flags the changed source path, because a model checker alone cannot see a code change.
   Update the model and its table to match the break, run the check and confirm it fails with the diagnostic.
   Restore the code and the model, run the check again and confirm the result is the one the current code gave before.
   If the gate misses the break, the model check passes on the broken code or a step does not run, fix the suite, not the scratch break.

A suite whose proof or walkthrough could not run is a draft.
Report each such step as unproven with its blocker, such as a missing runtime or tool.

## Propose the wiring

Upkeep is automatic on every change and setup is manual, as the verification kit already splits them.

- Put the property check inside the project's one maintained check command, so a violation fails the command everyone runs.
- A check slower than about a minute runs there only when the change touches its declared source paths, and the coverage gate always runs.
- Ignore the pinned tool file and the evidence directory in version control, and never commit the tool.
- Propose any `.no-mistakes.yaml` or other pipeline change as a separate selected edit, and add no hosted CI workflow unless the user asks.
- The `AGENTS.md` pointer is part of the scaffolded change set and is selected with it.

A commit that changes a property's source paths without changing its model passes the gate only with a line `No-proof-impact: <id>: <reason>` in its message, for example a rename the model does not depend on.
The gate reads the property files' `Source paths:` and `Model files:` lines, so keep them accurate.

`/repo-audit` lists this skill only where cited risk evidence names a spot, and `/maintenance sweep` checks every `formal-*` suite next to the verification kit and routes a drifted one to `/formal-verification maintain`.
