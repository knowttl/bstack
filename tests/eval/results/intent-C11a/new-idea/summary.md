# Real intent checkpoint after the authorised timeout change

Source revision: `abe5adabf2307346f66183959576586780b8165b`.
Host: Linux 6.8.0-142-generic, Node v24.17.0, Codex CLI 0.160.1 and chrome-devtools-axi 0.1.34.
The adapter and validator now allow 600000 ms, as firstmate authorised because live model revision turns exceed two minutes.
All 56 evaluation interface tests passed after that change.
Installed skill command defaults were not changed.

The real new-idea scenario ran at the intent checkpoint with the skill explicitly invoked and the approved throwaway-login procedure.
Its opening turn completed with child exit code 0 in 55765 ms.
The first scripted answer was delivered with eval turn.
A native live-log watcher reported the board URL as soon as launch completed.
The task-specific browser opened the shipped review UI, recorded In vision for optional local file transfer and Off mission for recipe-based shopping suggestions, and sent the complete round.
The agent received that original complete-round payload and ran the shipped verdicts command successfully.
It saved a semantic revision, preserved the original and presented the entire saved revision for approval through the board conversation.

The scripted author reviewed that saved text and supplied the scenario's domain and conditional approval answers through the shipped UI, with explicit approval of the exact revision.
Send & End ended the review session.
The live agent received the approval and saved `approval.json`, `VISION-approved.md`, the revised vision, a domain-only glossary and its scratch transcript.
The exact approved file SHA-256 is `656be605852fb4e5e8bd960e2ec36da1571bae87b1085b5ef5c2cab3aa66e9e1`.
The retained copy was checked against the scratch source and has the same SHA-256.

The resumed child exited 0 after 270008 ms, without timeout or cancellation.
The shared child-command capture retained only the last 65536 bytes of output, so its `outputTruncated` flag is true.
The adapter correctly retained status blocked and deleted the isolated home at 2026-10-08T07:00:53.568Z.
Its reason is `Host turn unavailable or incomplete (0). Follow the manual procedure.`
The captured conversation is incomplete and has not been scored as passing adapter evidence.
The saved approval and glossary prove observed outputs, but they do not manufacture a complete adapter transcript or verified final acceptance selection.
The evaluation contract requires truncated host results to remain blocked.
Firstmate must decide the next step for complete evaluation capture before T1.7 is marked complete and T2.1 begins.

The isolated home was confirmed absent.
Both the task browser bridge and private Lavish server returned stopped, and private server state was removed.
The source fixture still contained only brief.md, byte-identical to its committed source, and no Git directory.
The earlier ambiguous-idea intent evidence remains in `tests/eval/results/phase1-check/ambiguous-idea.txt`.
This checkpoint does not claim protected project creation.

The saved scratch artifacts, blocked run record and captured conversation are retained beside this summary.
Host paths, user names and session identifiers are redacted in every retained copy.
The blocked record's truncation and isolation flags are preserved rather than promoted to passing evidence.
No credential contents were read, printed or committed.
