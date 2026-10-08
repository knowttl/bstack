# Shared command contracts

The planned production interface is `node skills/repo-audit/scripts/repo-audit.mjs <command> [options]`.
Resource paths are relative to the installed skill, never the caller's current directory.
Command-specific options and input formats belong to their owning tasks and command help.
C4a establishes arguments, targets, paths, scratch and results.
C4c adds command dispatch and the explicitly supported schema subset.

## Measure and overlap

```sh
node skills/repo-audit/scripts/repo-audit.mjs measure --repo <path> --range <base>..<head> [--exclusions <file>] --json
node skills/repo-audit/scripts/repo-audit.mjs overlap --repo <path> --plans <file> <file> --json
```

Both commands require a Git repo, accept optional `--json`, and make no writes or scratch files.
Input JSON filenames resolve from the caller's working directory.
Missing options and unsupported arguments are usage errors, malformed inputs fail with named problems, and unavailable Git objects block measurement.
The schemas reject unknown fields and use `schemaVersion: 1`.

### Measurement

`--range` is required, either a two-dot range excluding commits reachable from base, or a single revision including all its reachable history.
Both endpoints resolve to commit IDs before collection.
Three-dot and omitted endpoints are usage errors.
`data.range` retains the requested range, resolved base (null for a single revision), head and resolved range.
`data.shallow` identifies locally truncated history.
The command never fetches missing history.

`data.files` reports eligible blob files present at the resolved head: repo-relative paths, `bytes` at that revision, `changeCount` and supporting `commits` in reverse topological order.
Sizes come from Git blobs, so working-tree changes and untracked files cannot alter measurement.
The resolved head is the size evidence revision, including for files unchanged in the selected history range.
Deleted paths do not create file rows.
In linear history, earlier lifetimes of reused endpoint paths contribute no supporting commits, rename evidence or co-change pairs.
Gitlink events are excluded as non-blobs using historical object modes, including deleted gitlinks and blob/gitlink type changes.
Only the current blob lifetime at a reused gitlink path remains eligible for signals.
`data.coChangePairs` gives sorted path pairs, change counts and their supporting commits.
There are no size or frequency thresholds, violation classifications or import analysis.

History uses `git log` with 50% similarity rename detection and first-parent diffs for merge commits.
Endpoint files are followed back through detected lineage within the selected range, including chained renames, stopping at addition events.
Lineage follows every selected commit-parent edge in topological order, including across merged branches; merge signal counts still use the first-parent diff.
If shared ancestry reaches multiple retained names, its commits support each name without creating a co-change pair from a single historical path.
Additions and deletions end rename lineage along each traversed parent edge, including in excluded formatting commits.
If a path is deleted on one line of history and reused by an unrelated file, then merged with a branch that edited the old file, a modification on the second-parent edge can carry the old lifetime's commits, rename evidence and co-change pairs into the new file's signals.
These signals are advisory evidence, never violations; this limitation does not change what counts as a file change.
Blob/gitlink type changes also end blob lineage.
`data.renames` retains commit, original path, destination path and canonical endpoint path for tracked lineage, subject to the merged path-reuse limitation above.
Renames outside the range are not inferred.
Counts describe same-commit changes, rather than observed merge conflicts.

Default exclusions cover lock basenames at every depth: package-lock.json, npm-shrinkwrap.json, pnpm-lock.yaml, yarn.lock, bun.lock, bun.lockb, uv.lock, poetry.lock, Pipfile.lock, Cargo.lock, go.sum, Gemfile.lock and composer.lock.
Generated directory conventions are .git, node_modules, .venv, venv, __pycache__, dist, build and .cache at every depth.
These patterns derive from the shared discovery policy in `lib/discovery.mjs`.
Declare other generated files and broad formatting commits with the [exclusions schema](../skills/repo-audit/schemas/measure-exclusions.json):

```json
{
  "schemaVersion": 1,
  "generatedPaths": ["generated/**", "src/*.generated.*"],
  "formattingCommits": ["<commit-in-the-range>"]
}
```

