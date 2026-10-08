# bstack

bstack helps developers establish project-specific guidelines, rules and checks for agents.
The approved [design](docs/design.md) defines the `repo-audit` first release, and the [implementation plan](docs/implementation-plan.md) tracks its build.

This checkout contains the T0.2 [skill skeleton](skills/repo-audit/SKILL.md) and the completed T0.4 shared library described in the [command contract](docs/command-contract.md).
Its body and bundled references are placeholders, and the planned audit commands and installer are not built yet.
Nothing is published to npm.

Use Node 24 or later:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm test -- --task T0.1
npm test -- --task T0.2
npm test -- --task T0.3
npm test -- --task T0.4.C4a
npm test -- --task T0.4.C4b
npm test -- --task T0.4.C4c
npm test -- --task T0.5.C5a
npm test -- --task T0.5.C5b
npm test -- --task T0.6
npm test -- --task T1.1
node scripts/check-package.mjs --skill skills/repo-audit
```

`check` runs the package checks for user-only metadata, local resource paths, reference loading, line limits, literal script imports, top-level constant comments, step completion lines and bundled language policy.
It reports every detected problem with a stable rule code and exits 1 on failure.
See the [package check contract](docs/command-contract.md#package-check) for exact syntax and limits.
Local validation runs the install, package check and full tests on Node 24 and Node 26.
The no-mistakes gate installs once, runs tests once and runs the distinct package check through `commands.lint`.
Recorded runs on Linux do not prove support on Windows or macOS.
`npm run eval` reports that evaluation is not built and exits 2 until T1.2.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.
`npm test -- --task T0.4` selects the currently implemented shared-library tests.
`npm test -- --task T0.5` selects the currently implemented package-check tests.
See [task progress](docs/implementation-plan.md#progress) for the remaining slices.

Build isolated fixture workspaces with Node 24 or later and Git.
Native fixtures also require npm, Python 3.12 and uv, with fixture-local TypeScript and Ruff locks:

```sh
node tests/fixtures/build.mjs --all
node tests/fixtures/build.mjs clear-goals
node tests/fixtures/build.mjs ts-rule-proof-alias
node tests/fixtures/build.mjs py-rule-proof-cycle
```

The builder prints one JSON line per fixture with its `name`, absolute temporary `path` and `kind` (`idea` or `repo`) after its sanity check passes.
The caller owns removal of the printed temporary folders.
T1.1 includes the two native stacks, clean boundary proofs, independent private/alias/cycle seeds, dirty work, refactors, contract removal, shallow history and installer collisions.
Missing native tools exit 2 as blocked.
See the [fixture contract](docs/fixtures.md) for sources and sanity commands.

Raw upstream development sources are committed outside the installed skill.
[The manifest](upstream/sources.json) owns their exact pins and copied paths, and [NOTICE](NOTICE) records adaptations.
To refresh the copies or verify them against their pinned remote bytes:

```sh
node upstream/fetch.mjs
node upstream/fetch.mjs --check
```

Both commands require network access and exit 1 if a listed remote file is missing or unavailable.
Fetching replaces local copies only after every listed remote file downloads successfully.
`--check` writes nothing and also exits 1 for missing or modified local copies.

To view the available and planned commands:

```sh
node skills/repo-audit/scripts/repo-audit.mjs --help
```

`--help` prints help and exits 0.
No arguments print the same help and exit 3 (usage error).
Unsupported commands or arguments report problems using the [result contract](docs/command-contract.md#results).

To exercise the read-only shared contract test from this checkout:

```sh
node skills/repo-audit/scripts/repo-audit.mjs contract-test --workspace . --input tests/inputs/schema-valid.json --json
node skills/repo-audit/scripts/repo-audit.mjs contract-test --help
```

See the [public test command contract](docs/command-contract.md#c4c-public-test-command) for input and schema validation details.

Task evidence follows [the versioned schema](tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
