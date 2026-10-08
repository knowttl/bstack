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
