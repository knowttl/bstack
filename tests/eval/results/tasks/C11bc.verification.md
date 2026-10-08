# C11bc local verification

T2.2 and T2.3 follow the task evidence contract in docs/implementation-plan.md.
Before validation, README usage, the command contract, SKILL procedure and Progress reflect this slice.
Run the following against the final implementation commit and retain actual output beside the task records:

```sh
npm ci --ignore-scripts
npm ci --omit=dev --prefix skills/repo-audit
npm run check
npm test
npm test -- --task T2.2
npm test -- --task T2.3
```

Record sourceRevision, command exit codes, output paths, OS, Node, relevant tool versions, named acceptance tests and limitations in T2.2.json and T2.3.json.
Redact host paths and user names from committed output.
T2.2 verifies unchanged fixture and Git index fingerprints, exact missing-Git limitation, unborn and unreadable history, literal changes, manifest hashes and detected prerequisites.
T2.3 verifies py-ledger CONTRIBUTING equivalence, the ts-shop import stub candidate, equivalent document names and exact-byte hashes, absent documents, preserved nested scope, local-only shadowing and ancestor instructions outside the repo.
The commands never run project native checks or apply instruction edits.
Local Linux evidence does not establish Windows or macOS support.
Preserve .no-mistakes.yaml byte-identical and add no workflows.

Every pipeline fix round that changes source or tests reruns all six commands against its final implementation commit and refreshes both task records and output artifacts in the same round.
Keep sourceRevision bound to the tested implementation commit, and commit evidence separately to avoid a self-referential commit hash.
Fix all functional, correctness, coverage, style, simplification and design-principle findings within the configured two review repair rounds.
Only security-hardening or threat-model findings may be accepted without fixes.
No hosted CI exists, so run no-mistakes with --skip ci and report its local verification outcome.
