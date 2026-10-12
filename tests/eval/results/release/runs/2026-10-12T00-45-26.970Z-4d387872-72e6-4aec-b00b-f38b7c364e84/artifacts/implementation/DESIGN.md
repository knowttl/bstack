# Shop design

The UI never touches storage.
The agreed checkout total is 10.

User note: receipt wording remains a future owner decision.

## Interfaces and native rules

Web consumers import core capabilities through `packages/core/index.ts`; storage stays in `packages/core/internal`. Core may use its own internals. Static import and re-export dependencies must be acyclic. These boundaries protect the approved separation of UI and storage; `boundaries.mjs` resolves TypeScript paths, including aliases, and rejects private web imports and cycles. No boundary exceptions are selected. Dynamic imports and runtime loading are outside this check and require review.

`packages/web/public.ts` is the approved representative public-interface quote example: it imports `price` from `../core/index.ts` and exposes `quote(quantity = 1)` for a selected quantity. Quote remains 12. The approved outcomes are `quote() = 12` and `quote(2) = 24`, multiplying the public core price by the selected quantity. The controlled local HTTP endpoint in `journey.mjs` supplies 10; checkout must return `{ status: 201, total: 10 }` for the default quantity. `unit.test.mjs` preserves the original quantity-one quote assertion, protects quantity two and mocked checkout, while the journey observes a real loopback HTTP exchange. This fixture correction introduces no business pricing rule or discount.

## Completing and maintaining a change

Run Node 24 or later and `npm ci`, then `npm run check` for types, units, boundaries and the HTTP journey. Acceptance cases live in this design and their executable checks in `unit.test.mjs` and `journey.mjs`. A change is complete when affected journeys and required checks pass on the final inputs; passing units alone does not establish completion.

Review changes against this design and `glossary.md`, preserving public interfaces and agreed outcomes. Assess every changed path and every affected authoritative document against the actual diff, including unknown paths. Non-mechanical review must explain responsibilities, acceptance effects and any limits. No universal development sequence is required. Intent changes or exceptions require owner approval of their reason, narrow scope and removal condition before dependent work.

The maintained contract is `.bstack/project.json`. After committing implementation, collect and review the portable `.bstack/assessment.json` against an explicit ancestor base, then commit the assessment separately. Run `node .bstack/bin/bstack-check.mjs --repo . --base <ancestor-commit> --assessment .bstack/assessment.json --json` locally and in a clean checkout with isolated home/cache. The complete standalone checker needs only Node and Git in addition to the repo's installed native development dependencies; it runs each distinct required leaf freshly and validates coverage and reviewed source bytes. Saved passing results cannot replace that execution. Contract/checker changes also require previous-policy coverage; first installation needs the explicitly selected foundation finding.

`docs/repo-audit.md` is a historical assessed snapshot naming its observed revision, not a live readiness authority. Keep final current-head findings, checker results and readiness in scratch; do not rewrite the historical snapshot after each checker run. Receipt wording remains a future owner decision.
