# Intent interview

Establish intent for a new idea, including an empty repo, before recommending a language, framework or lint preset.
If the user already explained the idea, summarise that explanation and ask only about gaps.
Keep proposals and interview notes in scratch outside the target workspace until selected changes can be applied through the main procedure's protected write boundary.

## What to establish

- The problem, intended users and outcome that makes the project successful.
- The first useful user journey and work outside the project's scope.
- The data, interfaces, deployment environment and important reliability or access constraints.
- Existing decisions, technical constraints and behaviour that must remain compatible.
- Trade-offs that would change the system's shape or acceptance criteria.

Use available documents and facts instead of asking the user to look them up.
Identify which statements are author decisions and which are assumptions or unresolved questions.
Do not claim support from nonexistent project history.
Clarify project terms alongside the interview only when their meaning affects these decisions, without adding a mandatory second interview.

## Work through decisions

Map unresolved choices as a tree, resolving parents before dependent questions.
Ask only questions whose prerequisites are settled.
Give a recommended answer and explain its relevant trade-off with each decision question.
Group only independent questions into a small numbered round, then wait for answers.
Recompute the ready questions after each answer.
Research factual gaps from available evidence while keeping dependent decisions blocked.
For example, resolve whether users need offline writes before recommending storage and deployment.
Retain previously approved choices rather than reopening them.

## Confirmed-intent rubric

Finish with a concise summary of the agreed goal, boundaries, decisions and remaining uncertainties.
Check the summary against each item under What to establish.
Each item must have an agreed answer or a named gap and the recommendation it blocks.
Describe the first journey and its success outcome in terms the user can assess.
Separate confirmed author decisions from assumptions and unresolved choices.
Do not turn the summary into an implementation plan or treat it as approval of a generated vision or file change.

Ask for confirmation of new or changed intent before implementation that depends on it.
If the user corrects the summary, revise it and obtain confirmation of the changed intent.
Silence and interrupted sessions do not confirm intent.
Unresolved material choices remain visible and block dependent recommendations.

Done when: The required intent facts are agreed or explicitly unresolved, the summary is confirmed, and dependent recommendations stay blocked wherever a material choice remains open.
