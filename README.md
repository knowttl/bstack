# bstack

bstack helps developers establish project-specific guidelines, rules and checks for agents.
The approved [design](docs/design.md) defines the `repo-audit` first release, and the [implementation plan](docs/implementation-plan.md) tracks its build.

This checkout contains the [repo-audit procedure](skills/repo-audit/SKILL.md), interview, domain-language and vision references, board generation with a pinned runtime, and the completed T0.4 shared library described in the [command contract](docs/command-contract.md).
The procedure defines both audit checklists, review before apply, protected writes and outcome verification.
Use the load-when table to read the self-contained intent interview for a new idea, grilling for a material unresolved decision, or domain-language guidance for unclear terms.
These establish confirmed intent and draft vocabulary while keeping technical decisions in their existing sources.
Other conditional references remain placeholders, and production audit commands and the installer are not built yet.
Use the procedure for bounded read-only planning, keeping blocked steps visible.
Project edits remain blocked until the protected apply command is built.
Nothing is published to npm.

Use Node 24 or later:

```sh
npm ci --ignore-scripts
npm ci --omit=dev --prefix skills/repo-audit
npm run check
npm test
npm test -- --task T0.1
npm test -- --task T0.2
npm test -- --task T0.3
npm test -- --task T0.4.C4a
npm test -- --task T0.4.C4b
npm test -- --task T0.4.C4c
npm test -- --task T0.5.C5a
npm test -- --task T0.5.C5b
npm test -- --task T0.6
npm test -- --task T1.1
npm test -- --task T1.2
npm test -- --task T1.3
npm test -- --task T1.4
npm test -- --task T1.5
npm test -- --task T1.6
node scripts/acceptance.mjs --check-registry
node scripts/check-package.mjs --skill skills/repo-audit
```

`check` runs the package checks for user-only metadata, local resource paths, reference loading, line limits, literal script imports, top-level constant comments, step completion lines and bundled language policy.
It reports every detected problem with a stable rule code and exits 1 on failure.
See the [package check contract](docs/command-contract.md#package-check) for exact syntax and limits.
Local validation installs both the root development lock and the nested skill runtime lock, then runs the package check and full tests.
T0.6 recorded Node 24 and Node 26, while each later task records the versions it actually tested.
The no-mistakes gate installs both locks, runs tests and runs the distinct package check through `commands.lint`.
Recorded runs on Linux do not prove support on Windows or macOS.
The evaluation runner includes scenarios, all 75 planned acceptance procedures and a current-host Codex adapter.
Adapter runs create a fresh fixture, home, host state and cache, verify discovery isolation, and capture JSONL conversation turns.
Scripted replies use the host's resume interface after a reviewer matches the question to the next scripted answer.
See the [evaluation contract](docs/evaluation.md) for bounded runs, throwaway authentication, manual scoring, comparison and explicit final selections.

```sh
npm run eval -- --manual --scenario ambiguous-idea --mode without --stage baseline --agent <agent> --model <model>
npm run eval -- --scenario ambiguous-idea --mode without --stage baseline --adapter tests/eval/adapters/codex.json
npm run eval -- turn --run <id> --answer 1
npm run eval -- close --run <id>
npm run eval -- score --run <id> --answers answers.json --transcript transcript.txt
```

An unscored manual run exits 2 as blocked.
An adapter run also exits 2 until explicitly scored.
See the [recorded initial baseline](docs/evaluation.md#recorded-initial-baseline) for host provenance and scenario outcomes.
The [T1.3 gap map](tests/eval/results/gap-map.md) links every observed failure to the procedure and retains passing requirements.
This slice adds no real agent runs and does not claim with-skill behaviour or complete audit execution.
Close the conversation immediately when it finishes to delete its isolated home before reviewing the captured transcript.
The Codex adapter copies only the invoking user's existing login into throwaway state with private permissions, removes the copy after each turn, and deletes the whole home on close or a failed host turn.
Scoring requires complete answers and a transcript with reviewer citations.
Tests are discovered only under `tests/scripts/` and `tests/package-check/`.
Task suites are registered in `tests/tasks.json`.
`npm test -- --task T0.4` selects the currently implemented shared-library tests.
`npm test -- --task T0.5` selects the currently implemented package-check tests.
See [task progress](docs/implementation-plan.md#progress) for the remaining slices.

Build isolated fixture workspaces with Node 24 or later and Git.
Native fixtures also require npm, Python 3.12 and uv, with fixture-local TypeScript and Ruff locks:

```sh
node tests/fixtures/build.mjs --all
node tests/fixtures/build.mjs clear-goals
node tests/fixtures/build.mjs ts-rule-proof-alias
node tests/fixtures/build.mjs py-rule-proof-cycle
```

The builder prints one JSON line per fixture with its `name`, absolute temporary `path` and `kind` (`idea` or `repo`) after its sanity check passes.
The caller owns removal of the printed temporary folders.
T1.1 includes the two native stacks, clean boundary proofs, independent private/alias/cycle seeds, dirty work, refactors, contract removal, shallow history and installer collisions.
Missing native tools exit 2 as blocked.
See the [fixture contract](docs/fixtures.md) for sources and sanity commands.

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

To view the available and planned commands:

```sh
node skills/repo-audit/scripts/repo-audit.mjs --help
```

`--help` prints help and exits 0.
No arguments print the same help and exit 3 (usage error).
Unsupported commands or arguments report problems using the [result contract](docs/command-contract.md#results).

To exercise the read-only shared contract test from this checkout:

```sh
node skills/repo-audit/scripts/repo-audit.mjs contract-test --workspace . --input tests/inputs/schema-valid.json --json
node skills/repo-audit/scripts/repo-audit.mjs contract-test --help
```

See the [public test command contract](docs/command-contract.md#c4c-public-test-command) for input and schema validation details.

Build a synthetic VISION board in scratch outside the target:

```sh
node skills/repo-audit/scripts/repo-audit.mjs vision-board build --workspace . --draft tests/inputs/vision-draft.md --proposals tests/inputs/vision-proposals.json --json
node skills/repo-audit/scripts/repo-audit.mjs vision-board build --help
```

For a real draft, supply nonempty UTF-8 Markdown and [versioned proposals](skills/repo-audit/schemas/vision-proposals.json) naming its exact-byte SHA-256 as `draftRevision`.
The JSON result returns the board path, run ID, revision and card IDs.
Scratch preserves the draft, proposals, manifest and stylesheet without changing the target.
The [board command contract](docs/command-contract.md#vision-board-build) documents inputs and failure behaviour.
Board launch, verdict ingestion and resumed review remain pending C10b.
Generated HTML alone does not establish approval or complete AC-3.

Task evidence follows [the versioned schema](tests/eval/task-evidence.schema.json), with records and output artifacts in `tests/eval/results/tasks/`.
Shipping slices use no-mistakes and recorded local verification, with no hosted CI or release automation.
