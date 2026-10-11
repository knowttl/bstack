Use the approved [design](DESIGN.md) and public core interface.
Use the existing [glossary](glossary.md); Order means a purchase and Panel order means UI sequencing.
Start public-interface changes from [the approved quote example](packages/web/public.ts) and [checkout adapter](packages/web/ui.ts).
Run `npm ci` for setup, then `npm run check` for maintained types, boundaries, unit tests and the local HTTP journey.
Before each Node suite, verify at least 8 GiB available memory and disk, load below 36 and at most two host-wide Node suites including the proposed run.
For maintenance, follow DESIGN.md and `.bstack/project.json`, assess the explicit comparison base and every changed path, and preserve user edits.
Run `node .bstack/bin/bstack-check.mjs --repo . --base <base-commit> --assessment .bstack/assessment.json --json` with a reviewed portable assessment.
Repeat that checker freshly in a different-root clean clone with isolated home and cache.
The audit record is historical; current readiness and evidence belong in scratch.
