# Shared command contracts

The planned production interface is `node skills/repo-audit/scripts/repo-audit.mjs <command> [options]`.
Resource paths are relative to the installed skill, never the caller's current directory.
Command-specific options and input formats belong to their owning tasks and command help.
C4a establishes arguments, targets, paths, scratch and results.
C4c adds command dispatch and the explicitly supported schema subset.

## Arguments and targets

Options use `--name value`, with a separate, nonempty value.
`--json` is a boolean flag.
Unknown arguments, positional arguments, repeated options, missing values and `--name=value` are usage errors.
Argument validation collects detected problems before refusing an operation.
Each command registers its own value options with `parseArgs`.

Exactly one explicit target is required.
`--repo <path>` selects an existing Git working tree and resolves its real Git top level, including when selected from a subdirectory or before its first commit.
A bare repo or non-Git directory is blocked, with a Git prerequisite and fix.
`--workspace <path>` is accepted only by draft-only commands and resolves an existing directory that need not contain Git.
The two target options are mutually exclusive.
Relative target paths resolve from the caller's working directory.
Target identity is `{ mode: "repo" | "workspace", root: <absolute real path> }`.
Links to the target share that identity.
Draft commands do not initialise Git, create a repo or write foundation files.
The separately selected creation operation belongs to T2.9.

## Target-relative paths

`resolvePath(root, input)` accepts a nonempty relative path and returns its resolved absolute path inside the real target root.
Absolute paths, Windows drive paths, NUL bytes and parent traversal components using either slash are refused.
Spaces, Unicode and metacharacters remain literal path characters.
For a new path, resolution starts with its nearest existing parent.
Existing links must resolve inside the target, including parents of new files.
Dangling links are refused rather than treated as absent directories.
Internal links are allowed and return their real destination.
No validation operation creates target files or directories.
Callers validate all inputs and paths before any write, and report every detected problem.
This is path preflight, not the reviewed atomic-write and concurrent-change protection built in T2.6.
Callers must recheck paths and reviewed bytes at that later write boundary.

## Scratch

Drafts, board verdicts and resume state stay outside the selected target.
`createScratch(target)` creates one run directory under the OS cache folder:

