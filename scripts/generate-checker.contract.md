## Standalone checker generation

`node scripts/generate-checker.ts --repo <target> [--check] [--json]` generates the C24a artifact from this checkout's shared validator sources.
Run `npm ci` in the source checkout first.
The pinned esbuild development dependency bundles Node ESM and embeds the imported JSON schemas.
The emitted file uses only Node built-ins and needs no skill folder or installed dependencies.
Its exported `buildVersion` records the package version, bundler version and a digest of source modules, schemas, generator and package manifests.
Changed source bytes invalidate freshness even when their bundled executable output would be equivalent.

With `--check`, generation stays in memory and compares exact bytes against `skills/maintenance/scripts/bstack-check.mjs` in the source checkout.
The command returns `passed` (exit 0) for current bytes or `failed` with problem code `stale-checker` (exit 1) for absent or different bytes.
It creates no scratch directory and changes neither source nor target.
`npm run check` runs this freshness gate after package validation.

Without `--check`, the command writes `bstack-check.mjs` and `checker-proposals.json` to ordinary bstack scratch outside the selected target.
The JSON result names `checkerPath`, `proposalsPath` and `proposedHash`; plain output names the proposal file.
Regeneration changes neither the target nor the canonical generated resource.
Review the returned bytes before updating the canonical resource during development.

Each installation proposal targets `.bstack/bin/bstack-check.mjs`, names its exact original and proposed hashes, and contains the complete UTF-8 bytes and diff.
An absent destination uses `create`; an existing destination uses `replace-file`; an identical destination produces no proposal.
The proposal alone is not permission to write.
Select its foundation finding and bind it to the reviewed change set, including resolved scope and findings and plan digests.
Use the existing `apply --plan <file> --dry-run`, then `apply --plan <file>` interface.
Apply validates the selected finding and exact bytes before writing; a destination changed since review survives with a non-passing result.
An existing user-edited checker requires review of its specific replacement, never unconditional overwrite by regeneration.

C24a exports `validateContract`, `checkDocuments`, `checkGeneratedFacts`, `validateEvidence` and `validateData` from the same sources as the skill commands.
`checkGeneratedFacts` always selects check mode and cannot create regeneration proposals.
The existing validators retain their coverage and proof limits, including generated commands' read-only contract and local evidence captures' lack of portable attestation.
C24b adds the aggregate execution interface below.
The [maintenance reference](../skills/maintenance/references/maintenance-contract.md) owns the bounded maintenance procedure.
Hosted CI behavior is unverified.
