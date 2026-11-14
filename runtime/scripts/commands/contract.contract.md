## Project contract and change collection

```sh
node skills/maintenance/scripts/maintenance.mjs contract validate --repo <target> [--contract <repo-relative-file>] --json
node skills/maintenance/scripts/maintenance.mjs evidence collect --repo <target> --base <ref> [--contract <repo-relative-file>] --json
```

Both commands require a Git working tree and accept `--contract`, defaulting to `.bstack/project.json`.
The selected contract path resolves from the target root, independent of the caller's working directory.
The [project schema source](../runtime/schemas/project.schema.json) owns version 1 and rejects unknown fields and versions.
Existing config is usable only if it expresses the entire contract without loss.
No adapter is provided for the discovered native check configs: their rules and scripts do not express document relationships, generators and acceptance pointers.
Unsupported formats block with the prerequisite to review a standalone contract.
Validation never executes project commands or writes the target.

Each collection has unique nonblank IDs in its own namespace.
Documents have `id` and an existing concrete `path`.
Scopes have `id`, nonempty `paths` globs, `documentIds` and `ruleIds`.
Rules have `id`, an existing `path`, an opaque nonblank source `pointer`, and `checkIds` referencing leaf checks; an empty list records a judgement rule.
Checks have `id`, a [child command](#child-commands) and nonempty `inputScopes` globs.
Generators additionally have nonempty concrete `outputPaths`, which may name planned absent files.
Acceptance sources have `id`, an existing `path` and a nonblank `pointer` identifying the authoritative acceptance section.
Pointers identify source locations for review; this validator checks file presence, not arbitrary prose anchors or semantic correctness.
The contract never stores copied glossary definitions, rule explanations or standards text.

For example, save this contract in a repo with `README.md` and `src/entry.mjs`:

```json
{
  "schemaVersion": 1,
  "documents": [{ "id": "design", "path": "README.md" }],
  "scopes": [{ "id": "code", "paths": ["src/**"], "documentIds": ["design"], "ruleIds": ["boundary"] }],
  "rules": [{ "id": "boundary", "path": "README.md", "pointer": "#Boundaries", "checkIds": ["syntax"] }],
  "checks": [{ "id": "syntax", "command": { "executable": "node", "args": ["--check", "src/entry.mjs"], "cwd": ".", "versionArgs": ["--version"] }, "inputScopes": ["src/**"] }],
  "generators": [],
  "acceptanceSources": [{ "id": "requirements", "path": "README.md", "pointer": "#Acceptance" }]
}
```

Paths use repo-relative `/` separators, with exact case on every operating system.
Scope and input globs reuse the [overlap matcher](#measure-and-overlap): `*` and `?` match within segments and `**` as a whole segment matches zero or more segments.
Absolute paths, traversal, empty or dot segments, backslashes, partial globstars and bracket/brace/extglob syntax fail.
Source pointers and generator outputs are concrete paths, without wildcards.
Existing generator output components and the selected contract path also require exact case; absent planned output components are allowed.
Command `cwd` follows the child-command contract, including `.` for the root, and must exist.
Unknown document, rule or check references fail.

Leaf checks and generators cannot invoke bstack's `evidence validate`, `docs check`, `docs generate` or the standalone `bstack-check.mjs` aggregate.
Aggregate filenames are recognised in executable and argument positions by case-insensitive basename, using either path separator and ignoring `.exe`, `.cmd` and `.bat` suffixes.
The `evidence validate`, `docs check` and `docs generate` argument pairs require those exact spellings and a `repo-audit.mjs` or `maintenance.mjs` executable or argument; independent project tools may use those argument pairs.
Native npm, pnpm and yarn script aliases support `run <script>`, explicit `test`/`start`/`stop`/`restart` scripts and version flags.
For npm, script lookup uses the nearest ancestor within the repo containing `package.json` or `node_modules`, and script bodies are inspected from that directory.
For Yarn, lookup uses the nearest ancestor within the repo containing `package.json`, without stopping at `node_modules`.
Script bodies use the [selected integration grammar](../skills/foundation/references/checks.md#integrate-the-maintained-command), which owns token, quoting, whitespace and unsupported shell-transformation rules.
That grammar applies to every command in pre/main/post and nested script bodies reached from checks, generators or their version probes; direct child-command arrays retain literal arguments under the [child-command contract](#child-commands).
The validator follows script aliases and declared npm, pnpm and yarn pre/post lifecycle scripts, rejecting cycles, missing scripts and aggregate calls.
Declared pnpm hooks are inspected even when local configuration disables them, so enabling hooks cannot introduce aggregate recursion.
Unsupported package-manager invocation syntax and shell programs require a reviewed direct leaf command.
Other child executables are opaque reviewed leaves; validation does not statically analyse arbitrary program implementations for hidden aggregate calls.
