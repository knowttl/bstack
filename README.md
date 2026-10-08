# bstack

bstack helps developers establish project-specific guidelines, rules and checks for agents.
The approved [design](docs/design.md) defines the `repo-audit` first release, and the [implementation plan](docs/implementation-plan.md) tracks its build.

This checkout contains the T0.2 [skill skeleton](skills/repo-audit/SKILL.md) and the C4a/C4b shared library described in the [command contract](docs/command-contract.md).
Its body and bundled references are placeholders, and the planned audit commands and installer are not built yet.
Nothing is published to npm.

Use Node 24 or later:

```sh
npm ci
npm run check
npm test
npm test -- --task T0.1
npm test -- --task T0.2
npm test -- --task T0.3
npm test -- --task T0.4.C4a
npm test -- --task T0.4.C4b
```

`check` currently runs the bootstrap checks for the manifest, lockfile and test discovery, plus the skill skeleton checks.
T0.5 replaces it with the skill package check.
`npm run eval` reports that evaluation is not built and exits 2 until T1.2.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.
`npm test -- --task T0.4` selects the currently implemented shared-library tests.
See [task progress](docs/implementation-plan.md#progress) for the remaining slices.

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

To view the planned commands:

```sh
node skills/repo-audit/scripts/repo-audit.mjs --help
```

`--help` prints help and exits 0.
Missing or unsupported arguments print the same help and exit 3 (usage error).

Task evidence follows [the versioned schema](tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
