# Purpose interview

Establish the project's purpose before drafting, including for an empty repo or a new idea in a non-Git directory.
If the user already explained the idea, summarise that explanation and ask only about gaps.
A design document the user names counts as that explanation.
Keep interview notes in scratch outside the target until the user approves the vision.

## What to establish

- The problem the project solves and the single capability or responsibility it owns.
- The intended users and the outcome that makes the project successful for them.
- Non-goals and refusals: what the project declines to do even when asked.
- The trade-offs that decide which future changes fit, which become the board's proposals.

Data, interfaces, deployment, compatibility constraints and the first user journey belong to later project setup.
Do not ask about them here, and do not choose a language, framework or lint preset.
Use available documents and facts instead of asking the user to look them up.
Identify which statements are author decisions and which are assumptions or unresolved questions.
Do not claim support from nonexistent project history.

## Work through decisions

Load the grilling guide from the table in SKILL.md when an unresolved choice would change the draft.
Resolve parent decisions before dependent questions, give a recommended answer with its trade-off, and group only independent questions into a small numbered round.
For example, resolve who the users are before deciding which capability the project refuses to grow into.
Retain previously approved choices rather than reopening them.

## Confirmed-purpose rubric

Finish with a concise summary of the agreed purpose, users, success outcome, non-goals and remaining uncertainties.
Check the summary against each item under What to establish.
Each item must have an agreed answer or a named gap and the part of the draft it blocks.
Separate confirmed author decisions from assumptions and unresolved choices.
The summary is not an approval of the generated VISION.md.

Ask the user to confirm new or changed intent before drafting from it.
If the user corrects the summary, revise it and obtain confirmation of the changed intent.
Silence and interrupted sessions do not confirm intent.

Done when: Each purpose item is agreed or named as an unresolved gap, the user has confirmed the summary, and the draft stays blocked wherever a material choice remains open.
