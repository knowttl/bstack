# Pantry list

A local household pantry and shopping list. No account or application server.

## Setup and use

Require Linux, Node 24 or later, npm, Git and Google Chrome on PATH as google-chrome.
Run `npm ci`, then `npm run build`, and open index.html in Chrome.
Add Rice, mark it needed, open Shopping list, and reload to retain it after successful saving.
Keep the page location and browser profile stable for local storage.
When saving fails, the page keeps session work and labels it unsaved; use Retry saving when storage works again.

## Checks

`npm run check` runs resource verification, formatting, native lint, strict TypeScript checks, bundle build, public behaviour tests and real browser tests.
`npm run journey` runs resource verification, build and real browser tests.
`npm run lint` runs only resource verification and native boundary/general lint.
`npm run format` formats maintained source and guidance; the installed checker and package lock retain original bytes.
Before each Node suite, the Linux resource guard requires at least 8 GB available memory and disk, load below 36 and at most two host-wide suites including this run.
Tests run against a fresh disposable Chrome profile and the actual local page, without a web server.
Each browser run captures JSON observations and screenshots in a unique scratch directory and prints its path.
The checks do not establish compatibility with other browsers or every reflective runtime storage bypass.

## Authority and maintenance

[VISION.md](VISION.md) owns purpose and non-goals, [GLOSSARY.md](GLOSSARY.md) domain meaning, and [DESIGN.md](DESIGN.md) responsibilities and review expectations.
The native tool configurations own executable settings.
.bstack/project.json maps change paths to these sources and npm run check.
The unchanged installed standalone checker runs with `node .bstack/bin/bstack-check.mjs --repo . --base <base> --assessment .bstack/assessment.json --json`.
Create a change-specific portable assessment against an explicit ancestor, review its semantic claims and exact fingerprint, commit it separately, and run the checker in this checkout and a fresh different-root clone with isolated home/cache.
There is no selected hosted CI or delivery service.
