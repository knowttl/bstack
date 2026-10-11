# Pantry design

## Local ownership

The app is a single local browser page with no account, application server or remote service.
TypeScript is compiled into one classic browser bundle, allowing index.html to open directly.
The bundle has no runtime dependencies.
A framework would add runtime and build conventions without improving this first journey.
The app stores one household’s named supplies and needed marks in local storage.
Browser storage is tied to the page location and browser profile; moving the page does not migrate data.
The initial supported browser is installed Google Chrome on Linux, exercised directly by the checks.

## Responsibilities and flow

src/pantry.ts is the public interface and owns item identity, needed-state transitions and a single session state.
src/private/storage.ts owns storage acquisition, format validation, loading and saving behind that interface.
src/ui/render.ts renders the public snapshot and forwards explicit add, needed and retry-save actions.
src/main.ts assembles the public pantry and UI.
The flow is browser action -> public pantry mutation -> private save attempt -> public snapshot -> DOM rendering.
Only the pantry controls the canonical session state; snapshots cannot mutate it.

## UI boundary

UI code imports only ../pantry.js, the public interface, and never private storage.
UI code never accesses localStorage directly, including bare, property and destructuring forms.
Browser rendering APIs such as document.createElement and window.requestAnimationFrame are permitted.
The native ESLint configuration is the executable source of these restrictions.
Static imports and exports are restricted; dynamic imports and require are rejected in UI code.
Computed runtime indirection, eval and malicious aliasing require review; these checks are not a sandbox.
There are no boundary exceptions in version one.
The rule protects visible saving status from bypasses and keeps persistence failures in one owner.

## Reliability and errors

Adding an empty trimmed name fails visibly without changing the item list.
Equivalent full names reuse the item and preserve its existing needed mark.
Distinct full supplied names remain separate items.
Needed means intention to buy, never a stock measurement.
Storage reads validate the saved array, names, duplicate identities and boolean marks.
If acquisition, parsing, loading or saving fails, the current session remains usable and displays an unsaved warning.
Only a successful save permits claiming that changes will survive reload.
Retry saving is an explicit local action; there is no remote fallback.
No runtime configuration or external service is required.

## Acceptance

Add Rice, mark it needed, view Rice on the shopping list, reload and retain it.
Re-add “ rice ” without creating a duplicate or clearing its needed mark.
Brown Rice and White Rice remain distinct full supplied names.
When saving throws, continued edits work and unsaved changes are visible; successful retry restores honest saved status and reload retention.
Valid browser rendering and public-interface imports pass the same native lint command that rejects private imports and direct storage access.

## Review standards and change locality

Accept changes against VISION.md and use GLOSSARY.md for domain meanings.
A shopping presentation change belongs to src/ui/render.ts and its browser cases.
A storage format change belongs to src/private/storage.ts and persistence cases; it must preserve the public interface or receive explicit review.
These two expected changes need no shared registry; their common contract is the public snapshot.
No measured co-change benefit is claimed because there is no project history.
Exceptions need an owner-approved reason, narrow scope and removal condition before implementation.
No existing debt baseline is needed because this is a new foundation.
Formatting, lint, strict type checks, public behaviour checks and actual browser checks are required through npm run check.
Checks establish the selected cases, while reviewers judge scope, meaning and new browser indirection.

## Maintenance

.bstack/project.json registers authoritative documents, rules, scopes, acceptance sources and the native check.
.bstack/bin/bstack-check.mjs is the installed dependency-free standalone checker, requiring Node 24 and Git but no installed skill.
For local review, use an explicit comparison base and the single reviewed .bstack/assessment.json record.
Commit implementation, collect portable evidence, assess every candidate and unmapped path with literal authoritative citations, bind the reviewed fingerprint, and commit the assessment separately.
Run the standalone checker in this checkout and a different-root clean clone with isolated home and cache.
Its required leaf is npm run check; development dependencies and installed Chrome remain native-check prerequisites.
No hosted CI, release or delivery service is selected.
