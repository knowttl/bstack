## Check plans and capture

`run-checks --repo <path> --plan <file> [--phase before|after] [--prior-run <id>] [--json]` executes a plan from `schemas/check-plan.json`.
The phase defaults to `after`.
The plan file is caller-relative and can live outside the target.
Results are captured directly into a new scratch run, never imported from agent-written execution claims.

The plan names a `changeKind`: `feature`, `bug-fix`, `refactor` or `document-config`.
`acceptanceSources` name unique IDs, repo-relative source paths and exact-byte SHA-256 `contentHash` values.
Each acceptance case joins a source ID, gives a literal nonempty `pointer` found in that source, states the approved observable `outcome`, and declares whether it is a `userJourney`.
These pointers identify the agreed source rather than deriving expectations from the tested implementation.
The helper validates source existence, content freshness and pointer presence without claiming that it can assess the meaning of a requirement.
Acceptance changes require owner review and a new plan.

Each check has a unique ID, a child-command object, a `required` flag, acceptance case IDs, `inputScopes` and a `role`.
Roles are `outcome`, `reproduction`, `protection` and `compatibility`.
Scopes use the overlap command's glob syntax and discovery exclusions.
Literal paths also record absence, while glob scopes include newly added files on subsequent fingerprints.
Include the command's scripts, configuration, dependency locks and relevant product inputs in these scopes.
The plan and acceptance sources are always fingerprinted too.
The author owns the scope's completeness.
An optional `skipReason` records why execution cannot run, leaving the check and any affected user flow unverified.
All references, command objects, paths and scopes are validated before any check runs.
The scratch destination is created and validated before any version probe or check, and reused for the final artifact.

Before runs execute reproduction and protection checks.
After runs execute outcome, protection and compatibility checks, plus reproduction checks to confirm the bug now succeeds.
Each phase requires at least one active required check; otherwise preflight rejects the plan before any command executes.
A bug fix requires a scratch `before` run with a failed required reproduction that executed normally with a passing version probe, plus the same required reproduction passing after the change.
A refactor requires all required protective checks passing in a `before` run, plus at least one required compatibility check after the change.
Missing evidence blocks before execution.
Prior runs must belong to the same target and exact plan, precede the current run, and name a different original input state.
The recorded `originalState` is one fingerprint of the Git revision, check-plan bytes and presence, acceptance sources and the union of every declared product scope, including exact input hashes, presence and modes.
The same inputs are fingerprinted once after the run as `finalState`.
If that final snapshot cannot be read or validated, `finalState` is `null`; completed command evidence is still saved, and the capture is blocked with `inputs changed during run`.
Prior evidence requires a passing before capture with matching original and final fingerprints.
Execution order links prior capture to the after run.
Local scratch evidence is an execution record, not an authenticated portable attestation.

Every executed check records its command, version probe, exit code, output tails, timing and order within the capture.
Timeout, cancellation, unavailable tools and skipped checks cannot pass.
If the before and after fingerprints differ, the entire capture is `blocked` with `inputs changed during run`, every executed check becomes blocked, and its acceptance coverage is unverified.
This applies to optional and inactive checks' declared inputs as well as required checks in either phase.
There is no intermediate input tracking; changes restored before the final fingerprint are not detected.
Required checks must pass for a phase to pass, apart from the expected failing reproduction in a successful before bug-fix run.
That expected failure satisfies the reproduction prerequisite but still reports its acceptance outcome as failed, without claiming a verified user journey.
After captures also require passing coverage for every declared user journey: failed journeys fail the capture, and unverified journeys block it.
Per-case coverage lists executed evidence, failed outcomes and unverified flows.
A result covering no user journey explicitly says so, even when all required checks pass.
Human summaries include the run, readiness and coverage limits.
Outside dependencies require separate live probe evidence as described below.
