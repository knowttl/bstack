Use the approved [design](DESIGN.md) and public core interface.
Use [glossary.md](glossary.md) for Order and Panel order.
Run `npm run check` for maintained native verification; see DESIGN.md for acceptance cases, completion evidence and review limits.
Maintain `.bstack/project.json` and review every affected document and changed path. Run the complete standalone `.bstack/bin/bstack-check.mjs` with an explicit base and reviewed `.bstack/assessment.json`; see DESIGN.md for the maintenance procedure.
Treat `docs/repo-audit.md` as a historical snapshot; current assessed readiness belongs in scratch.
