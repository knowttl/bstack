## Findings

`findings validate --findings <file> --json` requires an explicit `--repo` or draft-only `--workspace` target.
The [findings schema source](../../schemas/findings.schema.json) owns every field.
Complete [audit](../../../tests/inputs/findings-audit.json) and [foundation](../../../tests/inputs/findings-foundation.json) examples deliberately lack execution evidence and therefore cannot claim ready.
Replace their target placeholder with the resolved root and record the current full Git HEAD, or null for a repo without commits or a non-Git workspace.

The reviewed scope lists concrete target-relative file paths, including planned absent files, rather than directory names or globs.
Finding files and scope must be within that reviewed scope.
Each finding inherits the reviewed target and stated next change from the containing record.
Its fields state the problem, files or failing command, principle, consequence, fix, scope, verification, whether it blocks the next change, category, selection status, proposed-new-principle flag, resolution and source IDs.
Sources carry unique IDs, pointers, summaries and documented, observed or inferred intent.
Open and verify source citations using cite-check before relying on them.
These pointers identify evidence rather than duplicate authoritative principles.
The findings validator checks source joins, not the meaning of citations or their truth.
Unknown source IDs, duplicate joining IDs, paths outside scope and inconsistent selections fail validation.
Duplicate JSON member names at any depth, including escaped equivalents, and numbers that decode to nonfinite values also fail validation.
`selectedFindingIds` must match exactly the findings whose status is selected.
Selection authorises a proposed fix, while `resolved` records its observed completion or the owner's settled decision.
Rejecting a blocking finding does not resolve the block.
Proposed new principles appear separately for review and remain decisions needed while proposed.

Stage requirements are deliberately bounded:

| Stage | Mandatory outcomes | Meaning |
|---|---|---|
| audit | starting-checks | The observed current native checks establish the starting state for the stated next change |
| foundation | journey, foundation-review | The agreed important journey succeeds and review confirms that the selected foundation fits the approved project intent |

`requiredOutcomes` includes every stage requirement and any further outcome the approved scope needs.
For example, add a journey to audit readiness when the stated next change relies on that flow.
A foundation claim cannot substitute audit starting checks for its journey or review.
These stage requirements alone do not establish maintained enforcement, portable assessment or final release acceptance.

Validation returns the current fingerprint even when evidence is missing.
It hashes the real target root, reviewed revision, exact scoped file bytes and modes, including absence, and all substantive findings inputs except `execution`, using the T0.4 fingerprint contract.
Capture each approved outcome against that fingerprint with a unique record ID, outcome name, actual status, method, output artifact path and exact-byte SHA-256.
Artifact paths resolve from the invoking cwd and may be absolute scratch paths.
Keep artifacts outside the reviewed files so capturing them does not itself invalidate the reviewed state.
One current record per outcome prevents contradictory duplicate outcomes.
These commands read supplied observation records and artifacts without executing checks.
They do not prove that a supplied observation is truthful or that the chosen outcomes exhaust the user's requirements.
Automatic command capture is available through `run-checks` below.

Both stages use this verdict precedence:

1. Verification blocked if the Git revision differs, a required outcome is missing, or any supplied outcome failed, was blocked or skipped, has a stale fingerprint or has unavailable or changed artifact bytes.
2. Decisions needed if current verification passes but a decision or blocking finding remains unresolved, or a new principle is still proposed.
3. Ready for the stated next change only when every required outcome is current and passed and no such decision remains.

Nonblocking debt can remain visible without preventing readiness.
A failed journey always blocks, including when units passed or the journey was omitted from requiredOutcomes.
The assessment has one result and no score.
Malformed input fails with named problems and no writes.
Missing evidence is a valid input with a verification-blocked assessment, rather than a schema failure.
A completed readiness assessment uses command status `passed` with exit code 0 even when readiness is blocked or decisions are needed.
Read `data.result` and `data.reasons` to determine readiness.
`validate` writes nothing.
The audit record `docs/repo-audit.md` and its `render` command are dropped, so no findings command writes a report.
