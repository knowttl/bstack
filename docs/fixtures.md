# Fixture construction

C6a delivers the T1.1 builder and `new-idea`, `ambiguous-idea` and `clear-goals` sources.
Native stack fixtures and variants remain pending C6bc, so T1.1 is partially complete.
These sources serve later acceptance procedures, and their sanity checks do not claim those agent behaviours have passed.

Run `node tests/fixtures/build.mjs <name>` or `node tests/fixtures/build.mjs --all`.
The builder copies declared files into a fresh OS temporary folder and runs the source fixture's `sanity.mjs` with that folder as its argument.
Each successful build prints a JSON line containing `name`, absolute `path` and `kind` (`idea` or `repo`).
The caller removes the temporary folders after use.
Exit codes are 0 for success, 1 for a failed build or sanity check, 2 for a missing executable or input, and 3 for usage errors.

`tests/fixtures/fixtures.json` declares the files to copy and, for repo fixtures, an ordered history of paths, messages and dates.
Each source directory keeps its `FIXTURE.md` and `sanity.mjs` outside the built workspace.
Idea workspaces contain only `brief.md`.
Repo construction uses a fixed main branch, SHA-1 objects, empty templates, fixture-local identity, disabled signing and unchanged file bytes.
It ignores global and system Git configuration while building, and never writes to either.
Fixed author and committer dates make equivalent builds produce the same Git history.

Each `FIXTURE.md` names its seeds, acceptance inputs and runtime requirements.
To rerun sanity directly, use `node tests/fixtures/<name>/sanity.mjs <built-folder>`.
`npm test -- --task T1.1` exercises the builder, deterministic history, isolated Git configuration, seed sanity and preservation of source bytes.
The [task evidence](../tests/eval/results/tasks/T1.1.json) records local execution and the pending native fixture prerequisite.
