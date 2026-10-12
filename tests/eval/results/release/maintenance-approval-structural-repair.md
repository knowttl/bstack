# Structural assessment approval gate

The [repeated failure](maintenance-approval-repair-failure.md) read the corrected reference but applied the portable assessment in the same opening turn, without an owner reply.
The evaluation author authorized one targeted structural repair on 2026-10-12, followed by one fresh installed maintenance capture with the baseline unchanged.

Assessment previews now return an explicit `approvalRequired` instruction with the exact plan digest.
The human-readable preview ends with that instruction; JSON retains the same structured output envelope and includes the instruction in `data`.
Assessment apply requires `--approved-fingerprint` equal to the validated preview's `planDigest`, including on resume.
Missing or mismatched approval blocks every edit in the plan before project writes.
The digest already binds exact proposed bytes, findings, target revision and scope, so changed assessment inputs require a new approval.
Custom assessment paths are recognized from the existing evidence schema's required fields in original or proposed content; the conventional `.bstack/assessment.json` path is also protected when incomplete.
The help states that the fingerprint comes from the owner's approval reply for the exact preview.

The maintenance reference now separates preview, the end-of-turn stop, approved apply, and standalone validation.
Its preview step ends with “stop and wait for the owner”; its apply step begins only after owner approval.
The shared Write rules remain the authority for approval rather than treating the fingerprint as proof that a reply occurred.
The real-agent transcript must still demonstrate the owner reply before any target assessment write.

Focused public-command tests exercise the terminal preview instruction, structured digest, missing and wrong approval, exact approved apply and resume, changed record bytes, deletion at a custom path, and incomplete records at the conventional path.
They compare actual project snapshots to prove blocked plans make no project edits, including mixed assessment and implementation plans.
The standalone checker bundle is regenerated from its authored inputs because it includes the shared result formatter.
Scenario requests, author replies, scoring criteria, fixtures, adapter and pinned toolchain are unchanged by this repair.
No additional baseline run or unchanged-input retry is authorized by this step.

All seven focused approval tests pass.
The broader apply, child-contract, checker-generation and package regression run passes all 636 tests with no skips or failures.
`npm run check` passes package validation and canonical generated-checker freshness.