Formatting commits resolve to full IDs and must belong to the range.
The command excludes their changes from frequency and co-change while retaining rename evidence unless the original or destination path is excluded.
Formatting is explicitly identified by the caller, never guessed from size or commit messages.
`data.exclusions` reports all applied rules, matching observed paths with their reason and pattern, and resolved formatting commit IDs.
An excluded original or destination name excludes that rename event.
No formatting commits are excluded when none are declared.

### Declared overlap plans and glob semantics

Each file follows the [overlap plan schema](../skills/repo-audit/schemas/overlap-plan.json):

```json
{
  "schemaVersion": 1,
  "id": "change-a",
  "writePaths": ["src/**/*.mjs", "new-file.md"],
  "contracts": [{ "id": "pricing", "files": ["contracts/price.json"] }]
}
```

Plan IDs must differ, and changed contract IDs must be unique within each plan.
`contracts` declares contracts the change will modify, rather than every contract it reads.
Empty write and contract arrays are valid.
Both write paths and contract files use these semantics:

- Paths are repo-relative and case-sensitive on every platform, with `/` as the separator.
- `*` matches zero or more Unicode characters within one nonempty path segment, and `?` matches one Unicode character excluding `/`.
- Whole-segment `**` matches recursively across zero or more directories, so `src/**/*.mjs` includes `src/file.mjs` and `src/nested/file.mjs`.
  A trailing `/**` matches descendants beneath its prefix.
- Dotfiles match normally.
  Other characters are literal, with no escaping, negation, character classes, brace expansion or extglobs.
- Absolute paths, drive prefixes, backslashes, empty segments, `.` and `..` segments, NUL and unsupported glob syntax fail with `invalid-glob`.

`data.sharedPaths` lists every intersecting declaration pair with `left`, `right` and a concrete `examplePath`.
The example witnesses an intersection and need not exist in the working tree.
Pattern comparison therefore includes planned new files, rather than expanding only the current repo inventory.
`data.sharedContracts` reports pairs sharing a contract ID or intersecting contract file patterns, with both IDs, `sameId` and intersecting `files` in the same witness format.
The same changed contract ID remains a signal even when its declared files differ.
Disjoint declarations do not prove semantic independence or predict every conflict.
The agent reviews shared changing interfaces and representations before making that judgement.

## Inspect and inventory

```sh
node skills/repo-audit/scripts/repo-audit.mjs inspect --repo <path> --json
node skills/repo-audit/scripts/repo-audit.mjs inventory --repo <path> --json
```

