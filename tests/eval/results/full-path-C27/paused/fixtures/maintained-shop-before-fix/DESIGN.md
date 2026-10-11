# Shop design

The UI never touches storage.
The agreed checkout total is 10.

User note: receipt wording remains a future owner decision.
User note: export remains outside this change.

## Public interface and checks

Web modules import core operations through packages/core/index.ts, never core/internal, including through aliases or re-exports. Core may use its own storage adapter. No storage-boundary exceptions are accepted.
Core dependencies remain acyclic; the native boundary analyzer already checks this and both helper exports must terminate. No cycle exceptions are accepted.
The controlled checkout HTTP fixture supplies 10 and checkout must return status 201 and total 10. The public quote remains 12; these are distinct checks. No new business discount is introduced.

The representative public-interface example is packages/web/public.ts: quote imports price from the core index. For a web extension, expose any necessary core operation through that index and consume it as this example does.
Run npm ci for setup and npm run check for strict TypeScript, native boundaries, unit tests and the local HTTP journey. No formatter, lint preset or hosted CI is selected.
The boundary analyzer resolves static top-level import/export declarations, paths and aliases and checks cycles. Dynamic imports and other unsupported dependency syntax require owner review and a separately selected analyzer extension before use. This check is not proof about deployed services.

## Maintenance contract

.bstack/project.json registers authoritative documents, scoped rules and native checks; .bstack/bin/bstack-check.mjs is the complete dependency-free standalone maintenance checker (Node 24+ and Git; npm ci prepares native TypeScript checks).
For a change, compare with an explicit ancestor commit, assess every mapped document and unmapped path, and retain literal source citations and the reasons for updates or no impact. Resolve decisions before dependent work; passing tests cannot settle owner intent.
Commit implementation before preparing .bstack/assessment.json; the portable assessment uses repo ".", names that implementation head and the explicit base, and is committed separately. Only that selected assessment may change afterwards. Obtain and bind the current validation fingerprint after substantive review.
Run node .bstack/bin/bstack-check.mjs --repo . --base <ancestor-commit> --assessment .bstack/assessment.json --json in the working checkout and in a different-root clean clone with isolated home/cache after npm ci. Each invocation must execute required leaves freshly. Reassess after input, base or policy changes.
Audit records assess state; DESIGN.md remains the design authority and glossary.md remains the vocabulary authority. Initial implementation, portable assessment and audit-record changes require their exact protected-write reviews. No hosted delivery gate is claimed.
