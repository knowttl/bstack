# Shop design

The UI never touches storage.
The agreed checkout total is 10.

User note: receipt wording remains a future owner decision.

## Public core interface

Core owns price access, HTTP price retrieval, order totals and in-memory order storage.
Web consumers import only the public `@shop/core` entry point (`packages/core/index.ts`).
Private implementation remains under `packages/core/internal/`; UI modules never access it.
`packages/web/public.ts` is the approved public-interface example: `quote()` calls core `price()` and returns 12.
`packages/web/ui.ts` demonstrates checkout through core `servicePrice()` and `postOrder()` via the web route adapter.
The controlled journey endpoint supplies price 10; checkout returns status 201 and total 10.
The quantity calculation, including its existing bulk multiplier, is preserved; this audit introduces no pricing policy.

## Enforcement and review

The TypeScript-resolved static import/export graph must remain acyclic.
`boundaries.mjs` checks the web-to-core public-entry boundary, path aliases and cycles across the analyzed packages.
Core implementation may import its own private modules; that is a permitted dependency direction.
No exceptions are accepted. Dynamic imports and runtime dependency edges are outside this static check's coverage.
Run `npm run check` for types, boundaries, unit behavior and the real local HTTP checkout journey.
Review new responsibilities and interface changes against this design; passing static checks alone does not approve a design change.

## Maintenance

`.bstack/project.json` registers these authoritative sources and the maintained check.
Use an explicit Git comparison base and assess every changed path, including unmapped paths, against the design and glossary.
Keep a portable change-specific assessment at `.bstack/assessment.json`; routine maintenance uses the current diff and these sources without repeating a goal interview or full audit.
Run the standalone checker with the same base and assessment in the working checkout and a different-root clean clone with isolated home and cache.
A failed or stale required check blocks readiness. Saved successes never replace fresh checker execution.
`docs/repo-audit.md` is a historical snapshot bound to its observed revision, not a live readiness authority.
Keep current-head findings and readiness evidence in scratch; do not rewrite the historical snapshot after each checker run.
