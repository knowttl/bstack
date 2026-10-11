# Unmet final acceptance cases

AC-7 and AC-12 failed in the completed final `existing-repo` with-skill run.
Evaluation stopped without waiving either case, repeating the unchanged agent input or marking the release complete.

The [with-skill run](runs/2026-10-11T21-16-16.926Z-20e6769c-4955-4fcf-ac1c-c8a2a8cc0ad7/run.json) records source `65cffc4dca2cb1503d5e2b414f06b8bc2642dfbb`, the pinned container, Codex CLI 0.162.1 and gpt-6.1-sol with medium reasoning.
Both runs use fixture revision `c8576a3095a37da037d42c4bdf358d6372f5a91e`, matching criteria and adapter, and complete both scripted answers.
The [comparison](existing-repo-comparison.json) passes the design's improvement rule: baseline 13/19, with-skill 17/19, four gained checks and none lost.
That improvement does not establish passing evidence for every acceptance case.
All-case release readiness remains blocked.

## AC-7: targeted question

The [conversation](runs/2026-10-11T21-16-16.926Z-20e6769c-4955-4fcf-ac1c-c8a2a8cc0ad7/conversation.txt), lines 7 through 71, contains discovery, executed checks, recommendations and both scripted follow-ups.
Messages at lines 40, 47 and 61 describe unresolved upstream-price, service-error and order-state policies and keep dependent implementation blocked.
They do not ask the owner a targeted question about the conflicting price or intent.
The [original findings](runs/2026-10-11T21-16-16.926Z-20e6769c-4955-4fcf-ac1c-c8a2a8cc0ad7/artifacts/findings.json), F-001 and F-006, independently confirm the gap: their fixes describe decisions needed without presenting an actual question for an answer.
Keeping a decision unresolved is insufficient for this scenario's explicit question criterion.

## AC-12: terminology clarification

The same conversation identifies the two meanings of `Order` and keeps `Panel sequence` as a draft.
It does not ask the owner an evidenced terminology question.
F-005 in the original findings proposes draft meanings and says author approval is required before edits, but does not seek clarification.
Preserving unconfirmed definitions as drafts satisfies only part of AC-12.

## Other evidence and limits

The instruction-merge check passes from the actual inventory candidate at conversation line 15, including equivalent-content review, scope preservation, protected removal and the Claude Code version limit; it is not inferred from the final message.
The architecture-candidate check uses the research report's observed route responsibilities, F-002/F-006 public ownership recommendations and F-003's coupled-core candidate.
The evaluator independently checked all 21 original file citations, confirmed an unchanged project and verified removal of the login copy before closing the scored run.
The runner removed the container and isolated home.
The failed case scores remain explicit in the retained run and answers.
No final manifest, complete acceptance result, full-suite release capture, tag or release is claimed.
The concurrently captured existing-vision baseline completed its scripted answer but remains unscored.
The existing-vision with-skill opening was captured before this stop and closed before its scripted follow-up.
Both isolated homes and their containers were removed; neither conversation is selected as passing final evidence.
