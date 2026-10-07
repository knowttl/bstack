# bstack

bstack helps developers establish project-specific guidelines, rules and checks for agents.
The approved [design](docs/design.md) defines the `repo-audit` first release, and the [implementation plan](docs/implementation-plan.md) tracks its build.

This checkout contains the T0.2 [skill skeleton](skills/repo-audit/SKILL.md).
Its body and bundled references are placeholders, and the planned audit commands and installer are not built yet.
Nothing is published to npm.

Use Node 24 or later:

```sh
npm ci
npm run check
npm test
npm test -- --task T0.1
npm test -- --task T0.2
```

`check` currently runs the bootstrap checks for the manifest, lockfile and test discovery, plus the skill skeleton checks.
T0.5 replaces it with the skill package check.
`npm run eval` reports that evaluation is not built and exits 2 until T1.2.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.

To view the planned commands:

```sh
node skills/repo-audit/scripts/repo-audit.mjs --help
```

`--help` prints help and exits 0.
Missing or unsupported arguments print the same help and exit 3 (usage error).

Task evidence follows [the versioned schema](tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
