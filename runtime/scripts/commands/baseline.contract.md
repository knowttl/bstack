`baseline check --repo <target> --baseline <repo-relative-file> --violations <file> [--json]` compares complete current normalized native diagnostics with `schemas/baseline.schema.json`.
Native adapters must preserve stable rule/path/key identities, and must not present setup failure or unavailable analysis as an empty violation list.
This command compares supplied data; it does not execute the native analysis.
The [baseline schema source](../../schemas/baseline.schema.json) owns the fields; each entry records a narrow reason and removal condition.
The baseline file must already exist; start with `{"schemaVersion":1,"entries":[]}` when no debt has been accepted.

The violation file is an array such as `[{"rule":"private-import","path":"src/app.py","key":"ledger._internal"}]`.
Duplicate identities, unknown fields, blank reasons and removal conditions, directory scopes and unsafe paths are rejected.
Missing source files are allowed because fixed debt may refer to a deleted file.
Existing debt remains visible in both plain and JSON output.
An unrecorded violation fails with `new-debt`; a fixed entry fails with `stale-debt` until removed.
`--refresh` removes fixed entries and keeps matching entries; any new debt prevents all writes.
Adding exactly one entry requires `--refresh --finding <id> --findings <file> --entry <file>`.
The entry file holds one complete baseline entry matching a current unrecorded violation.
Findings follow `schemas/findings.schema.json`, refer to the selected target and list that ID as a selected unresolved debt finding whose concrete scope includes the entry path.
The command rejects missing, unselected, resolved, out-of-scope or non-debt findings.
If other new debt remains, the refresh writes nothing even when the one entry is authorized.
Apply the selected native tool's own baseline or suppression mechanism instead when research finds one, retaining the same no-growth and removal requirements.
