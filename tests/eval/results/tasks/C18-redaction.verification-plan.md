# C18 evidence redaction verification

Run `npm ci --ignore-scripts`, `npm ci --omit=dev --prefix skills/repo-audit`, `npm run check` and `npm test` against the final committed revision.
Quote command results in the PR body and identify the tested revision.
The synthetic listing test exercises capture through the real evaluation command, actual capture-time user and group names, session redaction, resume, close and later scoring.
Run the evaluation suite again when changing capture or closed-record persistence.

Scan every tracked file under `tests/eval/results` on origin/main, including historical task outputs, summaries, run records, conversation and scoring copies, generated project documents and board artifacts.
The initial scan covered 375 files.
Check local user and group names, Unix and Windows host paths, temporary scratch paths, and session or thread identifiers without printing the original names.
Inspect remaining UUIDs to distinguish host identifiers from evaluation run and scoring keys required by the evidence interface.
Verify the C18 conversation differs only by owner and group replacements, and its summary hash binds the resulting bytes.
Verify changed conversation hashes and retained scoring copies agree.
Preserve transcript line counts, commands, verdicts and citations.
Preserve `.no-mistakes.yaml` byte-identically and add no workflow files.

The PR body must state the public evidence leak, its consequence, capture-time and closed-record redaction, the scan scope and the forward fixes to historical evidence.
Do not rewrite history.
