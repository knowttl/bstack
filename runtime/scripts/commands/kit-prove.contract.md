`kit prove --repo <path> --app <name> --feature <id>` runs the applied kit's `kit.json` once, replacing `{port}`, `{runDir}` and `{evidenceDir}` in commands.
`{runDir}` is a fresh directory in the OS temporary folder; `{evidenceDir}` is a per-run directory under the kit's repo-relative evidence directory.
It launches without a shell in its own process group, waits for the declared readiness, runs doctor and then each step of the feature, writing `<evidence directory>/<run id>/<feature>.json` with every command, exit code and output.
A step passes when it exits 0, its complete stdout matches the step's `match` pattern and each declared artifact exists.
Output readiness matches the complete launch stdout followed by stderr.
Only the recorded stdout and stderr previews are bounded to their last 65,536 characters; matching uses the complete streams.
Cleanup always stops the launched process group, runs the optional cleanup command and removes the run directory, then confirms the evidence files are byte-identical to before cleanup.
After confirming survival, it updates the proof record with the launch termination and cleanup command results.
The proof-record filename is reserved before commands run; colliding artifacts fail with `evidence-collision` and are never overwritten by the recorder.
A failed proof exits 1 with the first failure code: `launch-exited`, `launch-not-ready`, `doctor-failed`, `step-failed`, `step-mismatch`, `artifact-missing`, `cleanup-failed` or `evidence-lost`; it still cleans up and keeps its evidence.
An unreadable kit blocks with `kit-unavailable` and an unknown feature is a usage error naming the available features.
Passing and failed proof results carry `data.runId`, `data.evidenceDirectory`, each evidence file with its SHA-256 and each executed step's exit code.
