## Results

With `--json`, stdout contains exactly one JSON object:

```json
{"schemaVersion":1,"command":"contract-test","status":"passed","problems":[],"data":{},"inputs":{}}
```

| Status | Exit code | Meaning |
|---|---|---|
| `passed` | 0 | The requested operation passed |
| `failed` | 1 | Input data or a completed check failed |
| `blocked` | 2 | A prerequisite is missing or inaccessible |
| `usage-error` | 3 | Arguments or target-relative paths are invalid |

Each problem has `code`, `message`, `fix` and an optional `path`.
`data` contains the command's results and `inputs` identifies the target and relevant declared inputs.
Without `--json`, the command prints a short status summary and each problem's fix with the same exit code.
When `data.path` is present, plain output also prints that path after the status summary.
Child output must go to captured artifacts, never alongside the JSON envelope.
Child execution and fingerprints are implemented in C4b.
