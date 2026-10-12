Use the approved [design](DESIGN.md) and public core interface.
Approved quantity extension: extend the quote example in `packages/web/public.ts` through `packages/core/index.ts` to accept a selected quantity defaulting to one, with `quote() = 12` and `quote(2) = 24`. Preserve the original quantity-one assertion, checkout total 10, original checkout journey and user note exactly. This scope was explicitly approved by the user's final checkpoint request.
Use [glossary.md](glossary.md) for Order and Panel order.
Run `npm run check` for maintained native verification; see DESIGN.md for acceptance cases, completion evidence and review limits.
Maintain `.bstack/project.json` and review every affected document and changed path. Run the complete standalone `.bstack/bin/bstack-check.mjs` with an explicit base and reviewed `.bstack/assessment.json`; see DESIGN.md for the maintenance procedure.
Treat `docs/repo-audit.md` as a historical snapshot; current assessed readiness belongs in scratch.
