# Reading the no-mistakes run history

Use this reference when a procedure reads the target repo's no-mistakes runs: tuning the review profile, mining repeated mistakes or auditing a repo.
Every procedure reads the same history the same way, so their counts agree.
Read only: never respond to a gate, rerun, abort, answer anything, or modify the state store or its daemon.

## Enumerate every run

List every run for the target repo, including its ID, status, branch, base and head commits, and pull request when present.
Check `no-mistakes runs --help` for the installed version's listing options; do not assume its default or a large limit returns every run or includes IDs.
When the CLI cannot enumerate all IDs, inspect the no-mistakes state store read-only: identify the target's repo record, verify it matches the target, and query all `runs` rows for its `repo_id`, including a total count.
For the SQLite store at `~/.no-mistakes/state.sqlite`, open the database read-only, inspect the `repos` and `runs` schema for the installed version, and use the repo ID to select the runs.

## Read every run

For every run, read `no-mistakes axi status --run <id>`, `no-mistakes axi logs --run <id> --step review --full` and `no-mistakes stats --run <id>` for review findings, rounds, fix turns, step durations and agent time.
Plain `no-mistakes stats` reads every repo on the machine and is slow.
Find each run's changed files from its pull request on the host, read-only, or from `git diff --name-only` between its base and head when both commits are present.

## Record coverage

Use a bounded sample only if the full history is unreadable or too large to read in full.
Record the runs read versus the total, the selection and date range, which details were unavailable, and the specific reason for any incomplete coverage; do not describe a capped listing as the total.
When the repo has no run history, say so and continue without it.
