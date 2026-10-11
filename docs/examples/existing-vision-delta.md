# Existing vision: personal backup boundary

Prepare with `node tests/fixtures/build.mjs existing-vision-delta`, then follow the [install and invocation steps](README.md).

Request: Audit the approved reading-queue vision against the newer portability decision in `DESIGN.md` and accessible history.
Present an evidenced candidate delta without applying or replacing the approved vision, and review backup versus sharing.

Findings: The later approved decision permits personal export of title, address and read status, but the vision lacks acceptance/resistance criteria for that boundary.
Export designed for another reader could introduce sharing even without accounts or hosted links.

Selection: The scripted author confirmed personal backup while retaining the exclusion of accounts, sharing and recommendations, and requested exact candidate edits only.
No project write or implementation/stack change was approved.

Result: The candidate retained every baseline line and appended two lines accepting personal backup and resisting scope expansion.
The candidate-delta rubric passed.
Board build, launch and listener startup were observed, but browser interaction, bound verdicts and exact saved-revision approval remained blocked.
Missing captured starting-check evidence also prevented readiness; the fixture contains no application or native suite.

Evidence: The [conversation](../../tests/eval/results/foundation-C17/vision-delta/conversation.txt), [candidate](../../tests/eval/results/foundation-C17/vision-delta/candidate.md) and [scored summary](../../tests/eval/results/foundation-C17/vision-delta/summary.json) record package revision `7c5e754b948b7ab80a21bfe05de6940d26871fd3`, Linux 6.8.0-142-generic, Node v24.17.0, codex-cli 0.160.1 and gpt-6.1-sol with low reasoning.
This earlier checkpoint establishes a reviewed proposal, not completed board approval or C27 final-path execution.
