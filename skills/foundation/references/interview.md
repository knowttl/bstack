# Technical interview

Establish the facts that decide a new project's shape before recommending a language, framework or lint preset.
The purpose, users, success outcome and non-goals belong to `/vision`, so read the approved `VISION.md` for them instead of asking again.
If the user already explained the technical context, summarise that explanation and ask only about gaps.
A design document the user names counts as that explanation.
Keep interview notes in scratch outside the idea workspace until selected files can be written through `project create`.

## What to establish

- The data the project holds, where it lives, who may read or change it and how long it must be kept.
- The interfaces the project exposes and consumes, including the people, programs and outside services on each side.
- The deployment environment, and the reliability and access constraints that apply there, such as offline use or sign-in.
- The first user journey and the outcome that shows it works, described in terms the user can assess.
- Existing decisions, required tools and behaviour that must stay compatible.
- Trade-offs that would change the system's shape or the journey's acceptance check.

Use the approved vision, the glossary and the design instead of asking the user to look facts up.
Identify which statements are author decisions and which are assumptions or unresolved questions.
Do not claim support from nonexistent project history.

## Work through decisions

Map the unresolved choices as a tree, resolving parents before dependent questions.
Ask only questions whose prerequisites are settled.
Give a recommended answer and its relevant trade-off with each decision question.
Group only independent questions into a small numbered round, then wait for answers.
Recompute the ready questions after each answer, and load the grilling guide when a choice would change the stack.
Research factual gaps from available evidence while keeping dependent decisions blocked.
For example, resolve whether users need offline writes before recommending storage and deployment.
Retain previously approved choices rather than reopening them.

## Confirmed-context rubric

Finish with a concise summary of the agreed data, interfaces, deployment constraints, first journey and remaining uncertainties.
Check the summary against each item under What to establish.
Each item must have an agreed answer or a named gap and the recommendation it blocks.
Separate confirmed author decisions from assumptions and unresolved choices.
The summary is not an implementation plan and does not approve any file or command.

Ask for confirmation of new or changed context before a proposal depends on it.
If the user corrects the summary, revise it and obtain confirmation of the change.
Silence and interrupted sessions do not confirm anything.
Unresolved material choices remain visible and block the stack, scaffold or journey that depends on them.

Done when: Each item is agreed or named as an unresolved gap, the summary is confirmed, and every dependent recommendation stays blocked wherever a material choice remains open.
