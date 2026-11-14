## Generated facts

```sh
node skills/maintenance/scripts/maintenance.mjs docs generate --repo <target> --check --json
node skills/maintenance/scripts/maintenance.mjs docs generate --repo <target> --json
```

Both forms load the project contract, with the same optional `--contract` override as `contract validate`.
Each registered generator's unique `id` is its marker ID, `outputPaths` names its documents, and `inputScopes` names its authoritative inputs.
Every output document must already contain exactly one corresponding section between `<!-- bstack:generated <id> -->` and `<!-- bstack:end -->`.
IDs used as markers are single tokens without whitespace or angle brackets.
Duplicate, nested, malformed and unmatched markers in those documents fail before commands execute.
The child command's stdout is the exact UTF-8 body between markers, including any leading or trailing newlines; no whitespace normalization occurs.
The same output fills that generator's section in each declared document.
Nonzero exits, unavailable tools, timeouts, cancellation, invalid UTF-8 and truncated output cannot establish freshness.

`--check` compares section bytes and fails with `stale-generated-section` for each stale section.
During each generator, including its version probe, the command watches every existing project directory for changes and snapshots project file bytes, modes, directories and link targets before and after execution, including ignored files but excluding Git metadata.
Project changes fail the generator's read-only contract in either form, including files created and removed or bytes changed and restored before execution finishes; the command does not undo the generator's changes.
Write detection does not provide an operating-system sandbox or prove that the generator reads only its declared inputs.

Without `--check`, complete proposed documents render only to scratch.
The result names `generated-proposals.json` and includes each changed document's original hash, proposed hash, complete replacement payload and exact diff.
Surrounding document bytes and marker comments remain unchanged.
These proposals do not authorize writes or select findings.
Bind chosen proposals to selected findings in a reviewed change set, review `apply --plan <file> --dry-run`, then use `apply --plan <file>`.
The existing protected apply contract still enforces finding selection, scope, original hashes, complete proposed bytes and the reviewed digest.
No separate regeneration write path bypasses those protections.
Human summaries and JSON results report structural proof limits.
