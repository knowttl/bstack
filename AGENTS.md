# Working on bstack

Start with [docs/development.md](docs/development.md) for the checkout, validation and delivery gate, and the [design](docs/design.md) for requirements.
Read only the [design](docs/design.md) sections your task lists.

Set up and validate with the Node 24 command block in [README.md](README.md).
Iterate with `npm test -- --task <id>` from [tests/tasks.json](tests/tasks.json).

Tests drive the public commands as child processes against disposable fixtures ([conventions](docs/development.md#conventions)); reuse `tests/scripts/discovery-fixture.ts` and `tests/fixtures/build.ts`.
Take expected results from the design, plan or acceptance case, not from the implementation; TDD is not the default ([design "Verification requirements"](docs/design.md#verification-requirements)).

Write and review every test against the [test-quality rules](skills/verification/references/testing.md#test-quality-rules).
