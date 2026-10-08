# Phase 1 E2E validation

The supported new-idea attempt tested `fdc301cd116269a64cf2f38913467950778f95ac`.
The initial ambiguous-idea run tested `9682b365c0ab20346cd7d0a211721ad7ee56ed85` before the fixes.
Both used the intent checkpoint with the skill explicitly invoked through the real Codex adapter.
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

The subsequent conversation-review experiment introduced an approval surface outside the design.
That procedure, scenario request and additional test have been removed.
The original board launch and pinned listener workflow, including the prohibition on substituting another approval surface, is restored.
Unavailable browser interaction preserves scratch and leaves review blocked.

## Recorded verification

Before this rollback, `npm ci --ignore-scripts`, `npm ci --omit=dev --prefix skills/repo-audit` and `npm run check` exited 0.
The historical `npm test` output records 266 passed, zero failed and zero skipped in [tests.txt](tests.txt), including the now-removed conversation-only test.
Those counts describe the superseded experiment, not the final tree.
After restoring the board workflow, `node --test --test-reporter=tap tests/scripts/eval.test.mjs tests/scripts/vision-review.test.mjs` exited 0 with 71 passed, zero failed and zero skipped.
The outer pipeline owns the final prepare, check, full-test and PR phases and must publish its actual final counts.
The configuration file `.no-mistakes.yaml` is unchanged, and no workflows were added.

The documented synthetic `vision-board build` and `launch` commands exited 0 against the shared Lavish server.
A real browser selected In vision, supplied reasoning and sent a complete round.
The pinned terminal listener delivered the original complete-round JSON.
`vision-board verdicts` exited 0, preserved the original draft, saved the revised draft in new scratch and returned pending-author-review.
The test session was ended and its isolated browser bridge stopped.
This synthetic roundtrip proves transport and revision preservation, not approval of the new-idea vision.

The [ambiguous-idea transcript](ambiguous-idea.txt) explains both offline-access outcomes, keeps the decision unresolved and selects no stack.
Its explicit human score passes the decision check.
After close, its isolated home was absent and its workspace contained only brief.md, byte-identical to the fixture source, with no Git directory.

The [supported new-idea transcript](new-idea-board.txt) retains the actual board attempt.
Its first turn passed, asked how missing items are identified and retained the approved stack.
The resumed turn created the scratch draft, built and launched the board successfully, and started the returned pinned listener.
It timed out at the unchanged 120-second host bound while awaiting browser verdicts.
The run record reports blocked, with no scored case results.
Only the first scripted answer was delivered, so the clarified vocabulary answer and conditional approval were not reached in this attempt.
The run record marks isolated-home cleanup complete.
The recorded post-close observation confirms an absent isolated home and an unchanged brief-only fixture with no Git directory.

The [conversation experiment](new-idea.txt) tested `5e412ea009e193713e9fdca508fd682b2de3315a` and is explicitly superseded.
It records no approved vision and is retained without rewriting its quotes as board evidence.

## Remaining limitations

A scripted terminal-only evaluation cannot supply author verdicts through the board.
With no reachable author interaction, preserve the draft and mark interaction blocked rather than claim approval.
T1.7 remains blocked on complete board verdicts and explicit approval of the resulting revision.
Phase 1 is not complete, and these observations do not claim protected project creation or final acceptance.
The login copy was removed after every host turn, including failures; no login contents are recorded here.
Captured transcripts retain their original content and line ordering apart from redacted host paths, user names and run or session identifiers.
They are historical observations and cannot resume the deleted conversations.
Changing the scripted answer changes comparison identity; future comparisons need a baseline with the same scenario inputs.
These local runs establish Linux and Node 24 evidence only.
