# Release evaluation review decisions

On 2026-10-12, the maintainer explicitly authorized the provisioning flow for R2, review-2 and review-3 in PR 5.
Scenarios declare their starting fixtures: final-repeat-audit, final-independent-extension and final-maintained-maintenance use the existing maintained ts-shop overlay, built fresh per run with maintained guidance and required user notes.
Scenarios may declare mode constraints, and final-independent-extension keeps repo-audit undiscoverable even when the batch requests `--mode with`.
Only fake-host verification is authorized for this change; no real agent runs are authorized.
The maintainer also approved ordered manual reply delivery after completed turns for R6 and serialized persistence of the private fixture inventory before run closure for R5.

## Verification skill ownership deferral, 2026-10-13

On 2026-10-13, the maintainer paused all repo-audit changes until he approves a new repo-audit split design.
R7, review-1 and review-2 are explicitly deferred, rather than fixed: removing test-auditing content from repo-audit belongs to that held piece.
Until then, the verification skill owns test auditing and repo-audit retains its existing copy.
This review makes no changes to repo-audit content.

### Note for the PR body

The maintainer explicitly deferred the repo-audit test-auditing content removal on 2026-10-13 pending approval of a new repo-audit split design.
Verification owns test auditing; repo-audit retains its copy during the pause.
