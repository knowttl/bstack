## Live probe pairs

`probe record --repo <path> --name <n> --phase before|after --spec <file> [--approved-by-user] [--json] -- <executable> [args...]` captures one live call in scratch `probe.json`.
The command after `--` is a literal argument array, with no shell interpolation.
All helper options precede that delimiter.
The [descriptor schema source](../../schemas/probe-spec.json) defines this input:

```json
{
  "schemaVersion": 1,
  "endpoint": "https://service.example.invalid/price",
  "environment": ["SERVICE_REGION"],
  "sideEffects": false,
  "assumption": "The checkout total is 10.",
  "inputScopes": ["src/**", "scripts/probe.mjs"],
  "cwd": ".",
  "versionArgs": ["--version"],
  "timeoutMs": 120000
}
```

Declare every environment key relevant to the call, including credentials or runtime selectors when they affect behaviour.
The capture records each declared key's actual value, with null for absence, while the child inherits the host environment.
The endpoint is declared identity, not an injected argument or proof of where the command connects.
The caller must select a command that probes that endpoint and asserts the agreed outcome.
A successful process alone does not prove an arbitrary printed result matches an assumption.
Nonzero outcome assertions fail the probe, including disagreement with a mock.
The helper captures tool version, exit code, output tails and timing through the shared child-command runner.

The [record schema source](../../schemas/probe-record.json) defines persisted fields.
Nested descriptors and command objects are validated against the descriptor and check-plan command schemas.
Records bind the target, name, literal command, endpoint, relevant environment, side-effect marker and assumption with a canonical SHA-256 call digest.
Side-effecting probes refuse before version or command execution without `--approved-by-user`.
Approval records the digest and unique run ID for that call, so a before approval cannot authorise an after call.
The flag asserts that the user approved this specific invocation.
The helper does not obtain approval itself.
Local scratch may contain sensitive environment values and command output, and is not a portable committed artifact.

Declared input scopes use the check-plan glob semantics.
Fingerprints record target identity, HEAD, declared file bytes and modes, descriptor bytes and call digest once before and once after execution.
Any difference blocks the capture with `inputs changed during run`.
Transient changes restored before the final fingerprint remain undetected.
Unavailable executables or versions, cancellation and timeout retain the reason and assumption with probe status `unverified` and envelope status `blocked` (exit 2).
Failed outcome assertions return `failed` (exit 1).
The scratch destination is validated before any command runs, and final snapshot failures retain execution evidence as blocked.

`probe compare --repo <path> --name <n> --before <run-id> --after <run-id> [--json]` verifies an outside dependency's pair.
Missing or unreadable captures fail, as do wrong names, targets or phases, reused runs, reversed execution order, unsuccessful probes, unmatched commands/endpoints/environments/descriptors or approval from a different call.
The after capture must still match current HEAD, descriptor bytes, declared input state and relevant environment.
The before and after product fingerprints may differ because the change occurs between probes.
No comparison invokes a command or writes the target.
Successful comparison returns `verified: true`, status `passed` and exit 0.
Every incomplete pair returns `verified: false`, status `failed` and exit 1 with named reasons.
Completion for a change depending on outside behaviour requires both check evidence and a successful comparison for every such dependency.
Automatic collection of those separate records belongs to the later evidence tasks.
