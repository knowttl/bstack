# Fixture construction

T1.1 delivers idea fixtures, clear goals, both native stacks, clean boundary proofs and state variants.
These sources serve later acceptance procedures, and their sanity checks do not claim those agent behaviours have passed.

See [README usage](../README.md) for build commands, output and cleanup responsibilities.
The builder copies declared files into a fresh OS temporary folder and runs the source fixture's `sanity.mjs` with that folder as its argument.
Exit codes are 0 for success, 1 for a failed build or sanity check, 2 for a missing executable or input, and 3 for usage errors.

The [fixture registry](../tests/fixtures/fixtures.json) declares the files to copy and, for repo fixtures, an ordered history of paths, messages and dates.
Each named fixture keeps its `FIXTURE.md` and `sanity.mjs` outside the built workspace.
Variants reuse source files through `source`, inject independent `seed` files before history, and share native sanity procedures.
History steps may write or remove files before committing.
`dirty` and `remove` apply after the final commit, and `shallow` builds a real depth-one clone.
Repo construction uses a fixed main branch, SHA-1 objects, empty templates, fixture-local identity, disabled signing and unchanged file bytes.
It ignores global and system Git configuration while building, and never writes to either.
Fixed author and committer dates make equivalent builds produce the same Git history.

Each `FIXTURE.md` names its seeds, acceptance inputs and runtime requirements.
To rerun sanity directly, use `node tests/fixtures/<name>/sanity.mjs <built-folder>`.
`npm test -- --task T1.1` exercises the builder, deterministic history, isolated Git configuration, seed sanity and preservation of source bytes.
The [task evidence](../tests/eval/results/tasks/T1.1.json) records local execution.

The TypeScript workspace pins TypeScript 5.9.3 with package-lock.json and requires Node 24 or later and npm.
The Python package pins Ruff 0.14.0 with uv.lock and requires Python 3.12 and uv.
Sanity installs from each lock, runs native compilation or lint and unit checks, and resolves imports with TypeScript or Python AST/importlib.
The fixture boundary probes are seed checks for later rule-proof work, not the installed skill's enforcement implementation.
The clean `ts-rule-proof` and `py-rule-proof` fixtures pass with public imports.
Their `-private`, `-alias` and `-cycle` variants each fail only that boundary probe while native compilation, lint and units pass.
Python's alias variant uses a relative-import re-export bridge.
`ts-shop` additionally proves the failing checkout against an ephemeral local HTTP server despite passing mocked units.
Native command results go to stderr while the builder's stdout remains JSON lines.

`dirty-work` contains staged and unstaged edits, new files, a deletion and a rename.
`refactor` preserves the public quote through a structural change.
`contract-removal` deletes design and coverage sources with the prior policy still accessible.
`shallow-history` makes that prior comparison unavailable.
`installer-collision` holds an isolated home with an unowned collision, edited installed content and an unrelated skill.
