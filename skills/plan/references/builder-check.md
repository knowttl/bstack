# Builder check

A plan is only as good as the design it rests on, and the author cannot see what the design leaves out.
The builder check puts a reader who has never talked to the author in front of the design and asks where they would have to guess.

## Run the check

1. Use a fresh reader that sees only the prompt and the files below, such as a read-only subagent where the host supports one.
   Without one, report the builder check as blocked by the missing fresh-reader prerequisite and stop without drafting or applying a plan.
2. Give the reader the approved design and each of `VISION.md`, the glossary, the project's design document and the verification kit that Step 1 found.
   It reads those files only, edits nothing and asks nobody.
3. Fill in the prompt and send it:

```
You are a talented software engineer. You've been handed a design document
and asked to put together a plan to build what it describes. You will not be
able to talk to the person who wrote it.

Read [DESIGN_PATH], and then [OTHER_INPUT_PATHS].

Report only the questions you'd still need answered before you could plan
this well: places where you'd have to guess and a wrong guess would matter.
For each, give the question, the section it concerns and why the answer
changes the plan. Rank them by importance.

Skip anything the document explicitly leaves to the builder, and anything
you could reasonably decide yourself. Skip nitpicks about wording.

If nothing important is left, say "nothing important left".
```

## Filter the report

Check each question against the inputs before the user sees it.
Drop a question that another input answers, citing where, and a question about something the design leaves to the builder.
Drop one that a sensible default settles without changing any unit's boundary, order or evidence, and record the default in the plan as a decision.
Turn one that an experiment can answer into a spike unit as the plan format's spike units section describes, instead of asking the user, and record it in the plan as a decision that names the spike.
Keep a question only when two plausible answers would produce different units, a different order, a different boundary or different evidence.
Bring the user the questions that remain, ranked as the reader ranked them, and nothing else.

A target with no measure is such a question.
"Fast" and "secure" cannot become a unit's acceptance check until the user says how they are measured.

## Report the result

Say how many questions the reader raised, how many you dropped and why, and how many went to the user.
When the reader found nothing important left, say so instead of inventing questions.