| OS | Cache folder |
|---|---|
| Windows | `%LOCALAPPDATA%\bstack\` |
| macOS | `~/Library/Caches/bstack/` |
| Linux | `$XDG_CACHE_HOME/bstack/`, otherwise `~/.cache/bstack/` |

The cache directory must be absolute.
A target subfolder uses SHA-256 of the absolute real target root, and a UUID identifies each run.
Existing cache and run-parent links are resolved before creating directories.
A resolved scratch location inside the target is blocked before any write.
The returned absolute run path is explicit input to later resume operations, rather than guessing the newest run.
Scratch is retained for review and resume, with no automatic deletion in C4a.

## Results

With `--json`, stdout contains exactly one JSON object:

```json
{"schemaVersion":1,"command":"contract-test","status":"passed","problems":[],"data":{},"inputs":{}}
```

| Status | Exit code | Meaning |
|---|---|---|
| `passed` | 0 | The requested operation passed |
| `failed` | 1 | Input data or a completed check failed |
| `blocked` | 2 | A prerequisite is missing or inaccessible |
| `usage-error` | 3 | Arguments or target-relative paths are invalid |

Each problem has `code`, `message`, `fix` and an optional `path`.
`data` contains the command's results and `inputs` identifies the target and relevant declared inputs.
Without `--json`, the command prints a short status summary and each problem's fix with the same exit code.
Child output must go to captured artifacts, never alongside the JSON envelope.
Child execution and fingerprints are implemented in C4b.

## Child commands

`runCommand(target, command, { signal, env })` accepts `{ executable, args, cwd, timeoutMs, versionArgs }`.
`args` and `versionArgs` are arrays of literal strings.
`cwd` is a required target-relative directory, resolved with the path contract before spawning anything.
`timeoutMs` defaults to 120000 and must be a positive safe integer.
`env` defaults to `process.env`; a supplied object replaces the child environment for launcher selection, the version probe and execution without mutating the caller's environment.
The version probe runs first with the same working directory, environment, timeout and cancellation signal.
A non-passing version probe blocks execution of the requested check.
Each invocation has its own timeout.

The returned execution record contains `status`, `stdout`, `stderr`, `durationMs`, `exitCode`, `signal`, `timedOut`, `cancelled`, `outputTruncated` and `error`.
`toolVersion` contains the same record for the version probe, including its captured output.
Output is captured as the last 65536 bytes of each stream, decoded as UTF-8, and never printed by the library.
`outputTruncated` is true if either stream exceeded that limit; it does not change the child execution status.
Missing executables or cleanup errors are blocked.
Nonzero exits, timeouts and cancellation are failed, even if the child exits with code zero.
An already cancelled signal starts no child.
Timeout and cancellation kill the managed process group on POSIX and use `taskkill /T /F` on Windows.
The runner waits for stream closure and cleanup before returning.
If cleanup fails, it closes the captured streams and returns blocked without waiting for inherited pipes to close.
It also attempts to kill the direct child and releases its event-loop reference if that attempt fails.
Direct-child termination does not prove tree cleanup, so the result remains blocked.
Children that deliberately detach themselves from the managed tree are outside this contract.

`selectCommand(executable, args)` supplies the same launcher selection for the check and its version probe.
`node` selects `process.execPath`.
On Windows, `npm` and `npm.cmd` select npm's `npm-cli.js`, first from `npm_execpath`, then beside Node, then under PATH entries.
Node executes that entry point with literal arguments.
Missing npm entry points and other `.cmd` or `.bat` launchers are blocked with a prerequisite and fix.
No child uses shell interpretation.
Direct `npm.cmd` execution returned `EINVAL` in a Windows Node `v24.16.0` probe.
The platform constraint is documented in [Node's child-process guide](https://raw.githubusercontent.com/nodejs/node/v24.0.0/doc/api/child_process.md).
Windows command selection is tested on Linux in C4b, while real Windows execution remains pending under R26.

## Fingerprints

`hashBytes(bytes)` returns a lowercase SHA-256 digest of exact bytes, preserving line endings.
Callers represent an absent original or proposed file with `null`, never the hash of empty bytes.
`canonicalJSON(value)` serializes JSON values with sorted object keys and preserved array order.

`fingerprint(target, { baseCommit, paths, inputs, evidencePath })` returns `{ fingerprint, state }`.
The caller supplies the resolved base commit and JSON assessment inputs.
The state includes the real local target root, base commit, sorted unique paths and substantive inputs.
Each inventoried file records its path, presence, filesystem mode and exact-byte content hash.
Absent files record `present: false`, `mode: null` and `contentHash: null`.
Unreadable inputs and unsafe paths refuse the operation rather than producing a fingerprint.

Only the top-level `inputs.fingerprint` and `inputs.execution` fields are omitted as derived data.
All other fields, including nested fields with those names, remain substantive.
When `evidencePath` is supplied, that path stays inventoried with its presence and mode, but its serialized content is not hashed.
The caller must include the evidence's substantive fields in `inputs`.
This avoids a self-referential evidence hash without omitting the assessment itself.
Portable committed identity and format-specific assessment fields belong to their later owning tasks.

## Structured inputs and later contracts

Every structured format declares `schemaVersion: 1` and rejects unknown fields.
Owning tasks define exact required contents and reject missing or duplicate joining IDs.
`validateData(schema, data)` first validates the schema definition, then collects data problems before throwing a failed `CommandError`.
`validateSchema(schema)` validates definitions independently.
The supported keywords are `$schema`, `title`, `type`, `const`, `enum`, `properties`, `required`, `additionalProperties`, `items`, `minItems`, `minLength` and `pattern`.
`$schema` and `title` are string metadata, not external schema loaders.
Schema nodes must be objects.
Boolean schema nodes, references, combinators and every other keyword are unsupported.
Unsupported keywords report `unsupported-keyword` with the keyword name and location, including inside nested definitions.
Malformed keyword values report `invalid-schema` before data validation.
`type` accepts one JSON type or a nonempty array of unique JSON types.
`additionalProperties` accepts a boolean or a supported schema object.
`items` accepts one supported schema object.
`enum` requires nonempty unique JSON values, and `required` requires unique string field names.
`minItems` and `minLength` require nonnegative safe integers.
String length counts Unicode code points, and patterns use Unicode JavaScript regular expressions.
Missing fields, unknown fields, wrong types and failed constraints report their paths and fixes.
This subset does not implement the separate task-evidence schema's conditional keywords.
Later owning tasks extend the subset only with tested keywords their formats use.

`validateIds(records, path)` checks one joining collection for nonempty string IDs and duplicates.
Owning commands select each collection explicitly, so IDs in unrelated collections do not collide.
Missing, empty, whitespace-only and non-string IDs report `missing-id`.
Repeated IDs report `duplicate-id` with the repeated value.

## Command dispatch

The entry point registers command metadata in `scripts/commands.mjs` and loads only the selected implementation from `scripts/commands/` after argument validation.
`<command> --help` prints that command's options without importing its implementation or resolving a target.
No arguments print the available and planned commands with exit 3, and global `--help` succeeds.
Unknown and unbuilt commands are usage errors.
Command implementations return data and inputs, while the entry point owns result emission and error exit codes.
Unbuilt production commands remain listed as planned until their owning task registers them.

## C4a public test command

`node tests/inputs/contract.mjs --mode draft --workspace <directory> --input tests/inputs/draft.json --json` exercises the shared library without changing production dispatch.
`--mode repo --repo <directory>` exercises the Git mode.
Its input is `{ "schemaVersion": 1, "paths": [<relative path>], "scratch": <boolean> }` with no additional fields.
It validates all paths before optionally writing `draft.txt` in a new scratch run.
Valid and invalid fixtures in `tests/inputs/` cover refusal with no partial writes.
See the [README](../README.md) for suite selection and the [implementation plan](implementation-plan.md#progress) for slice progress.

## C4b public test command

`node tests/inputs/child-contract.mjs --mode run --workspace <directory> --input <fixture.json> --json` exercises child execution without production dispatch.
The fixture input supplies `command` and an optional `cancelDirectory`, whose `ready` file event aborts the running tree.
`--mode select` accepts `executable`, `args` and launcher-selection `options` for Windows logic tests.
`--mode fingerprint` accepts the fingerprint input object documented above.
These fixture commands are test interfaces, not production command wiring or schema validation.

## C4c public test command

`node skills/repo-audit/scripts/repo-audit.mjs contract-test --workspace <directory> --input tests/inputs/schema-valid.json --json` exercises dispatch, schema validation and joining IDs through the installed entry point.
It also accepts `--repo` and leaves the target unchanged.
The installed [input schema](../skills/repo-audit/schemas/contract-test.json) owns the required fields, allowed values and unknown-field constraints.
The command also checks the `records` collection with `validateIds`, as described above.
`--schema <file>` selects an explicit definition for schema-subset tests.
Input and schema file paths resolve from the caller's working directory, while the default schema resolves from the installed command module.
Unreadable or malformed JSON reports `invalid-input`.
This read-only test interface implements no audit, apply or evidence workflow.

## Package check

`node scripts/check-package.mjs [--skill <folder>]` checks authored skill resources without writing files.
The default is this checkout's `skills/repo-audit/`, independent of the caller's working directory.
An explicit folder resolves from the caller's working directory.
`--help` exits 0, unsupported or repeated arguments exit 3, detected package problems exit 1, and a passing package exits 0.
Output uses the shared text result format and reports all detected problems before exiting.
Each problem carries one stable code below.

The scanner recursively reads regular files, excluding entries named `node_modules`, `.git`, `.cache` and `scratch` at every depth.
These are installed dependencies, Git data and the package's local cache or scratch conventions.
Directory symlinks are not traversed.
File symlinks are read if they resolve to regular files.
Files containing a NUL byte are treated as binary and only participate in the reference inventory.
Unreadable files or folders report `package-unreadable` and do not stop checks of other resources.

| Rule code | Exact syntactic check |
|---|---|
| `local-path-missing` | In every scanned text file, collect Markdown inline link/image destinations, Markdown reference-definition destinations, and single-line strings enclosed in backticks, single quotes or double quotes that start with `./`, `../`, `references/`, `scripts/`, `schemas/`, `assets/` or `agents/`. Ignore URI schemes, `//` URLs and fragment-only destinations. Remove query/fragment suffixes, decode percent escapes and remove a trailing `:line` or `:line:column`. The five named resource prefixes resolve from the skill root, all other paths from the containing file's directory. The destination must exist according to filesystem stat, as a file or directory. Invalid percent escapes also fail. |
| `reference-unlisted` | Every scanned file under `references/`, including subdirectories and binary files, must appear with its exact skill-relative path among the recognised destinations in pipe-delimited rows under a heading named exactly `Load when`. That section ends at the next Markdown ATX heading. |
| `reference-nested` | A recognised destination in a reference text file resolves to a path under the same skill's `references/` directory. It fails independently of whether the target exists. |
| `skill-too-long` | After stripping a leading `---` frontmatter block terminated by another `---` line, the `SKILL.md` body has more than 500 lines. CRLF is normalised for counting and a final newline does not add a line. |
| `reference-toc` | A reference text file has more than 100 lines, using the same line-count convention, and none of its first 20 lines is an ATX heading named `Table of contents`, `Contents` or `TOC`, case-insensitively. |
| `host-metadata` | The leading `SKILL.md` frontmatter lacks the literal unindented line `disable-model-invocation: true`, or `agents/openai.yaml` lacks an unindented `policy:` block with a two-space-indented literal `allow_implicit_invocation: false` line. Trailing whitespace is accepted. |
| `script-import` | Parse every scanned `.js`, `.mjs` and `.cjs` text file with Acorn's latest JavaScript grammar. Use module mode except for `.cjs`, which uses script mode with top-level return permitted by the CommonJS function wrapper. Inspect import declarations, re-exports with sources, dynamic imports and bare identifier `require(...)` calls at every depth. For string literal specifiers, accept `./` and `../` local paths, Node built-ins recognised by `node:module` isBuiltin, or a package name in the skill-root package.json dependencies or optionalDependencies. Scoped names use their first two slash-separated components, other packages their first component, so declared package subpaths pass. devDependencies and peerDependencies do not supply an installed runtime. |
| `constant-comment` | A direct Program-body const VariableDeclaration, including one wrapped by ExportNamedDeclaration, must have an actual JavaScript line or block comment whose ending line is exactly one line before the statement's starting line. An exported declaration uses the export statement's starting line. One comment covers a declaration with several bindings or destructuring. Nested statements, functions and loop declarations are outside this control. |
| `step-done` | In the SKILL.md body, Marked's top-level token stream recognises an ATX heading of depth three whose raw spelling starts with up to three spaces then `###` and whitespace, and whose text starts with `Step` followed by whitespace or end of text. Before the next top-level heading of any depth, a paragraph token must contain an unindented line starting exactly `Done when:`. Fenced or indented code, lists and block quotes cannot supply the heading or completion line. |
| `language-policy` | At any scanned depth, deny basenames matching .eslintrc and .prettierrc with no extension or json, yaml, yml, js, cjs or mjs extensions, eslint.config.js/cjs/mjs, prettier.config.js/cjs/mjs, ruff.toml, .ruff.toml, .pylintrc, mypy.ini, .flake8 and biome.json/jsonc. Case is ignored. In every scanned text file, deny whole-word eslint, prettier, ruff, pylint, mypy, flake8 and biome, plus eslint-config- names with word or hyphen suffixes, case-insensitively. This includes tool lists, presets, package declarations, prose, examples and comments. The short deny list lives only in the check script. |
| `script-syntax` | JavaScript parsing fails. Report the parser diagnostic and keep collecting problems from other files. |
| `package-manifest` | A present skill-root package.json is invalid JSON, is not an object, or has a present dependencies or optionalDependencies field that is not an object of nonempty string values. An absent manifest supplies no runtime dependencies. |

