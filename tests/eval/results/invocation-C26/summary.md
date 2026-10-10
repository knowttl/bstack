# C26: current-agent invocation and loading

The final installed runs passed the bounded T4.2 checks on Linux with Codex CLI 0.162.1, `gpt-6.1-sol`, medium reasoning and Node v24.17.0.
The C26 implementation worker reviewed the captured command events and scored the bounded observations below against T4.2 and the cited design cases.
These are development observations, not C27 full-path acceptance, final case selections or a host/model matrix.

## Installation and isolation

Each run built a new `clear-goals` fixture through `node tests/fixtures/build.mjs clear-goals` and created a separate private home, empty `.codex` state and cache.
The actual installer command was `node install/install.mjs --scope project --project <fixture> --host agents --json`, with the child's home and cache set to that run's disposable directories.
The installer returned exit 0, copied 73 authored files and verified its pinned runtime.
The capture procedure checked each installed authored file against both its recorded ownership hash and the source checkout, then checked the authored snapshot again after the host turn.
The final implicit and explicit snapshots both have SHA-256 `30eae6c2b9ed7da8b7eac72b7048e86a971cfdec7890bd5d0ef0fbefe6900438`.
Both installed `SKILL.md` files and the final source file have SHA-256 `da8985e4d1d824acf962542d083666159e127b7bfb1edb048987dc0c69175703`.
The installer truthfully labels this an untagged dirty development checkout based on `9dba001cd8f7cdeaab18bb7c3dcd455f0bb2843f`, including the uncommitted C26 changes and generated evidence.

The capture reused the existing fixture builder, adapter parser, isolation setup, child-command runner and evidence redactor.
Unlike the existing evaluation adapter's direct staging copy, this procedure exercised the project installer and inventoried the installed authored tree.
Runtime `node_modules` was excluded from authored discovery/snapshot traversal because its executable symlinks are expected installer output.
The installer independently verified the runtime; its output is retained rather than treating excluded runtime files as authored-file verification.
The authored discovery inventory found only repo-audit, but that is not a complete host skill catalog: the plain host also discovered and opened the Lavish skill bundled inside the runtime dependency.
No globally installed support skills were copied into the isolated home.

The owner-authorized authentication exception copied only the existing Codex login into the empty private state, set its mode to 0600, and deleted it in `finally` after each turn.
The home mode was set to 0700 by the existing isolation setup.
The final turns received an environment containing only the isolated home/state/cache locations, PATH, SHELL and LANG, with no other inherited credentials or service settings.
Entire homes and fixtures were removed after capture, including failure cleanup.
The same fresh opening command was used for each run, with no resume/session reuse:

```text
codex --no-daemon exec --disable multi_agent --json --ignore-user-config --ignore-rules --skip-git-repo-check --model gpt-6.1-sol --sandbox danger-full-access -c model_reasoning_effort="medium" <message>
```

The final child PATH contained the Node tool directory, system/Nix tools and no local agent-tool directory; Codex itself was selected by its absolute executable path.
The [implicit](implicit/support-tools.json) and [explicit](explicit/support-tools.json) probes each executed `command -v` under that environment and recorded router, akashic and no-mistakes unavailable.
Neither final trace invokes any of those tools.
This establishes their absence as required runtime dependencies in these runs, while bstack's own delivery still uses no-mistakes separately.

## Host capabilities and limits

The actual host exposed terminal command execution with commands, captured output and exit status, file-change events, and web-open/find events.
The explicit trace records actual Node documentation lookups; capability claims in a model-written report are not used as evidence.
Subagents were disabled explicitly for these bounded sessions, and the explicit host performed research in its main thread.
No browser interaction or board feedback was exercised or credited.
Codex JSONL exposes command-driven file reads but does not supply comprehensive startup-loader telemetry.
The loading verdict below covers observed commands and their output, with no inferred automatic loading trace.
The host warned that temporary CODEX_HOME prevents creation of PATH aliases; both final turns nevertheless completed with exit 0 and no truncation or timeout.

## Invocation observations

