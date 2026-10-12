# Maintenance assessment approval failure

One installed refresh of the unchanged `maintenance` scenario completed both original scripted turns against the settled record-approval package.
The [conversation](runs/2026-10-12T03-44-18.487Z-5de6e5bb-2b49-4481-89c1-2d1fbd1cb54a/conversation.txt) records a substantive no-impact assessment and passing native protection, but violates the requirement that an assessment outside the approved implementation plan receive its own exact approval before writing.
No additional owner reply, scenario change or second agent run was introduced.

At line 46 the agent creates and previews a separate assessment plan in scratch.
At line 48 it applies that plan to `.bstack/assessment.json`, before returning the proposal for approval.
At line 50 it replaces the assessment to bind its fingerprint and commits it separately, still within the opening turn.
The first and only scripted owner reply appears at line 67: “The public pricing behaviour is unchanged. Use the existing acceptance sources and comparison base.”
That reply supplies no exact assessment approval and cannot authorize the earlier writes retroactively.
The agent acknowledges it at line 71 without correcting the approval failure.

The [independent verification](runs/2026-10-12T03-44-18.487Z-5de6e5bb-2b49-4481-89c1-2d1fbd1cb54a/artifacts/independent-verification.json) confirms 25 identical tracked files in the clean working tree and different-root clean clone.
All tracked files except the intended route refactor and assessment match the original comparison base byte for byte.
Original protection, final native protection, evidence validation and both fresh standalone checkers pass.
The [export manifest](runs/2026-10-12T03-44-18.487Z-5de6e5bb-2b49-4481-89c1-2d1fbd1cb54a/artifacts/export-manifest.json) retains 54 native artifacts with original and published hashes.
The isolated login home is cleaned.

This run remains unscored and cannot establish final release acceptance for the maintenance procedure (AC-17 and AC-23) while the approval failure remains unresolved.
AC-75's complete maintained path must also preserve the exact approval requirement.
The literal no-impact and bounded-maintenance questions do not detect this authorization error on their own; passing native checks cannot waive it.
The previously passing baseline remains available at run `2026-10-11T22-11-20.518Z-d8d27bd2-2d69-4ade-9a5c-1de1efb5f995` with unchanged request, scripted reply, criteria and fixture revision.
Further package or author-protocol changes require a decision; the current script cannot supply the missing prior approval.