The C5a resource and metadata rules and the language-policy rule are textual checks, including text in examples and comments.
They do not parse full Markdown or YAML, accept every equivalent YAML spelling, validate duplicate YAML keys, check anchor names or TOC entries, infer unquoted prose paths, resolve computed resource names, or prove host invocation behaviour.
Markdown destinations with spaces must use angle brackets.
Inline link labels with nested brackets and destinations with unescaped parentheses are outside this scanner's grammar.
Quoted resource paths must be complete literals without interpolation or embedded quote delimiters.
The contents rule proves the early heading exists, not that its entries describe the file.
Script imports and constants use parsed JavaScript nodes, so strings, regex literals, templates and comments cannot impersonate imports or declarations.
Computed specifiers, template specifiers, require aliases, createRequire calls and package resolution are outside the literal import control.
Bare require calls are recognised syntactically without resolving whether the identifier is shadowed.
Local literal paths still receive the C5a resource checks, which retain their textual grammar and limits.
Declared dependency versions are not installed or resolved by this check.
The deny list does not recognise every tool, config spelling or per-language rule set, and does not infer whether a tool mention is a recommendation.
The step check proves the completion-line format, not its meaningfulness.
The design's instruction that each constant explains its reason remains an authoring and review requirement.
The plan defines the mechanical subset as top-level constants with a preceding comment.
This check proves the comment's syntactic presence, not its quality, and does not require comments on nested constants.
Acorn and Marked are root development dependencies used by this checker, not dependencies shipped in the skill.
