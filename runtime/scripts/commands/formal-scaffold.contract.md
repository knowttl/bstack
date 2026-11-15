## Formal verification skill commands

`node skills/formal-verification/scripts/formal-verification.mjs <command> --repo <path> [--json]` is the installed entry point of the formal-verification skill, with the same argument, target, scratch and result contracts as repo-audit.
It runs `apply`, `state show`, `cite-check` and `rule-proof` from the [shared runtime](../../), following their contracts above, and adds the commands below.
`--help` lists the commands, and `<command> --help` prints that command's syntax.

`formal scaffold --repo <path> --plan <file>` reads a suite plan following [the plan schema](../../../skills/formal-verification/schemas/formal-plan.json) and writes a change set and findings file to scratch for review through `apply`.
It never writes to the target.
The change set creates `.agents/skills/formal-<target>/` with `SKILL.md`, `suite.json`, one `properties/<id>.md` per property, each model file under `model/` and `scripts/map-coverage.mjs`, plus `.claude/skills/formal-<target>/SKILL.md`, and either creates `AGENTS.md` or appends one pointer line to it.
The generated `SKILL.md`'s Run section includes the [U3 counterexample-as-code-steps instruction](../../../docs/design.md#formal-verification-upkeep-amendment-2026-10-24).
The result carries `data.path` (the change set), `data.planDigest`, `data.files` and the exact `data.diff`.
A property file renders its statement, then the `Harm:`, `Source paths:`, `Synced at:` (only when the property has a `syncCommit`), `Design:`, `Model files:` and `Violation diagnostic:` lines, its check command, bounds, assumptions and a `## Transition table` section with one row per model step.
Every step's `code` must be a `path:line` location inside one of the property's `sourcePaths` whose file has that line; the schema rejects a step with none with `invalid-pattern`, and the plan fails with `step-outside-source-paths` or `step-code-missing` otherwise.
Other plan validation failures use `evidence-inside-suite`, `duplicate-property`, `duplicate-model-file`, `module-name-mismatch` for a `.tla` model whose header does not name its file, `invalid-property-metadata`, `invalid-source-path`, `invalid-glob`, `unsafe-path` or the schema codes before any change set exists.
An existing file the change set would create blocks with `suite-exists`.
`--update` replaces each suite file whose bytes differ from the plan's rendering, creates each missing file, deletes previously managed files and unlisted files under `properties/` and `model/` that the new plan no longer renders, and appends the `AGENTS.md` pointer when absent; when nothing differs it exits 0 with `data.path` and `data.planDigest` null and an empty `data.files`.
