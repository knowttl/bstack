# Fixture construction

See [task progress](implementation-plan.md#progress) for the delivered fixtures and remaining T1.1 scope.
These sources serve later acceptance procedures, and their sanity checks do not claim those agent behaviours have passed.

See [README usage](../README.md) for build commands, output and cleanup responsibilities.
The builder copies declared files into a fresh OS temporary folder and runs the source fixture's `sanity.mjs` with that folder as its argument.
Exit codes are 0 for success, 1 for a failed build or sanity check, 2 for a missing executable or input, and 3 for usage errors.

The [fixture registry](../tests/fixtures/fixtures.json) declares the files to copy and, for repo fixtures, an ordered history of paths, messages and dates.
Each source directory keeps its `FIXTURE.md` and `sanity.mjs` outside the built workspace.
Repo construction uses a fixed main branch, SHA-1 objects, empty templates, fixture-local identity, disabled signing and unchanged file bytes.
It ignores global and system Git configuration while building, and never writes to either.
Fixed author and committer dates make equivalent builds produce the same Git history.

Each `FIXTURE.md` names its seeds, acceptance inputs and runtime requirements.
To rerun sanity directly, use `node tests/fixtures/<name>/sanity.mjs <built-folder>`.
`npm test -- --task T1.1` exercises the builder, deterministic history, isolated Git configuration, seed sanity and preservation of source bytes.
The [task evidence](../tests/eval/results/tasks/T1.1.json) records local execution and the pending native fixture prerequisite.
