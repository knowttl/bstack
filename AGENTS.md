# Working on bstack

Start with ["Start here" in the implementation plan](docs/implementation-plan.md#start-here) for task selection, the evidence contract, when to stop and ask the owner, and conventions; ship through its [no-mistakes delivery gate](docs/implementation-plan.md#delivery-gate).
Read only the [design](docs/design.md) sections your task lists.

Set up and validate with the Node 24 command block in [README.md](README.md).
Iterate with `npm test -- --task <id>` from [tests/tasks.json](tests/tasks.json).

Tests drive the public commands as child processes against disposable fixtures (plan ["Conventions"](docs/implementation-plan.md#conventions)); reuse `tests/scripts/discovery-fixture.mjs` and `tests/fixtures/build.mjs`.
Take expected results from the design, plan or acceptance case, not from the implementation; TDD is not the default ([design "Verification requirements"](docs/design.md#verification-requirements)).

Canonical source: `knowttl/bstack` revision `3930d739b2f54100d219f833dc9ed74721922ed7`, `skills/verification/references/testing.md`.
<!-- BEGIN canonical test-quality rules -->
**Test quality.** Write and review every test against these rules.
Tests are never required first; a change is verified end to end against the behaviour the user expects.

1. Trust upstream invariants: do not test states that types, schemas or database constraints already rule out.
   Test invalid input only at the boundary that validates it.
2. Assert outcomes from an agreed source (spec, domain rule, ground-truth fixture), never values copied from what the code returns today.
3. Mock only true external boundaries, with schema-valid or recorded payloads.
   Never mock in-process code.
   Delete tests that only check how a mock was set up or called, unless that call is the requirement.
4. Test through the public interface: no private helpers, internal state or internal call counts.
5. Every assertion must be able to fail when the behaviour breaks: no existence-, type- or constant-only assertions.

Exempt: validation-boundary tests, contract tests against an agreed schema or recording, and regression tests that cite the bug they reproduce.
<!-- END canonical test-quality rules -->
