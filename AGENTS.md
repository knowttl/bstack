# Working on bstack

Start with ["Start here" in the implementation plan](docs/implementation-plan.md#start-here) for task selection, the evidence contract, when to stop and ask the owner, and conventions; ship through its [no-mistakes delivery gate](docs/implementation-plan.md#delivery-gate).
Read only the [design](docs/design.md) sections your task lists.

Set up and validate with the Node 24 command block in [README.md](README.md), which installs both the root and the `skills/repo-audit` runtime.
Iterate with `npm test -- --task <id>` from [tests/tasks.json](tests/tasks.json); run the full `npm test` before shipping.

Tests drive the public commands as child processes against disposable fixtures (plan ["Conventions"](docs/implementation-plan.md#conventions)); reuse `tests/scripts/discovery-fixture.mjs` and `tests/fixtures/build.mjs`.
Take expected results from the design, plan or acceptance case, not from the implementation; TDD is not the default ([design "Verification requirements"](docs/design.md#verification-requirements)).
