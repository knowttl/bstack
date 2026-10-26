---
name: prototype
description: Build two or three throwaway variants of a design in scratch, drive and measure each with the project's verification kit, and report the evidence and a recommendation without writing to the repo.
disable-model-invocation: true
---

## Scope

Only the user starts prototype.
Start this procedure only when the user's message explicitly invokes `$prototype`, `/prototype`, `/skill:prototype` or selects it through the host's skills menu.
A plain request such as "try both approaches" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
The target is an existing repo that has an applied verification kit, passed as `--repo`.

A prototype answers a design question that a document cannot, by measuring it.
It builds two or three throwaway variants in scratch, drives each with the kit's feature steps, and reports the measured evidence and a recommendation.
A plan's spike unit names such a question and its measured Done when, and this skill is how the user settles it; the user records the outcome in the plan through `/plan`.
It is an experiment, not the plan's execution: nothing a variant produces becomes the project's code, and building the chosen design for real is a separate change the user starts.

It writes nothing to the target, and the target is byte-identical afterward.
Variants are clones in scratch outside the target, so every edit, install, launch and evidence file lands there.
It starts no other skill; name any follow-up skill as a next step for the user to run.
Variant code runs on this machine through the kit's launch command, so read what the kit launches before the first run, and stop if a variant needs a credential, an outside service or a network call that the kit does not already make.

## Checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Settle the question and the measure
- [ ] Step 2: Confirm the kit and the baseline
- [ ] Step 3: Build the variants
- [ ] Step 4: Drive and measure the baseline and each variant
- [ ] Step 5: Report

### Step 1: Settle the question and the measure

Take the question from the user's message or from the plan's spike unit it names.
Write down the question, the measure that answers it and the decision it feeds.
A measure is what the kit can observe: a feature's steps passing, or a number that a step prints, such as a latency, a size or a count.
When no measure can answer the question, say that a prototype is the wrong tool and stop; a question of mechanics or motive belongs to `/how` or `/why`.
Ask the user one question, with a recommendation, when the measure or the features to drive are unclear.

Done when: The question, the measure, the kit features to drive and the decision are stated, or the skill stopped because nothing measurable answers the question.

### Step 2: Confirm the kit and the baseline

Find the kit at `.agents/skills/verify-<app>/kit.json` and run `node scripts/prototype.mjs kit check --repo <target> --app <app> --json` to confirm it is true.
When the target has no kit, tell the user that the skill needs one, name `/verification` as the skill that creates it, and stop; never invent another way to measure.
Record `git -C <target> rev-parse HEAD` and `git -C <target> status --porcelain --ignored` so Step 5 can compare them, and tell the user that variants start from the committed HEAD, so uncommitted target changes are absent from every variant.
Make the scratch folder outside the target, using the host's scratch folder when it names one.
Make a clone named `baseline` with `git clone --no-hardlinks -q <target> <scratch>/baseline`, run `git -C <scratch>/baseline remote remove origin` so nothing can reach the target, and prove the kit on it: `node scripts/prototype.mjs kit prove --repo <scratch>/baseline --app <app> --feature <id> --json` for each feature in Step 1.
Run the setup that the clone lacks, such as installing dependencies, inside the clone only, and list those steps for the report.
Never prove the kit on the target itself, because the proof writes its evidence into the repo it runs in.
A baseline that fails means the harness or the setup is broken, not a variant: report the failure code and stop.

Done when: `kit check` passed, the target's HEAD and status are recorded, and the baseline clone passed every feature, or the skill stopped with the exact blocker.

### Step 3: Build the variants

Choose two or three variants that differ in approach, not in tuning, and name each by what it does.
A third variant is worth building only when it is a different approach from the other two; two honest variants beat three similar ones.
Make each as its own clone as in Step 2, remove its `origin` and edit it only inside the clone.
Build the least that answers the question: no polish, no tests beyond what the kit drives, no changes unrelated to the question.
Never edit the kit's steps to suit a variant.
When the measure is a number that the feature steps do not print, add a measuring step to `kit.json` in the baseline and in every variant, identical in each, and list it in the report.

Done when: Each variant is a clone in scratch with its approach described in a sentence and its edits confined to the clone.

### Step 4: Drive and measure the baseline and each variant

Run `kit prove` again on the baseline and on every variant for every feature from Step 1, using the final identical instrumentation and the same command and order in each clone.
Read each run's proof record at `<clone>/<data.evidenceDirectory>/<feature>.json` for the steps' output, and record the outcome, the failure code when it failed and the measured values.
A variant that fails a step because it does not deliver the behavior is a result, so report it with the observed output instead of changing the kit to make it pass.
When the measure is a number that varies from run to run, run the proof at least three times with the same repetition count for the baseline and every variant, and report every value, never a single run.
Where a variant fails for a reason that is not about the variant, such as `launch-not-ready` from a missing dependency, fix the setup in the clone and say so.

Done when: Every variant and the baseline have a proof result for every feature, with the evidence path and the measured values, or a named failure code.

### Step 5: Report

Load the [writing reference](references/writing.md) and write `report.md` into the scratch folder.
State the question and the measure first, then the recommendation, then the evidence:

- a table of the baseline and each variant against the measure, with the outcome, failure code and values from the proof records
- one sentence per variant on its approach, and the setup steps it needed
- why the recommended variant, or none, is better by that measure, and how sure the evidence makes the result
- what the measurement does not show, such as load, scale or a feature the kit does not map, and any measuring step added to the kit copies

Label each claim with its variant and proof record path, and mark anything the records do not state as an inference.
Recommend a variant only when the measure separates it from the others; otherwise say that the evidence does not decide and name the next experiment.
Then run `git -C <target> rev-parse HEAD` and `git -C <target> status --porcelain --ignored` and compare them with Step 2.
Present the report to the user, give the path of `report.md` and the variants, and tell the user that the folder holds throwaway code to delete when done.

Done when: `report.md` is in scratch, every claim names its variant and proof record or is labelled an inference, the target's HEAD and status match Step 2, and a recommendation or an explicit "the evidence does not decide" is stated.

## Write rules

Write nothing to the target, and run no command with the target as its working directory except the read-only `git -C <target>` checks in Steps 2 and 5.
Use the installed `scripts/prototype.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target or the clone explicitly.
Use command help for syntax, and never guess arguments.
Move nothing from scratch into the repo; if the user wants a variant built for real, that is a separate change they make or request from the skill that owns the file.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source.
Never recursively search bundled reference directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Writing the report | `references/writing.md` |