Both commands accept only `--repo` and optional `--json`, with the shared argument and result contracts.
They resolve the Git root even when the selected directory is nested, and do not create scratch or write target files.
Non-Git targets are blocked, and `--workspace` is a usage error.
They recursively discover regular files, excluding `.git`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist`, `build` and `.cache` directories.
Directory and file symlinks are not followed during recursive discovery.
Unreadable filesystem sources block the command.
Discovery is bounded by these traversal and name rules, rather than a semantic judgement of every repository file.

`inspect` returns `data.root`, `revision` (a Git object ID, "no commits" for an unborn branch, or null when HEAD cannot be resolved), `changes`, `manifests` and `prerequisites`.
Each change contains the two-character porcelain status and literal repo-relative path, plus `originalPath` for a rename or copy.
Manifest entries contain the path and exact-byte SHA-256 `hash`.
Known manifests include Node package and npm, pnpm, Yarn and Bun locks, Python pyproject, requirements, Pipfile, uv and Poetry locks, Cargo, Go, Gemfile and Composer files.
Prerequisites contain `tool`, `found` and `version` (null when unavailable).
Git and the running Node are always checked.
Node manifests select their named npm, pnpm, Yarn or Bun package manager, defaulting to npm.
Python manifests select `python3` on Unix or `python` on Windows, and lockfiles also select uv, Poetry or Pipenv.
Other recognised stacks select Cargo, Go, Bundler or Composer.
Version probes use argument arrays, the shared launcher resolver and a ten-second timeout per tool.
Missing tools yield `prerequisite-unavailable` with the tool name, malformed package JSON yields `manifest-unreadable`, and unreadable available Git history or working-tree state yields `history-unreadable` or `working-tree-unreadable`.
These limitations return blocked, preserving any state already observed.
Git discovery failure yields the shared `git-unavailable` problem before inspection.
Available history is read, including shallow history as stored locally, without fetching missing ancestors.
Tool version discovery does not prove native checks ran or all project-specific prerequisites are available.

`inventory` returns `data.root`, `files`, `absent`, `candidates` and `shadowing`.
Every file has `path`, exact-byte SHA-256 `hash` and `kind`.
Names are case-insensitive for documents with Markdown, reStructuredText or text extensions.
Name families accept hyphens, underscores or spaces between words where shown below.

| Kind | Names |
|---|---|
| vision | vision, goals, purpose, product requirements, requirements, prd |
| design | design, architecture, technical design, principles |
| glossary | glossary, vocabulary, domain language, domain vocabulary, terms |
| context-map | context map, contexts |
| standards | coding standards, code standards, review standards, contributing, contribution guidelines, style guide |
| decisions | decisions, adr, architecture decisions, decision log, or documents under adr, adrs, decisions or architecture-decisions directories |
| audit | repo audit, audit, audit record, audit findings, technical debt, known debt |
| context | readme |

Instruction names are exact: `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md`, at the root or in nested scopes.
Instruction entries also contain `directory`, `scope`, `insideRepo`, `scoped` and `local`.
`.claude/CLAUDE.md` governs its parent scope, not the `.claude` folder alone.
Other instruction names inside `.claude` keep that folder as their scope.
Paths and directories inside the repo are repo-relative, using forward slashes, and the root scope is `.`.
Instruction sources in ancestor directories, including ancestor `.claude/CLAUDE.md`, use absolute paths and have `insideRepo: false`.
Missing repo-owned source kinds appear in `absent`, without failure or an invented fallback document.
Discovered sources require content review to establish authority.

Root repo-owned `CLAUDE.md` yields a `merge-claude-instructions` candidate, including import-only stubs.
Candidates carry `path`, `destination`, `scope`, `requiresEquivalentContent`, a review message and the design's Claude Code version limit.
They require equivalent-content review, a fresh official documentation and runtime check, author approval and protected edits before removal.
Distinct nested guidance stays scoped and produces no root consolidation candidate.
An exact-byte equivalent nested file or a lone import of the same scope's existing `AGENTS.md` yields only a candidate targeting that scope's `AGENTS.md`.
Local variants and ancestor instructions are possible shadowing reports with `modifiable: false`, never consolidation candidates.

## Research citation check

`node skills/repo-audit/scripts/repo-audit.mjs cite-check --repo <path>|--workspace <path> --report <file> [--json]` checks a scratch research report without target writes.
The report follows `skills/repo-audit/schemas/research-report.json`, version 1.
It requires the actual mode, host, observed subagent and web capabilities and one or more uniquely identified briefs.
Brief IDs are documents, architecture, checks, language and outside.
Each brief records its actual scope, concise findings, limitations, file citations and web citations.
The [research briefs](../skills/repo-audit/references/research-briefs.md#execution-and-report-contract) own brief selection and execution guidance.

Each file citation has a repo-relative `location` in `path:line` form and a `state` with kind sha256 or revision and its lowercase hex value.
Use forward slashes for portable repo-relative paths.
SHA-256 values have 64 digits and bind exact file bytes, including line endings.
Revision values have 40 digits and identify the Git commit whose cited file bytes were read.
The checker compares current bytes with the file object at that revision, so unrelated later commits do not invalidate an unchanged citation.
Changed working-tree bytes, unavailable revisions, missing or unreadable files and out-of-range lines fail.
Line numbers are positive and one-based, with LF, CRLF and CR separators supported.
An empty file has zero lines and a final separator does not add a phantom line.
Use SHA-256 for uncommitted files and non-Git workspaces.

Each web citation records an HTTP(S) URL, a real YYYY-MM-DD read date and verified or unverified status.
The checker validates these metadata fields without fetching the URL or establishing that its content supports a claim.
The main thread opens and checks each cited source before using a report, including after subagent research.
Without web access, the research report marks language-specific and outside recommendations not researched with the reason.

Unknown fields, malformed report JSON, duplicate brief IDs and invalid citation states fail with exit 1 and named problems.
Missing --report is a usage error, exit 3.
Successful JSON output records mode, filesChecked, webRecorded and webVerifiedByChecker false.
An empty file-citation list is valid for a brief with only unavailable or outside sources, and filesChecked explicitly reports zero.

## VISION board build

```sh
node skills/repo-audit/scripts/repo-audit.mjs vision-board build --workspace <existing-directory> --draft <file> --proposals <file> --json
```

Use `--repo <path>` for a Git target or `--workspace <path>` for a new-idea workspace.
Both inputs are explicit readable files, resolved from the caller's directory.
The draft is nonempty UTF-8 Markdown.
Proposals conform to `skills/repo-audit/schemas/vision-proposals.json`:

```json
{
  "schemaVersion": 1,
  "draftRevision": "<SHA-256 of exact draft bytes, 64 lowercase hexadecimal characters>",
  "project": "Project name",
  "runNote": "Author decisions, first review",
  "cards": [{
    "id": "H-1",
    "title": "A concrete change",
    "body": "The proposed change.",
    "tests": "The quoted draft principle.",
    "why": "The strongest case for each side."
  }]
}
```

This shape illustrates fields.
The [executable draft](../tests/inputs/vision-draft.md) and [matching proposals](../tests/inputs/vision-proposals.json) provide a complete valid pair.
Supply at least one card when a real unresolved trade-off warrants a board.
All fields are required, all card strings and the project name must be nonempty, and unknown fields are rejected.
IDs must be nonblank and unique by exact string value.
The revision is SHA-256 of exact draft bytes without line-ending normalisation.
Review proposals against changed draft bytes before updating their revision.

Missing or unknown options produce usage error 3.
Unreadable inputs, invalid JSON/schema, invalid UTF-8, an empty draft, missing/duplicate IDs or a stale revision fail with exit 1 before scratch creation.
Unavailable target, cache or bundled resources produce blocked exit 2 and a named prerequisite.
On success, exit 0 returns the shared envelope with `data.board`, `data.scratch`, `data.runId`, `data.draftRevision` and ordered `data.cardIds`.
Use `--json` to retrieve these paths and bindings.
Scratch contains `board.html`, the unchanged `review.css`, exact `draft.md` bytes, `proposals.json` and a versioned `board.json` manifest bound to the resolved target.
Each build creates a distinct run and preserves earlier drafts, without changing the target.

The full draft and one-card stack retain the upstream layout and review mechanics.
Inserted title/header text is escaped for HTML, while script values use JSON with HTML delimiters and Unicode line separators escaped.
Card and ledger text is escaped at DOM insertion without changing raw IDs or reasoning in feedback.
Individual `vision-verdict` and complete-round payloads carry schemaVersion, runId and draftRevision.
Card queue keys use a `vision-card:` prefix so an ID cannot collide with the round-completion key.
The observed pinned runtime returns that context as JSON embedded after `Context data:` in tagged prompts.
The agent owns semantic revisions from author reasoning, with previous drafts preserved.
The build command generates the board for the launch and verdict commands below.

## VISION board launch and verdicts

```sh
node skills/repo-audit/scripts/repo-audit.mjs vision-board launch --workspace <existing-directory> --board <scratch-board.html> --json
node skills/repo-audit/scripts/repo-audit.mjs vision-board verdicts --workspace <existing-directory> --board <scratch-board.html> --input <round.json> --draft <revised.md> --json
```

Both commands also accept --repo for a Git target.
Resume uses the explicit board path from an earlier build, preserving its original draft and proposals.
The manifest target, original exact-byte draft hash and ordered proposal IDs must still agree.
A different target or changed draft fails with incompatible-board before launch or new scratch creation.
Missing board files or inaccessible resources are blocked with a restoration fix.
Legacy boards without target metadata need a new build from the preserved draft.

Launch runs the installed pinned Lavish JavaScript CLI through Node with literal arguments.
It captures runtime output in scratch launch.json and returns runtimeOutput plus listener executable and args with --json.
Read the printed URL and next_step, open the URL in a reachable browser, and run that listener in the terminal.
The listener uses the pinned runtime's foreground long-poll interface with no debugging timeout in normal use.
It consumes feedback once, so preserve its entire returned response before resuming.
Follow the runtime's ended-session and browser-disconnection instructions.
With no reachable browser, preserve scratch and report interaction blocked.
Runtime launch failures return blocked exit 2 with the nested install and server-access fix, leaving draft.md unchanged.
The runtime inherits the host's server and state configuration.
See the [manual procedure](../tests/eval/results/tasks/C10b.manual-board.md) for the observed server setup and interaction limits.

Verdicts takes the complete-round Context data JSON embedded in the terminal's vision-verdict prompt.
Copy that JSON unchanged to a scratch file, retaining the captured terminal response as provenance.
The installed [vision-verdicts schema](../skills/repo-audit/schemas/vision-verdicts.json) defines the input fields and accepted verdict labels:

```json
{
  "schemaVersion": 1,
  "runId": "<board run ID>",
  "draftRevision": "<original exact-byte draft SHA-256>",
  "complete": true,
  "verdicts": [{ "id": "H-1", "verdict": "Conditional", "notes": "Author reasoning" }]
}
```

Every original card must occur exactly once.
Unknown, missing, blank or duplicate IDs, unknown fields or verdict labels, incomplete rounds and incompatible run or draft bindings fail with exit 1 before creating a new scratch draft.
The agent interprets author reasoning into the nonempty UTF-8 revised Markdown supplied as --draft.
The script validates transport and saves those exact revised bytes, rather than inferring semantic edits or author approval.
On success it creates new scratch draft.md and review.json, returning their paths, the revised hash, previousDraft and approval: pending-author-review.
Review metadata preserves the verdicts, original run ID, reviewedDraftRevision, previousBoard and previousDraft alongside the new draftRevision.
The original draft, board, proposals and decisions remain available for resumed review.
Present the saved revision and edit-to-verdict explanation for explicit author approval, retaining the approval and revision in the scratch transcript.
Another board round builds from that saved draft with matching proposals and uses the retained review.json decisions.
No board command changes the target or initialises Git, and a successful verdict command does not complete approval.

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
When `data.path` is present, plain output also prints that path after the status summary.
Child output must go to captured artifacts, never alongside the JSON envelope.
Child execution and fingerprints are implemented in C4b.

## Child commands

`runCommand(target, command, { signal, env, outputLimitBytes })` accepts `{ executable, args, cwd, timeoutMs, versionArgs }`.
`args` and `versionArgs` are arrays of literal strings.
`cwd` is a required target-relative directory, resolved with the path contract before spawning anything.
`timeoutMs` defaults to 120000 and must be a positive safe integer.
`env` defaults to `process.env`; a supplied object replaces the child environment for launcher selection, the version probe and execution without mutating the caller's environment.
`outputLimitBytes` defaults to 65536 and must be a positive safe integer.
The version probe runs first with the same working directory, environment, timeout, output limit and cancellation signal.
A non-passing version probe blocks execution of the requested check.
Each invocation has its own timeout.

The returned execution record contains `status`, `stdout`, `stderr`, `durationMs`, `exitCode`, `signal`, `timedOut`, `cancelled`, `outputTruncated` and `error`.
`toolVersion` contains the same record for the version probe, including its captured output.
Output is captured as the last `outputLimitBytes` bytes of each stream, decoded as UTF-8, and never printed by the library.
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
On Windows, `npm`, `pnpm` and `yarn`, including their `.cmd` names, select their JavaScript CLI through one shared resolution path.
The entry points are `node_modules/npm/bin/npm-cli.js`, `node_modules/pnpm/bin/pnpm.cjs` and `node_modules/yarn/bin/yarn.js`, searched beside Node and then under semicolon-separated PATH entries.
For npm only, `npm_execpath` pointing to an accessible `npm-cli.js` takes precedence.
Node executes that entry point with literal arguments.
Missing entry points yield `npm-cli-unavailable`, `pnpm-cli-unavailable` or `yarn-cli-unavailable` with a prerequisite and fix.
Other explicit `.cmd` or `.bat` launchers yield `command-file-unsupported`.
No child uses shell interpretation.
Direct `npm.cmd` execution returned `EINVAL` in a Windows Node `v24.16.0` probe.
The platform constraint is documented in [Node's child-process guide](https://raw.githubusercontent.com/nodejs/node/v24.0.0/doc/api/child_process.md).
Windows command selection is tested with injected win32 on Linux in C4b and C11bc, including fixture PATH launchers for all three package managers and literal JavaScript CLI arguments.
Real Windows process execution remains unverified under R26; the [C11bc task evidence](../tests/eval/results/tasks/T2.2.json) records this captain checklist limitation.

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
The supported keywords are `$schema`, `title`, `type`, `const`, `enum`, `properties`, `required`, `additionalProperties`, `items`, `minItems`, `minLength`, `pattern` and `uniqueItems`.
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
`uniqueItems` requires a boolean and compares canonical JSON values, including object properties independent of their order.
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

## Findings

`findings validate --findings <file> --json` and `findings render --findings <file>` require an explicit `--repo` or draft-only `--workspace` target.
The [findings schema](../skills/repo-audit/schemas/findings.schema.json) owns every field.
Complete [audit](../tests/inputs/findings-audit.json) and [foundation](../tests/inputs/findings-foundation.json) examples deliberately lack execution evidence and therefore cannot claim ready.
Replace their target placeholder with the resolved root and record the current full Git HEAD, or null for a repo without commits or a non-Git workspace.

The reviewed scope lists concrete target-relative file paths, including planned absent files, rather than directory names or globs.
Finding files and scope must be within that reviewed scope.
Each finding inherits the reviewed target and stated next change from the containing record.
Its fields state the problem, files or failing command, principle, consequence, fix, scope, verification, whether it blocks the next change, category, selection status, proposed-new-principle flag, resolution and source IDs.
Sources carry unique IDs, pointers, summaries and documented, observed or inferred intent.
Open and verify source citations using cite-check before relying on them.
These pointers identify evidence rather than duplicate authoritative principles.
The findings validator checks source joins, not the meaning of citations or their truth.
Unknown source IDs, duplicate joining IDs, paths outside scope and inconsistent selections fail validation.
`selectedFindingIds` must match exactly the findings whose status is selected.
Selection authorises a proposed fix, while `resolved` records its observed completion or the owner's settled decision.
Rejecting a blocking finding does not resolve the block.
Proposed new principles appear separately for review and remain decisions needed while proposed.

Stage requirements are deliberately bounded:

| Stage | Mandatory outcomes | Meaning |
|---|---|---|
| audit | starting-checks | The observed current native checks establish the starting state for the stated next change |
| foundation | journey, foundation-review | The agreed important journey succeeds and review confirms that the selected foundation fits the approved project intent |

`requiredOutcomes` includes every stage requirement and any further outcome the approved scope needs.
For example, add a journey to audit readiness when the stated next change relies on that flow.
A foundation claim cannot substitute audit starting checks for its journey or review.
These stages do not claim later maintained enforcement, portable assessment or final release acceptance.

Validation returns the current fingerprint even when evidence is missing.
It hashes the real target root, reviewed revision, exact scoped file bytes and modes, including absence, and all substantive findings inputs except `execution`, using the T0.4 fingerprint contract.
Capture each approved outcome against that fingerprint with a unique record ID, outcome name, actual status, method, output artifact path and exact-byte SHA-256.
Artifact paths resolve from the invoking cwd and may be absolute scratch paths.
Keep artifacts outside the reviewed files so capturing them does not itself invalidate the reviewed state.
One current record per outcome prevents contradictory duplicate outcomes.
These commands read supplied observation records and artifacts without executing checks.
They do not prove that a supplied observation is truthful or that the chosen outcomes exhaust the user's requirements.
Automatic command capture belongs to T2.7.

Both stages use this verdict precedence:

1. Verification blocked if the Git revision differs, a required outcome is missing, or any supplied outcome failed, was blocked or skipped, has a stale fingerprint or has unavailable or changed artifact bytes.
2. Decisions needed if current verification passes but a decision or blocking finding remains unresolved, or a new principle is still proposed.
3. Ready for the stated next change only when every required outcome is current and passed and no such decision remains.

Nonblocking debt can remain visible without preventing readiness.
A failed journey always blocks, including when units passed or the journey was omitted from requiredOutcomes.
The report has one result and no score, and shows source intent, debt, missing protections, decisions, selected findings, proposed principles and limitations.
Malformed input fails with named problems and no writes.
Missing evidence is a valid input with a verification-blocked assessment, rather than a schema failure.
A completed readiness assessment uses command status `passed` with exit code 0 even when readiness is blocked or decisions are needed.
Read `data.result` and `data.reasons` to determine readiness.
`validate` writes nothing.
`render` writes only `repo-audit.md` in a fresh OS-cache scratch run and returns `data.path` in JSON or the path in plain output.
An inside-target cache blocks rendering.
Writing the reviewed report into the project's audit record remains T2.6 C14b work.

## Apply dry run

```sh
node skills/repo-audit/scripts/repo-audit.mjs apply --repo <path> --plan <file> --dry-run [--json]
node skills/repo-audit/scripts/repo-audit.mjs apply --workspace <path> --plan <file> --dry-run [--json]
```

C14a implements validation and preview only.
Omitting `--plan` or `--dry-run` is a usage error.
No target, scratch, dependency or journal files are written by this command.
Real writes, backups, resume, repeat execution, `state show` and reviewed whole-file replacement remain C14b.

The [change-set schema](../skills/repo-audit/schemas/change-set.schema.json) owns the plan fields.
Each plan declares `schemaVersion: 1`, `target`, `findings`, `findingsDigest`, `selectedFindingIds`, `reviewedScope`, `edits` and `planDigest`.
`--plan` resolves from the invoking cwd; `findings` resolves from the plan's directory and names the full T2.5 findings input.
Both the findings and plan schemas reject unknown fields.
Findings use the same structural, source-join, scope and selection validator as `findings validate`.
The plan's target must match the findings and explicitly selected real target, including mode and current Git HEAD, or null for an unborn repo or workspace.
Unresolved design decisions block the preview.
Finding resolution records observed completion, so a selected debt finding may still be unresolved before previewing its fix.
Preview does not establish readiness, execute checks or validate the truth of supplied evidence.

The plan's selections must exactly match the findings marked selected.
`reviewedScope` lists concrete files as `{ "path": "README.md", "resolvedPath": "<real-target>/README.md" }`, including planned absent files.
It must match the findings scope exactly, without duplicates, directories or globs.
Each path is resolved again through existing links and missing parents.
Traversal, escaping links and changed resolutions fail before any preview is returned.
Every edit must belong to its selected finding's scope.
Use one complete edit per resolved file; duplicate IDs and overlapping aliases fail.

Compute `findingsDigest` as SHA-256 of UTF-8 canonical JSON of the entire findings object, including execution records.
Compute `planDigest` the same way from the entire plan with only the top-level `planDigest` omitted.
Canonical JSON recursively sorts object keys, preserves array order and uses `JSON.stringify` for strings and primitive values, without spaces.
For example, `{ "b": 1, "a": [true, null] }` canonicalises to `{"a":[true,null],"b":1}`.
This binds target identity, selections, resolved scope, findings digest, operation payloads and complete proposed bytes.
The digest detects changes to reviewed inputs; it does not prove author approval.
A changed digest, selection, scope, link target, revision or file precondition requires a fresh review.

Each edit declares a unique `id`, selected `findingId`, target-relative `path`, `originalHash`, `proposedHash`, `operation`, `payload` and `proposedContent`.
Hashes are lowercase SHA-256 of exact UTF-8 bytes, preserving BOM and line endings.
Explicit null means absence, while the hash of an empty string means a present empty file.
The helper derives the full proposed content from the operation and checks it against both `proposedContent` and `proposedHash`.
Original file bytes must match `originalHash`; a create must start absent and a delete must start present.
Complete bytes for every file are staged in memory before reporting success.
If any file fails, no diff or proposed edits are returned and every project file remains unchanged.
Filesystem access failures block the command; invalid plans fail with named problems and renewed-review guidance.

| Operation | Exact payload | Supported scope |
|---|---|---|
| `create` | `{ "content": "complete new text" }` | An absent UTF-8 `.md`, `.txt` or `.json` file; JSON must be an object without duplicate keys |
| `replace` | `{ "search": "unique nonempty literal", "replacement": "new text" }` | One exact occurrence in `.md` or `.txt`; an empty replacement keeps the file present |
| `delete` | `{}` | One existing UTF-8 text file; both proposed fields must be null |
| `set-heading-section` | `{ "heading": "ATX heading title", "content": "new body\n" }` | `.md`; exactly one matching nonempty ATX heading at column 0 outside fenced code, replacing its body and subsections until the next same-or-higher-level heading |
| `set-json-key` | `{ "key": "root key", "value": { "any": "JSON value" } }` | A `.json` object; replace one root value or insert a missing root key, preserving other bytes |
| `append-line-once` | `{ "line": "one nonempty line" }` | `.md` or `.txt`; leave an existing exact line intact, otherwise append it using CRLF when present, LF otherwise |

Payloads reject unknown and missing fields.
Malformed JSON, duplicate keys at any depth (including escaped equivalents), JSON arrays at the root, binary/non-UTF-8 text and unsupported extensions fail.
Heading edits support unindented prose, nonempty ATX headings at column 0 and closed fences at column 0 with an optional plain info word containing letters, digits, underscores, plus signs, dots or hyphens.
Outside fenced code, indented content, lists, block quotes, HTML-like markup, tables, reference definitions, empty headings, setext headings and thematic breaks are unsupported.
Indented backtick or tilde fence markers are unsupported anywhere, including inside fenced code.
Unsupported structures fail with `Unsupported Markdown structure; use whole-file replacement.` rather than guessing a section boundary.
The selected heading needs a line ending and a nonempty new body must end with a newline.
Replacement searches with zero or multiple occurrences fail.
Unsupported edits need the C14b reviewed whole-file interface.

For a selected replacement, an edit has this shape:

```json
{
  "id": "E-001",
  "findingId": "F-001",
  "path": "README.md",
  "originalHash": "<SHA-256 of old\\n>",
  "proposedHash": "<SHA-256 of new\\n>",
  "operation": "replace",
  "payload": { "search": "old", "replacement": "new" },
  "proposedContent": "new\n"
}
```

The public-command suite constructs complete plans, computes these digests independently and verifies successful and invalid previews against before/after project fingerprints.
Plain output prints a full-file unified diff with target-relative labels and missing-final-newline markers.
CRLF carriage returns remain in the diff; there is no line-ending normalisation.
JSON returns `data.planDigest`, `data.dryRun`, `data.diff` and `data.edits` containing each complete proposed content, original/proposed hashes and diff.
An unchanged proposed file produces an empty diff.

The [resume-state schema](../skills/repo-audit/schemas/resume-state.schema.json) is defined now for C14b.
It declares `schemaVersion`, `runId`, the reviewed target, `planDigest`, per-edit IDs, paths, original/proposed hashes, backup paths or explicit null for absent originals, completion flags and `affectedChecks`.
C14b will derive pending, applied and conflicting states from actual hashes, preflight all remaining edits, preserve recoverable backups and report affected checks.
The schema alone does not implement recovery or authorise trusting completion flags.
