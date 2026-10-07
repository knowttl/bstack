# Shared command contracts

The planned production interface is `node skills/repo-audit/scripts/repo-audit.mjs <command> [options]`.
Resource paths are relative to the installed skill, never the caller's current directory.
Command-specific options and input formats belong to their owning tasks and command help.
C4a establishes arguments, targets, paths, scratch and results.
Production dispatch and schema validation follow in C4c.

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

`runCommand(target, command, { signal })` accepts `{ executable, args, cwd, timeoutMs, versionArgs }`.
`args` and `versionArgs` are arrays of literal strings.
`cwd` is a required target-relative directory, resolved with the path contract before spawning anything.
`timeoutMs` defaults to 120000 and must be a positive safe integer.
The version probe runs first with the same working directory, timeout and cancellation signal.
A non-passing version probe blocks execution of the requested check.
Each invocation has its own timeout.

The returned execution record contains `status`, `stdout`, `stderr`, `durationMs`, `exitCode`, `signal`, `timedOut`, `cancelled` and `error`.
`toolVersion` contains the same record for the version probe, including its captured output.
Output is captured as the last 65536 bytes of each stream, decoded as UTF-8, and never printed by the library.
Missing executables or cleanup errors are blocked.
Nonzero exits, timeouts and cancellation are failed, even if the child exits with code zero.
An already cancelled signal starts no child.
Timeout and cancellation kill the managed process group on POSIX and use `taskkill /T /F` on Windows.
The runner waits for stream closure and cleanup before returning.
Children that deliberately detach themselves from the managed tree are outside this contract.

`selectCommand(executable, args)` supplies the same launcher selection for the check and its version probe.
`node` selects `process.execPath`.
On Windows, `npm` and `npm.cmd` select npm's `npm-cli.js`, first from `npm_execpath`, then beside Node, then under PATH entries.
Node executes that entry point with literal arguments.
Missing npm entry points and other `.cmd` or `.bat` launchers are blocked with a prerequisite and fix.
No child uses shell interpretation.
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
C4c adds the supported schema keywords and rejects unsupported keywords.
No schema validator or production command wiring is claimed by C4a or C4b.

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
