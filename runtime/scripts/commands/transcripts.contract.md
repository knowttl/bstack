## Recall skill command

`node skills/recall/scripts/recall.mjs transcripts --repo <path> [--json]` is the installed entry point of the recall skill, which ships only this command.
`--help` lists the command, and `transcripts --help` prints its syntax.

`transcripts` opens the transcripts of Claude Code under `CLAUDE_CONFIG_DIR` (default `~/.claude`) and of Codex under `CODEX_HOME` (default `~/.codex`) read-only and never writes to the target or to either host folder.
A session belongs to the project when the launch directory it records is the repo or inside it.
Selection reads launch metadata from candidate Claude Code session files in project folders whose encoded names match the repo or its prefix, and from all Codex `sessions/**/rollout-*.jsonl` files, including sessions belonging to other projects.
Only matching sessions are digested.
It writes one `<host>-<session file name>.txt` digest per matched session into a new scratch folder, readable by its owner only.
A digest holds `[timestamp] user: text` and `[timestamp] assistant: text` entries only: sub-agent turns, tool calls, tool results and reasoning are left out, and each turn is cut at 2000 characters.
The result carries `data.root` (the resolved repo root), `data.path` (the scratch folder), `data.sessions` (ordered by transcript file modification time, newest first, each with `host`, `cwd`, `started`, `turns`, `firstPrompt` cut at 120 characters and `digest`), `data.skippedLines` and `data.limitations`.
A line that is not JSON, such as the partial last line of a live session, is skipped and counted.
No matched session is a pass with a limitation, and `--workspace` is a usage error because the command needs a Git repo.
