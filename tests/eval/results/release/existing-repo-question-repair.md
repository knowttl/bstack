Historical (v0.1.0): the per-run independent-verification.json files cited below were removed when machine assertions replaced them.

# Targeted decision questions

The final [existing-repo comparison](existing-repo-comparison.json) passes 19/19 against the retained 13/19 baseline, with six gained checks and none lost.
The earlier [17/19 failure](existing-repo-failed-cases.md) remains immutable historical evidence.

The owning skill's Step 8 now explicitly requires an evidenced question for conflicting intent or policy and competing term meanings, with plausible readings, a recommendation and a wait for the answer.
This is one instruction change in one file; no wording-matching test was added.
The repository package validator passed.
The generic skill validator does not recognize the existing explicit-invocation frontmatter field, so its result does not establish package validity.

The [new conversation](runs/2026-10-11T21-31-14.000Z-57b01fe4-9437-43f9-84c8-fb60f42ed3cf/conversation.txt) binds source `da8d5c3f82170025c7d106a3c587a4ca39f0ff25`, fixture revision `c8576a3095a37da037d42c4bdf358d6372f5a91e`, the unchanged pinned image and adapter, Codex CLI 0.162.1 and gpt-6.1-sol with medium reasoning.
It completes both scripted answers.
At line 38, after discovery and executed checks, the agent cites DESIGN.md:4, journey.mjs:6 and routes.ts:4 and asks whether core should own checkout pricing policy or checkout should reject a conflicting service price.
It recommends core ownership and keeps implementation blocked.
The same line cites the two glossary definitions, asks whether to reserve Order for customer purchase and Panel sequence for UI ordering or keep context-specific meanings, and recommends the draft distinction.
Lines 73 and 83 retain the unresolved policies and unapproved terminology without project edits.
The original [terminology draft](runs/2026-10-11T21-31-14.000Z-57b01fe4-9437-43f9-84c8-fb60f42ed3cf/artifacts/terminology-draft.md) and [findings](runs/2026-10-11T21-31-14.000Z-57b01fe4-9437-43f9-84c8-fb60f42ed3cf/artifacts/findings.json) independently retain those boundaries.

All other seventeen checks pass without regression.
Instruction consolidation is evidenced by the actual inventory candidate at line 15, including equivalent-content review, scope preservation, protected removal, author approval and the Claude Code version limits.
The route's mixed pricing/state responsibilities and the coupled core files are evidenced in the research report, findings and scoped review, rather than inferred from sizes or single-commit history.
The original native check capture records passing types and two units alongside failed boundaries and the agreed total-10 journey returning 12.
Readiness remains blocked by those fixture defects.
The independent verification (removed file: runs/2026-10-11T21-31-14.000Z-57b01fe4-9437-43f9-84c8-fb60f42ed3cf/artifacts/independent-verification.json) checks every original file citation, an unchanged project and removal of the login copy.
The scored record verifies container removal and deletion of the isolated home.

The [existing-vision comparison](existing-vision-delta-comparison.json) also passes 1/1 in both modes under the documented candidate-delta rubric.
Its [with-skill conversation](runs/2026-10-11T21-31-10.273Z-1acf62d6-03f8-474c-84a0-eff98405157d/conversation.txt), lines 28 through 82, preserves the approved baseline, finds the newer portability gap, reviews the backup-versus-sharing fault line and presents exact candidate line additions after the scripted clarification.
The original baseline, candidate, delta and independent citation/unchanged-project checks are retained beside the run.
Board build and launch succeeded, but no complete-round feedback or exact revision approval arrived.
The evaluator's browser started and selected page 1; the opening turn ended and its container was removed before navigation.
No verdict was submitted or invented, and no completed board approval is claimed.
No project files changed.

Changing the skill invalidates the earlier with-skill runs as final package evidence.
Those captures remain historical observations until refreshed against the settled package.
The complete acceptance result, remaining scenarios and final full-suite release capture remain pending.
