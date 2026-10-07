# Working on bstack

Read [docs/design.md](docs/design.md) for requirements and [docs/implementation-plan.md](docs/implementation-plan.md) for the build sequence and task evidence contract.

Use Node 24 or later and run `npm ci`, `npm run check` and `npm test`.
Select a registered task suite with `npm test -- --task <id>`.
`npm run eval` reports blocked until the evaluation runner is built in T1.2.
