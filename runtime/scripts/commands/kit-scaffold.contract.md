## Verification skill commands

`node skills/verification/scripts/verification.mjs <command> --repo <path> [--json]` is the installed entry point of the standalone verification skill, with the same argument, target, scratch and result contracts as repo-audit.
It runs `apply`, `state show`, `findings validate`, `rule-proof`, `baseline check`, `run-checks`, `probe record` and `probe compare` from the [shared runtime](../../), following their contracts above, and adds the commands below.
`--help` lists the commands, and `<command> --help` prints that command's syntax.

`kit scaffold --repo <path> --plan <file>` reads a kit plan following [the plan schema](../../../skills/verification/schemas/kit-plan.json) and writes a change set and findings file to scratch for review through `apply`.
It never writes to the target.
The change set creates `.agents/skills/verify-<app>/` with `SKILL.md`, `kit.json`, `features/README.md`, one file per feature and each helper, plus `.claude/skills/verify-<app>/SKILL.md`, and either creates `AGENTS.md` or appends one pointer line to it.
The result carries `data.path` (the change set), `data.planDigest`, `data.files` and the exact `data.diff`.
Declared captured artifacts must use paths inside `{evidenceDir}/`; validation rejects other destinations with `artifact-outside-evidence` before commands run.
The path `{evidenceDir}/<feature id>.json` is reserved for the proof record; a declared artifact using that path, including a normalized equivalent, fails plan validation with `evidence-collision`.
Every feature's `sourcePaths` entry must be a nonempty repo-relative forward-slash path, with `*` and `?` within segments or `**` as a whole segment.
Absolute paths, drive prefixes, backslashes, NUL characters, empty, `.` or `..` segments, and the unsupported glob characters `[]{}()!` fail with `invalid-glob`.
Backticks and line breaks fail with `invalid-source-path`, because declarations must fit the generated backticked `Source paths:` line.
Feature titles and summaries must each be one line, and a summary cannot start with `Source paths:`; violations fail with `invalid-feature-metadata`.
Other plan validation failures use `invalid-ready`, `invalid-timeout`, `invalid-match`, `unsafe-path`, `evidence-inside-kit`, `artifact-outside-evidence`, `evidence-collision`, `helper-collision`, `duplicate-feature` or the schema codes before any change set exists.
An existing file the change set would create blocks with `kit-exists`.
A plan with `"coverageGate": true` also renders `scripts/map-coverage.mjs` into the kit and lists it under Helpers; a helper at that path then fails with `helper-collision`.

`kit scaffold --update` corrects an applied kit from an edited plan.
It replaces each kit file whose bytes differ from the plan's rendering, creates each missing file, deletes previously managed files the new plan no longer renders (including dropped helpers and a disabled coverage gate), deletes unlisted files under `features/` and appends the `AGENTS.md` pointer when absent.
It proposes nothing for a file that already matches and preserves unlisted files elsewhere in the kit.
When the applied `kit.json` exists, it supplies the previous managed-file inventory; an update can repair its legacy source-path or feature-metadata declarations, but the new plan must pass current validation.
Checking, proving or updating an existing kit fails with `kit-app-mismatch` if its plan's `app` differs from the requested app, before deriving managed files or running commands.
When nothing differs it exits 0 with `data.path` and `data.planDigest` null and an empty `data.files`.
The result is otherwise the same reviewable change set, applied only through `apply`.
