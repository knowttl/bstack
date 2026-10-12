Historical (v0.1.0): the per-run independent-verification.json files cited below were removed when machine assertions replaced them.

# Repeated maintenance approval failure

One fresh installed capture and one fresh baseline were started after the authorized reference correction and added exact-record approval replies.
Both bind source `27ca53dc4e1fe2dd2bd638bf470216326d2a9f96`, the unchanged fixture revision, scoring criteria, model, adapter and toolchain.
The installed run still writes the assessment before any owner reply.
Neither run is scored, and neither establishes final acceptance for AC-17 or AC-23.
The complete maintained path required by AC-75 cannot waive this approval failure.

## Installed evidence

The [captured opening](runs/2026-10-12T04-07-52.088Z-fa4f07ef-1bf8-4650-9963-5f543c431b69/conversation.txt) contains only the initial user request; no scripted reply was consumed.
Line 9 reads the updated maintenance reference, including scratch preparation and the link to the shared Write rules.
Line 11 reads SKILL.md, which contains the unchanged separate exact-approval requirement.
Original-state protection and compatibility checks pass before the implementation commit `61c5b92cdd3a221fc00836697915e54767a96511`.
The route names the intermediate value while preserving quote 12 and checkout total 10.

Line 40 prepares a scratch preview checkout and obtains its review fingerprint, as the corrected reference describes.
Line 42 then constructs the target assessment plan, runs its dry-run preview, and immediately applies it without returning for owner approval.
The captured output explicitly reports `assessment-apply passed`.
The [actual plan](runs/2026-10-12T04-07-52.088Z-fa4f07ef-1bf8-4650-9963-5f543c431b69/artifacts/interrupted/tmp/ts-shop-maintenance/assessment-plan.json) creates `.bstack/assessment.json` with `originalHash: null`.
Line 44 refreshes and applies the target assessment again, also without approval.
The new exact-assessment approval reply remains unused.

Final validation reports stale execution because the earlier check capture predates the implementation commit; the attempted fresh recapture fails its load preflight.
Fresh final local and clean-clone standalone checker results remain pending.
These partial native outcomes do not establish final completion.
The independent verification (removed file: runs/2026-10-12T04-07-52.088Z-fa4f07ef-1bf8-4650-9963-5f543c431b69/artifacts/independent-verification.json) cross-checks the actual create plan, captured successful apply, absence of approval replies, target assessment bytes, preserved tracked authorities and native export hashes.

## Stop and preservation

After detecting the repeated pre-approval write, both exact task-owned containers were stopped, with parent-process provenance and isolated mounts checked first.
Fifty-two installed and twenty-one baseline native files were preserved immediately before the stop.
Their [installed export manifest](runs/2026-10-12T04-07-52.088Z-fa4f07ef-1bf8-4650-9963-5f543c431b69/artifacts/export-manifest.json) and [baseline export manifest](runs/2026-10-12T04-07-52.088Z-d5865a6d-5ca3-43b9-8bbf-63b9335ad381/artifacts/export-manifest.json) retain original and published hashes with the interruption limitation.
The [baseline transcript](runs/2026-10-12T04-07-52.088Z-d5865a6d-5ca3-43b9-8bbf-63b9335ad381/conversation.txt) includes its opening and original unchanged-pricing reply; its new assessment approval reply was not sent.
Both evaluators recorded the intentional host interruption as exit 137, retained their transcripts, removed their containers and cleaned their isolated login homes.
This interruption was initiated after the approval failure; it was not a model timeout or a successful final-stage completion.
No additional reply, skill change, unchanged-input retry or acceptance waiver was made.
Further remediation requires a decision.