The [final plain transcript](implicit/conversation.txt) begins with exactly `audit this repo` and records a fresh thread.
At line 21 it reads `SKILL.md` as repository content alongside ordinary repository inspection.
It never executes a bundled repo-audit command or opens a repo-audit reference or schema in the captured command trace.
It performs its own ordinary document audit and independently uses the runtime's Lavish skill, including creating `.lavish/repo-audit.html` (file-change event at lines 23-24).
Accordingly, this plain run did change its disposable fixture; it does not establish a general read-only audit guarantee.
It closes its own Lavish session at line 32, and its fixture and home were removed afterward.
The entry guard prevents running the repo-audit procedure in this observation; it does not prevent the host from reading the file during an ordinary audit.

The [final explicit transcript](explicit/conversation.txt) begins with `$repo-audit` followed by the recommendation-only request.
At line 10 it opens `SKILL.md`, then executes the installed `inspect` and `inventory` commands at lines 12 and 14.
It performs main-thread research, citation checking, measurement, findings validation and rendering through installed commands, then presents project-specific recommendations at line 46.
The fixture's complete authored snapshot, including its Git state and installed authored skill files, was unchanged.
The document-only fixture has no application or native starting checks, so the host's product-readiness verdict remains verification blocked; successful skill invocation is not a successful product journey.

## Observed explicit file opens

Line numbers below are one-based lines of the retained redacted JSONL transcript, not guessed from the final answer.
Project documents, generated scratch results and command output are distinguished from bundled resources.

| Opened resource | Trace line | Condition that applied |
|---|---|---|
| `SKILL.md` | 10 | The user explicitly invoked `$repo-audit`. |
| `references/research-briefs.md` | 18 | Running research in the main thread. |
| `schemas/research-report.json` | 18 | Preparing a research report for citation checking. |
| `references/enforcement.md` | 20 | Recommending principles and their checks. |
| `schemas/findings.schema.json` | 20 | Recording and validating audit recommendations. |
| Project `VISION.md`, `DESIGN.md`, `glossary.md` | 18, 22 | Existing-repo discovery of the authoritative approved documents. |
| Generated measurement, citation, validation and rendered audit outputs | 31, 37, 39, 41, 43, 45 | Reading command results and the generated recommendations, rather than loading bundled source. |

The complete command trace contains no bundled script-source read or board-asset read.
It runs scripts through Node and reads their results.
It does not open vision, interview, grilling, domain-language, architecture or maintenance references in this bounded audit.
The exact opened schema conditions are now explicit rows in the shipped load-when table.
No schema or reference absence is inferred from a compliant prose answer.

## Retained attempts and correction

The [prehost snapshot attempt](prehost-snapshot-attempt/observations.json) stopped after successful installation because the task-local snapshot walker rejected a runtime executable symlink.
No model turn or login copy occurred in that attempt; the failed home and fixture were cleaned.
The capture procedure was corrected to separate authored-file verification from the installer's runtime verification.

The [first plain run](implicit-before-guard/conversation.txt) failed AC-42: without an explicit command it read `SKILL.md` at line 17, executed bundled inspect at line 20, and opened research, architecture and enforcement guidance at lines 24 and 36.
The [pre-guard explicit run](explicit-before-guard/conversation.txt) separately demonstrated explicit invocation but is historical evidence only.
The skill now explicitly requires the user's host command or menu selection and treats incidental discovery during an ordinary audit as repository content, rather than permission to execute the procedure.
The [guard checkpoint](implicit-guard-check/conversation.txt) stopped procedure execution after opening the guarded skill, with no bundled command/reference use and an unchanged fixture.
The final plain and explicit runs above both used the settled skill bytes, including the two schema load conditions; earlier attempts are not promoted into that final pair.

All turns used distinct disposable fixtures, homes and fresh host threads.
Transcript identifiers and host paths are redacted, while captured command events and line numbers are retained.
Plain-session Lavish work is an observed host behavior, not bstack board execution or a required additional skill installation.
Post-run process inspection found no task-created Codex, fixture-home or Lavish process remaining, and task-created homes/caches/fixtures were removed.
No release, tag, publication, hosted workflow, C27 full path or Windows/macOS execution was performed.
