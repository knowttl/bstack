# Phase 1 E2E validation

The implementation tested for the final new-idea run is `5e412ea009e193713e9fdca508fd682b2de3315a`.
The initial ambiguous-idea run tested `9682b365c0ab20346cd7d0a211721ad7ee56ed85` before the fixes.
Both runs used the intent checkpoint, with the skill explicitly invoked through the real Codex adapter.
The host was Linux 6.8.0-142-generic x86_64 with Node v24.17.0, npm 11.13.0, Git 2.54.0 and Codex CLI 0.160.1.
The pinned board runtime was lavish-axi 0.1.78.

## Findings and fixes

The new-idea script described "missing items" without explaining how the household identifies them.
The agent correctly asked about that gap.
The corrected answer specifies household need-to-buy marking and no quantities or stock levels in version one.

The Codex adapter opened with danger-full-access but resumed with read-only permissions.
Recorded host turn contexts confirmed the policy change, and the real agent could not create review scratch.
The resume command now passes the matching sandbox_mode configuration.
The boundary regression fails with the old adapter and passes with the fixed adapter.
Real resumed turns with the fixed adapter created scratch drafts and boards.

The skill required browser feedback even when the author reviewed in the conversation.
It now presents the draft and cards in the conversation and accepts explicit card verdicts in the existing versioned transport.
The public-command test verifies that ingestion saves the supplied reasoning and revised draft without requiring a launch, while leaving approval pending and the workspace unchanged.

## Verification

`npm ci --ignore-scripts`, `npm ci --omit=dev --prefix skills/repo-audit` and `npm run check` exited 0.
`npm test` exited 0 with "tests 266", "pass 266", "fail 0" and "skipped 0"; the captured final output is [tests.txt](tests.txt).
The package check reported "check-package: passed".
The configuration file `.no-mistakes.yaml` remains byte-identical to main, and no workflows were added.

The documented synthetic `vision-board build` and `launch` commands exited 0 against the shared Lavish server.
A real browser selected In vision, supplied reasoning and sent a complete round.
The pinned terminal listener delivered the original complete-round JSON.
`vision-board verdicts` exited 0, preserved the original draft, saved the revised draft in new scratch and returned pending-author-review.
The test session was ended and its isolated browser bridge stopped.
This synthetic roundtrip proves transport and revision preservation, not approval of the new-idea vision.

The [ambiguous-idea transcript](ambiguous-idea.txt) line 29 explains both offline-access outcomes, keeps the decision unresolved and selects no stack.
Its explicit human score passes the decision check.
After close, its isolated home was absent and its workspace contained only brief.md, byte-identical to the fixture source, with no Git directory.

The [new-idea transcript](new-idea.txt) line 15 records the interview; lines 38 and 52 present full scratch drafts and proposal cards in the conversation.
Line 52 incorporates household need-to-buy marking and excludes quantities and stock levels, while keeping storage and stack details outside domain definitions.
The explicit score passes interview and terms, and fails vision because no reviewed revision received author approval.
The scripted answers supply intent and vocabulary but no explicit verdicts for the local-backup and recipe proposals.
The remaining approval answer was not sent against an unresolved review.
The three completed host turns stayed within the unchanged 120-second bound, with no blocking browser listener.
After close, the isolated home was absent and the workspace contained only brief.md, byte-identical to its fixture source, with no Git directory.

## Remaining limitations

The approved scratch vision is still blocked on author verdicts for every proposal, followed by approval of the resulting revision.
T1.7 remains incomplete; these observations do not claim protected project creation or final acceptance.
Earlier fixed-adapter attempts timed out while awaiting browser feedback and were closed without approval.
Their throwaway homes were deleted and the one throwaway server was stopped.
The login copy was removed after every host turn, including failures; no login contents are recorded here.
The captured transcripts preserve line numbers while redacting host paths, user names and run or session identifiers.
They are historical observations and cannot resume the deleted conversations.
Changing the scenario request and scripted answer changes comparison identity; future comparisons need a baseline with the same scenario inputs.
These local runs establish Linux and Node 24 evidence only.
