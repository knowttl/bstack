# Conditional-loading regression check

On 2026-10-10, fresh installer-backed Linux `clear-goals` fixtures reproduced and rechecked the conditional-loading failure.
The host was Codex CLI 0.162.1 with `gpt-6.1-sol`, medium reasoning and Node v24.17.0.
Each session received `$repo-audit` followed by the same recommendation-only readiness request, with no selected changes and scratch outside the fixture.
Subagents were disabled.
Command execution, output and exit status were observable; automatic loader telemetry was unavailable.
These observations establish command-visible reads only.

The initial run exited successfully but failed loading acceptance.
At transcript line 37 it ran:

```sh
rg -n 'scratch|TMPDIR|BSTACK|XDG' .agents/skills/repo-audit/references .agents/skills/repo-audit/SKILL.md .agents/skills/repo-audit/package.json
```

This exposed unrelated references while the approved vision, stack and terms were settled.
The first correction stopped the recursive search, but its verification still read `schemas/evidence.schema.json` without a change-maintenance task.
The final correction applies the loading conditions to content searches and limits schema reads to inputs for commands required by the current step.

## Final observed reads

| Resource | Transcript line | Applicable condition |
|---|---|---|
| `SKILL.md` | 5 | Explicit user invocation |
| `references/research-briefs.md` | 18 | Main-thread research |
| `schemas/research-report.json` | 18 | Preparing a citation report |
| `schemas/findings.schema.json` | 23 | Recording audit recommendations |
| `references/enforcement.md` | 23 | Recommending checks |

The final run executed inspect, inventory, measure, citation checking and findings validation/rendering and exited zero.
No recursive bundled-resource search, unrelated repo-audit reference/schema read, script-source read or board-asset read was observed.
The host independently opened `node_modules/lavish-axi/skills/lavish/SKILL.md` at line 21; this is dependency-skill guidance, separate from the repo-audit load table, and is recorded rather than omitted from the trace.
No Lavish script or board asset was read.
The final working-tree comparison reported the fixture unchanged.
Router, akashic and no-mistakes were absent from the child PATH and were not invoked.

Each run used a fresh 0700 home and state directory with only the authorized login copied for its turn.
The login was removed after the turn, and the entire disposable home, installed fixture and scratch were deleted afterward.
No credentials were printed or retained in evidence.
Redacted transcripts and installer/host records are retained as test-phase evidence using the prefixes `before-loading`, `after-loading` and `final-loading`.

| Captured bytes | SHA-256 |
|---|---|
| Initial installed `SKILL.md` | `da8985e4d1d824acf962542d083666159e127b7bfb1edb048987dc0c69175703` |
| Final installed `SKILL.md` | `804f050af4a100e000e29069512044be1c89a8b0f6651b86369c3630f7645ef8` |
| `before-loading-conversation.jsonl` | `5423969e5e228b37264de9c446941b5ca9e525b7560785f44f5b1fa8ba692faa` |
| `after-loading-conversation.jsonl` | `e708188adf05c24cfdda5247651bdd667cd7434a3ac6636ec367ae8bba7645f4` |
| `final-loading-conversation.jsonl` | `682cf366ed8aff8e767483e173930fcfd6f6b0432002e3448593e121c7233075` |

This targeted verification did not rerun plain invocation, the full suite or C27 acceptance.
The later [fresh paired validation](summary.md#fresh-paired-validation-on-current-bytes) supersedes it for current-byte invocation and command-visible loading observations.
