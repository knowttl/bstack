## No-mistakes history

`history --repo <target> [--export-findings] [--json]` summarises the target's no-mistakes runs without target writes or daemon access.
It identifies the repo from the basename of its `no-mistakes` Git remote URL, removing a `.git` suffix, and opens `state.sqlite` under `NM_HOME` (default `~/.no-mistakes`) read-only.
Repo, run, round and step records are read within one SQLite transaction.

`data.runs` reports total and readable run counts, readable counts by status, `multiRoundRuns` (readable runs reaching round 2 or later in any step) and `reworkRate` (`multiRoundRuns / read`), the first and last recorded run dates, and each readable run's ID, status, branch, highest review round and finding count.
Findings are counted once per run, step and finding ID, using their first recorded round, severity, action and file.
`data.findings` reports the total, counts by severity, action (including `ask-user`) and step, skipped count, and counts and shares first raised in round 2 or later and in round 3 or later.
A skipped finding was declined by the user and never selected for a fix in any recorded round.
`data.hotspots` lists files flagged in at least two distinct readable runs, with run and finding counts.
A finding records the path its file had when it was raised, so each recorded path is mapped to the current file: a path that is a file at HEAD maps to itself, and any other path follows renames along the first-parent history of HEAD at Git 50% similarity.
Each hotspot's `file` is that current path, `recordedPaths` lists the recorded paths counted under it and `atHead` is true.
A recorded path that leads to no file at HEAD, because the file was deleted, the rename was not detected or history is unreadable, keeps its recorded name with `atHead: false` and is named in `data.limitations`.

`--export-findings` saves every counted finding to `findings.json` in a new scratch directory and returns `data.findingsExport` with its `path` and `count`.
Each record holds `run`, `step`, `round` (the round that first raised it), `id`, `file` (the current path as above, or null when the finding names no file), `recordedFile`, `atHead` and `text` (the finding's description).
Without the option the command writes nothing.
`data.stepTime` reports recorded milliseconds per step and each step's share of the sum of recorded step durations, rather than elapsed wall-clock time.
Shares are fractions rounded to three decimal places, or zero when the denominator is zero.

`data.git` counts commits reachable from the current HEAD, fixes whose subjects start with a Conventional Commit `fix:` prefix (including a scope or breaking-change marker), and reverts whose subjects start with the word `revert`, case-insensitively, plus `recentFixes` (up to 20 most recent matching commits with `sha`, `subject` and `files`).
These are subject-based counts of locally available Git history, independent of the linked run records; missing ancestors are never fetched.
Unreadable Git history returns `git: null` and a limitation.

A missing remote, store, repo record or run history returns pass with zero run counts and a limitation, preserving any available Git counts.
A run with unparseable findings or selection lists is named in `data.limitations` and excluded from readable run, finding, hotspot and step-time aggregates; it remains in the total and recorded date range.
The command supplies aggregate evidence; the shared [history-reading reference](../../references/no-mistakes-history.md) owns the procedure for reading every run and recording incomplete coverage.
