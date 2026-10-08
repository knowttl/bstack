# C11a discovery checkpoint

Three fresh real Codex discovery-only runs evaluated implementation revision `441d6c0286757325f2e409a84e0099e15f64ac70` on Linux with Node v24.17.0 and codex-cli 0.160.1.
The existing adapter used gpt-6.1-sol with low reasoning effort, a ten-minute turn cap and 16 MiB capture limit.
Each run used a fresh private home and fixture, copied only the existing login into throwaway state, removed the copy after the turn and deleted the home on close before scoring.
All turns exited 0 without timeout or capture truncation.

| Fixture and mode | Observed result | Duration | Retained evidence |
| --- | --- | --- | --- |
| TypeScript, main-thread | Five sequential briefs; 51 checked file citations; three reviewer checks passed | 98,559 ms | [run](typescript/run.json), [report](typescript/research-report.json), [transcript](typescript/conversation.txt) |
| Python, main-thread | Five sequential briefs; 47 checked file citations; three reviewer checks passed | 84,992 ms | [run](python/run.json), [report](python/research-report.json), [transcript](python/conversation.txt) |
| TypeScript, subagents | Five briefs in parallel batches; 49 checked file citations; four reviewer checks passed | 132,851 ms | [run](subagents/run.json), [report](subagents/research-report.json), [transcript](subagents/conversation.txt) |

The main-thread runs explicitly disabled `multi_agent` in a scratch adapter while preserving authentication, model, capture and isolation settings.
The subagent run used the shipped adapter with actual general-purpose workers available.
The host rejected a fourth concurrent worker with `agent thread limit reached`, so documents, architecture and checks ran concurrently, followed by language and outside briefs on reused workers.
The ordinary Codex exec JSONL output omits delegation events.
The retained [parent trace](subagents/host-trace-1.jsonl) and three child traces preserve the relevant actual tool calls, outputs, delivered agent messages and completion timestamps from task-local session logs.
Configuration, developer prompts, world state and encrypted reasoning are excluded from these evidence excerpts.
Encrypted instruction arguments are labelled as omitted; delivered worker messages and read-only commands remain observable.
These traces independently establish overlapping workers, main-thread source verification and no worker writes or check execution.

All five entries use the same installed report schema and remain below their findings word limits.
The main thread opened every cited file, checked source support and ran the shipped citation checker before presenting observations.
The worker independently reran `cite-check` on each original scratch report and confirmed identical counts and no problems.
Each fixture's Git status remained empty after the run.
No target checks, live probes, unavailable audit helpers or project writes occurred.
Reports distinguish candidate source observations from unexecuted runtime behaviour and unsupplied measurements.

Web access was unavailable by an explicit author constraint, rather than an asserted operating-system network restriction.
Language-specific and outside recommendations say "not researched" with that reason, retain project evidence and import no language rule set.
No web source was opened, so web citations are empty.
The citation unit suite separately exercises URL/read-date metadata and explicitly does not claim remote verification.

Host paths, user names and session identifiers are redacted throughout committed artifacts.
Conversation hashes bind retained redacted bytes; deleted host sessions cannot resume from these snapshots.
The scoring records cite the captured conversation lines, with the additional delegation trace supporting subagent mode and read-only observations.
This checkpoint establishes T2.1 discovery, not a complete audit, selected recommendations, native check execution or protected apply.
