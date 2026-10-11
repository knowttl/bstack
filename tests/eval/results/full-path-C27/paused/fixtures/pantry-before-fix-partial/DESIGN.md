# Design

## Static household application

The browser owns the household session. There is no application backend, remote API, account or stock accounting. `src/main.ts` wires browser storage to the pantry session; `src/ui.ts` renders and handles controls. `src/pantry.ts` owns name reuse, needed choices and session persistence status behind a `Persistence` interface. `src/storage.ts` implements that interface and validates local data before accepting it. The domain has no browser dependency. UI uses the public pantry interface; storage details stay in the adapter and composition root.

UI input -> pantry operation -> current session -> persistence adapter -> local storage. Rendering reads copied item values and save status. A storage exception never rolls back session edits. Explicit retry saves the whole current session and clears unsaved status only on success. A failed or invalid load shows a warning and keeps saving blocked until the household explicitly retries, so startup never silently overwrites unreadable data.

## Acceptance

Add Rice, mark it needed, view Rice on the shopping list, reload and retain Rice and its needed choice after successful saving. Trimmed case-insensitive duplicate names reuse the existing item without resetting needed; Brown Rice and White Rice remain distinct. Empty names are rejected. Needed can be toggled independently of stock. Save failure keeps editing and shopping-list use available, visibly marks unsaved changes, and explicit retry retains the latest session once saving succeeds. Invalid stored data is reported rather than accepted or silently overwritten.

## Principles and review

- Local ownership: VISION.md owns this commitment. Review application changes for remote calls, accounts and stock accounting. No exception in version one; a changed boundary needs author approval.
- Cohesive responsibilities: this design owns the model/adapter/UI split because purchase meaning must remain independent of browser storage failures. ESLint forbids domain imports and UI access to storage; review other dependency changes. Only relative static imports are supported; aliases, re-exports and dynamic imports need a reviewed rule expansion and new proof. No private-import exception.
- Honest saving: VISION.md owns the usable-session and retention commitments. Native behaviour tests and the real browser journey exercise storage failure and recovery. No exception to clearing unsaved status only after successful saving.
- Checked inputs: local data is untrusted. Strict TypeScript and runtime adapter validation enforce item shape, trimmed unique names and boolean needed values. No silent coercion or discarded invalid data.
- One maintained command: `npm run check` owns format, lint, type, build, behaviour and browser checks with fail-fast composition. Configurations own their values; no duplicated rule engine. Exceptions require a scoped reason and removal condition reviewed against the vision.

A future change to purchase naming belongs in the model and its tests; a save-format change belongs in the adapter and its tests while preserving the Persistence contract. UI presentation changes should not require those owners to change. These are proposed locality benefits, not history measurements.

## Maintenance

The selected first maintenance contract is `.bstack/project.json` (foundation finding F-003). It maps implementation and tooling to the vision, glossary, design and guidance, with `npm run check` as its required native leaf. There are no generated documentation sections. Assess every mapped document and every unmapped path against the actual diff; a passing checker does not approve semantic claims. Commit implementation, collect a portable `.bstack/assessment.json` against an explicit ancestor, review and bind its fingerprint, then commit that assessment separately. The initial foundation uses an empty baseline commit, not an empty diff substituted for later work. Run `.bstack/bin/bstack-check.mjs` in the working tree and in a different-root clean clone with isolated home and cache. The checker is copied byte-for-byte from the complete installed package and requires only Node and Git; declared native leaf tools are installed by `npm ci`. Local author review owns selection and semantic approval. No hosted delivery integration is selected.
