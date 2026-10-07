# bstack

bstack helps developers establish project-specific guidelines, rules and checks for agents.
The approved [design](docs/design.md) defines the `repo-audit` first release, and the [implementation plan](docs/implementation-plan.md) tracks its build.

This checkout contains the T0.1 development skeleton.
The skill and installer are not built yet.
Nothing is published to npm.

Use Node 24 or later:

```sh
npm ci
npm run check
npm test
npm test -- --task T0.1
```

`check` currently runs the bootstrap checks for the manifest, lockfile and test discovery.
T0.5 replaces it with the skill package check.
`npm run eval` reports that evaluation is not built and exits 2 until T1.2.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.

Task evidence follows [the versioned schema](tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
