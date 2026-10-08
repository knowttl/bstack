# T1.7 prerequisite attempt for C11a

Status: blocked, before board review.
Source revision: `af89c9c87bcee98f9b70639df46ac13fa2b941df`.
This is a prerequisite attempt, not T2.1 discovery evidence or completed T1.7 evidence.

The real `new-idea` scenario ran with `--mode with --stage intent` and `tests/eval/adapters/codex.json`.
The adapter created a fresh private home, staged the skill and verified discovery isolation.
It copied only the Codex login for the opening turn and removed that copy after the turn.
Codex CLI 0.160.1 on Linux with Node v24.17.0 completed the opening turn in 44372 ms with child exit code 0.
The agent read the brief and interview references, retained the approved purpose and stack, and asked about the manual missing-item status and reliability boundaries.
No scripted answer, board verdict or vision approval was delivered.
The evaluation command exited 2 because captured, unscored conversations remain blocked.

Browser preparation used chrome-devtools-axi 0.1.34 in a task-specific session.
Both `open about:blank` and `newpage about:blank` exited 1 with this response:

```text
error: No page is currently selected
code: BROWSER_ERROR
help[3]: Run `chrome-devtools-axi open <url>` to open a page,Run `chrome-devtools-axi pages` to list tabs,Run `chrome-devtools-axi selectpage <id>` to select a tab
```

The worker stopped after the same obstacle occurred twice, as its launch contract requires.
`eval close` retained the captured conversation and recorded isolated-home cleanup.
The task-specific browser bridge returned `status: stopped`.
No Lavish board or server was started.
The raw conversation and closed run record remain in temporary scratch for supervisor inspection, not in this committed artifact.
Host paths, user names and session identifiers are omitted here.
Next prerequisite: restore a usable browser session and rerun the real new-idea scenario through the shipped board UI, revision and explicit approval.

## Retry after firstmate's browser workaround

Firstmate supplied the verified start, pages and selectpage sequence.
The task-specific browser selected tab 1 successfully.
A fresh real isolated new-idea run tested `fa7d795100217a523f9c8df8074aca58607131e5` with the unchanged adapter and scenario.
Its opening turn completed in 34960 ms with child exit code 0.
The agent asked how missing items are identified.
The first scripted reply retained the brief's approved goals and local-household scope.
The resumed agent created a scratch draft, built and launched the board and started the pinned feedback listener.
It presented local file transfer and optional grocery-service handoff as its two review cards.

The browser opened the real board URL and displayed the draft and first card.
An initial action batch used refs invalidated by the layout curtain and returned STALE_REF.
A fresh snapshot displayed the first card's In vision, Off mission, Conditional, reasoning and Record verdict controls.
No verdict was successfully recorded or sent.
The operator waited too long before checking the launched board.
The real host turn hit the adapter's unchanged 120000 ms bound, returning timedOut true, SIGKILL and no child exit code after 120014 ms.
The adapter marked host failure and deleted the isolated home at 2026-10-08T06:39:41.259Z.
No second scripted answer or conditional vision approval was delivered.
The real draft was never approved, so T1.7 and its dependent T2.1 remain blocked.

The browser bridge returned `status: stopped`.
Ending the board by file path failed with ENOENT because timeout cleanup had already removed its scratch home.
The private Lavish server then returned `status: stopped` for port 4489.
The isolated-home absence was confirmed.
The closed raw run and conversation remain in temporary scratch for supervisor inspection.
No credentials, original host paths, user names or session IDs appear in this artifact.
Next prerequisite: a fresh supervised run with board interaction delivered before the adapter timeout, or firstmate direction for that bound.

## Final authorised retry with live observation

Firstmate authorised one further attempt with the unchanged timeout and directed escalation if it also timed out.
This attempt tested `8a93e78` on the same Linux, Node and Codex versions, using the unchanged scenario and adapter.
The browser started with tab 1 selected before the run.
The opening turn completed in 52342 ms and asked how missing items are identified.
Only the first scripted reply was delivered through the evaluation interface.
A native `tail -f` and `rg` watcher on the isolated Codex session log reported the board URL immediately when launch completed at 2026-10-08T06:45:24.952Z.
The browser opened the board immediately, selected per-card verdicts, supplied reasoning and clicked Record verdict for each card.
It then clicked Send my verdicts back at 2026-10-08T06:46:19Z.
No direct handler, transport call or fabricated complete-round input was used.

The live pinned listener returned `status: feedback` and all three `vision-verdict` prompts, including the complete round bound to draft hash `402b00b4d0a07eaccba31cb7de86441a83ec1935b91844883fb74cddbbbeff32`.
The returned card verdicts were:

- `portable-household-list`: In vision, because optional manual file transfer keeps household data local without accounts, servers or remote services, and is an acceptance boundary rather than a required version-one feature.
- `stock-thresholds`: Off mission, because version one has no quantity or stock-level tracking and the household explicitly marks named supplies as needing to buy.

The real agent responded:

> Your verdicts establish that optional manual file transfer fits the vision, but is not required for version one. They also settle “missing”: the household marks items it needs to buy; version one does not track quantities or use stock thresholds.
>
> I’ll fold both decisions into the vision and glossary, then present the saved revision for approval.

The turn then timed out after 120017 ms with SIGKILL and no child exit code.
The adapter deleted the isolated home at 2026-10-08T06:46:30.476Z.
No saved revised vision, successful verdicts command or explicit revision approval is evidenced in the captured conversation.
The board verdicts are real transport evidence, but they do not complete T1.7.
The evaluation command returned blocked with the reason `Host turn unavailable or incomplete (null). Follow the manual procedure.`
No additional retry or timeout change is authorised.

Send & End was clicked in the shipped UI after timeout, and the task browser bridge and private Lavish server both returned stopped.
Private server state was removed.
The isolated home was confirmed absent, and the fixture still contained only brief.md with bytes matching its source.
Raw closed run and conversation artifacts remain in temporary scratch for firstmate inspection, with no login copy retained.
T1.7 completion is dropped from this slice's implementation scope pending firstmate's captain escalation.
T2.1 remains unstarted because its plan dependency is incomplete.
