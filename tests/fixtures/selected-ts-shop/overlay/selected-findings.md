# Selected findings

The maintainer selected these findings after the existing-repo audit.
Selection approves the scope below; exact protected-write diffs still need approval.

- F-001: `journey.mjs` supplies price 12 from its controlled HTTP endpoint although `DESIGN.md` and the original journey assertion require checkout total 10.
  Correct that endpoint fixture to supply 10, preserve the total-10 assertion and keep the public quote at 12.
- F-002: `packages/web/ui.ts` imports private storage and `packages/web/alias.ts` bypasses the public core interface.
  Route both through `packages/core/index.ts` and preserve their quote behaviour.
- F-003: `packages/core/a.ts` and `packages/core/b.ts` form a cycle.
  Break it without inventing new business behaviour; the seeded recursion has no successful result to preserve.
- F-004: Keep native boundary enforcement scoped to the separate core and web packages, prove valid and violation controls, and include it in the maintained check command.

The selection does not authorize a full audit, a new vision, terminology changes, instruction consolidation or unrelated implementation.
