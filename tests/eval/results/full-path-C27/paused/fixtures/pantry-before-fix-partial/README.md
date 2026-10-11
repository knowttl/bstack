# Pantry list

A local household pantry list. Add a named supply and mark it needed to see it on the shopping list. There are no quantities, stock levels, accounts or remote services.

## Setup and use

Use Node 24 or later, npm, Git and installed Google Chrome. Run `npm ci`, then `npm run build` and `npm start`. Open http://127.0.0.1:4173. The loopback server serves static development files only; the application runs in the browser without a backend. Keep the same origin for retained data. Clearing site data removes the household list. File URLs are not the supported persistence origin. No external request is needed by the application.

## Checks

`npm run check` runs formatting, lint, strict types, build, public behaviour tests and the actual Chrome journey. `npm run journey` observes the Rice journey, duplicate names, named variants, save failure, continued editing and retry in a disposable browser context. It prints observations and browser versions. `npm run format` formats maintained code and configs; the approved vision's exact bytes are preserved. Tool versions and dependency resolution are pinned in package-lock.json. No CI is configured.

## Maintenance verification

Read [DESIGN.md](DESIGN.md#maintenance) and `.bstack/project.json`. The selected installed dependency-free checker is `.bstack/bin/bstack-check.mjs`. Given a reviewed committed `.bstack/assessment.json`, run `node .bstack/bin/bstack-check.mjs --repo . --base BASE_COMMIT --assessment .bstack/assessment.json --json`. It invokes required native leaves afresh; install their pinned dev tools with `npm ci`. Run the same command in a clean clone at another root with isolated home/cache. Retain the returned checker-result.json and command captures locally. The assessment and semantic review remain explicit; no agent installation, hosted CI or delivery service is required by the resulting checkout.
