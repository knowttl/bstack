# Decisions

Keep decisions out of the project's vocabulary and in their own source.
Glossary work belongs to `/glossary`; keep proposals in scratch until selected, then use the skill's review-before-apply and protected write boundary for project edits.

## Find existing decisions

Read relevant architecture decision records, or ADRs, including context-scoped decisions and the design's decision history, before proposing a change to a recorded choice.
Missing ADR filenames are not readiness failures.
Do not create empty documents or directories upfront.

## Keep decisions separate

Surface a conflict with an existing ADR or design decision explicitly, with its source and the reason for proposing reconsideration.
Use the project's established decision location and format.
An existing design decision history can suffice.
Offer a separate ADR only when the choice is hard to reverse, surprising without context and the result of a real trade-off.
Do not create a record for every setup choice.

When no format exists and a separate ADR is selected, use docs/adr/ with sequential names such as 0001-slug.md.
Inspect existing numbering and use the next number.
Create the directory only through a selected write when a real decision needs recording.
The minimal format is a short title followed by one to three sentences explaining the context, decision and why it was chosen.
Add status, considered options or consequences only when they add useful context.
Keep proposed decisions separate from accepted ones.

Done when: Meaningful technical decisions remain in their appropriate sources with no unselected project writes.
