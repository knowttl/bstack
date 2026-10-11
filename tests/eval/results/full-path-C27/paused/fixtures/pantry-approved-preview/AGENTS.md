# Project guidance

Read [VISION.md](VISION.md), [GLOSSARY.md](GLOSSARY.md) and [DESIGN.md](DESIGN.md) before changes.
Follow [README.md](README.md) for setup and commands.
Use the public pantry interface from UI code; the native ESLint configuration owns restrictions.
Run `npm run check` for formatting, lint, strict types, public behaviour and actual browser checks.
Use `.bstack/project.json` and the explicit reviewed assessment for change maintenance.
Run `node .bstack/bin/bstack-check.mjs --repo . --base <base> --assessment .bstack/assessment.json --json` after the assessment is reviewed and committed.
Keep actual browser evidence and required resource checks fresh.
