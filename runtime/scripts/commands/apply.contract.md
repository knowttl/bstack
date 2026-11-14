## Apply dry run

```sh
node skills/verification/scripts/verification.mjs apply --repo <path> --plan <file> --dry-run [--json]
node skills/verification/scripts/verification.mjs apply --workspace <path> --plan <file> --dry-run [--json]
node skills/verification/scripts/verification.mjs apply --repo <path>|--workspace <path> --plan <file> [--json]
node skills/verification/scripts/verification.mjs state show --repo <path>|--workspace <path> --run <id> [--json]
```

`--plan` is required, while `--dry-run` selects validation and preview only.
Dry run writes no target, scratch, dependency or journal files.
Omitting `--dry-run` applies or resumes the reviewed plan with backups and a durable journal.
The plan digest selects the run automatically.

The [change-set schema source](../runtime/schemas/change-set.schema.json) owns the plan fields.
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
For a fresh plan or dry run, current file bytes must match `originalHash`; a create must start absent and a delete must start present.
Resume validates the saved originals against `originalHash` and derives current file states as described below.
Complete bytes for every file are staged in memory before reporting success.
The installed [checks reference](../skills/foundation/references/checks.md#integrate-the-maintained-command) owns selected `checkIntegration` paths, their bounded command grammar, supported CI format and disposable-proof requirements.
If any file fails input validation or staging, no diff or proposed edits are returned and every project file remains unchanged.
Filesystem access failures block the command; invalid plans fail with named problems and renewed-review guidance.

| Operation | Exact payload | Supported scope |
|---|---|---|
| `create` | `{ "content": "complete new text" }` | An absent UTF-8 text file, including source files; `.json` content must be an object without duplicate keys |
| `replace` | `{ "search": "unique nonempty literal", "replacement": "new text" }` | One exact occurrence in `.md` or `.txt`; an empty replacement keeps the file present |
| `replace-file` | `{ "content": "complete reviewed text" }` | One existing UTF-8 text file, without extension or parser restrictions; use for unsupported mechanical edits |
| `delete` | `{}` | One existing UTF-8 text file, without an extension restriction; both proposed fields must be null |
| `set-heading-section` | `{ "heading": "ATX heading title", "content": "new body\n" }` | `.md`; exactly one matching nonempty ATX heading at column 0 outside fenced code, replacing its body and subsections until the next same-or-higher-level heading |
| `set-json-key` | `{ "key": "root key", "value": { "any": "JSON value" } }` | A `.json` object; replace one root value or insert a missing root key, preserving other bytes |
| `append-line-once` | `{ "line": "one nonempty line" }` | `.md` or `.txt`; leave an existing exact line intact, otherwise append it using CRLF when present, LF otherwise |
| `move-rule` | `{ "sourcePath": "DESIGN.md", "destinationPath": "CONTRIBUTING.md", "rule": "complete rule block\n", "link": "[Rule](CONTRIBUTING.md#rule)\n", "destinationAnchor": "unique insertion text\n" }` | Two matching selected `.md` edits; replace the source rule with the exact link and insert the unchanged rule after the destination anchor |

For `move-rule`, supply one source edit and one destination edit with identical payloads and the same selected finding.
Both paths must be in that finding's reviewed scope, with independently reviewed original/proposed hashes and complete proposed content.
The source rule is a nonempty newline-terminated literal block occurring exactly once at a line boundary.
An existing destination needs a unique nonempty newline-terminated insertion anchor and must not already contain the rule.
For an explicitly selected new destination, use an empty anchor; its complete content is the rule block.
The replacement is one exact newline-terminated ordinary inline link line pointing to the selected destination, with any heading fragment verified against the final proposed bytes.
Replacement labels contain no brackets, backslashes, backticks or emphasis markers; destinations contain no whitespace, backslashes, parentheses, brackets, angle brackets or backticks and cannot include titles or trailing text.
The final source must contain no copy of the rule and exactly one replacement link; the final destination must contain exactly one copy of the unchanged rule.
Apply validates the paired edits and all other file changes before writing either file, then uses the existing recoverable protected-write journal.
If either proposed document or a fragment target exceeds reference coverage, apply returns `blocked` with `data.coverageLimits` and writes neither file, including in dry runs.
As with other operations, this validates inputs together but does not promise a single atomic filesystem transaction; interruption uses the documented resume protocol.
Prefer an existing authoritative design section or CONTRIBUTING.md over creating CODING_STANDARDS.md.
Choosing the authoritative home and judging semantically equivalent duplicate rules remain part of selected review, rather than filename-based automation.

Payloads reject unknown and missing fields.
Plan inputs reject malformed JSON, duplicate keys at any depth (including escaped equivalents) and numbers that decode to nonfinite values.
JSON create and key edits also reject malformed JSON, duplicate keys, nonfinite numbers and non-object roots.
All operations reject binary/non-UTF-8 text; mechanical partial edits reject unsupported extensions.
`set-heading-section` and `append-line-once` reject any target file containing a bare carriage return (CR not followed by LF) before matching, with no project writes.
These line-based operations support LF and CRLF without normalising existing bytes.
Heading edits support unindented prose, nonempty ATX headings at column 0 and closed fences at column 0 with an optional plain info word containing letters, digits, underscores, plus signs, dots or hyphens.
Outside fenced code, indented content, lists, block quotes, HTML-like markup, tables, reference definitions, empty headings, setext headings and thematic breaks are unsupported.
Setext underlines and thematic-break lines remain unsupported with trailing spaces or tabs.
Indented backtick or tilde fence markers are unsupported anywhere, including inside fenced code.
Unsupported structures fail with `Unsupported Markdown structure; use whole-file replacement.` rather than guessing a section boundary.
The selected heading needs a line ending and a nonempty new body must end with a newline.
A leading UTF-8 BOM is ignored when matching headings, fences and existing lines, while its bytes remain preserved.
Replacement searches with zero or multiple occurrences fail.
For unsupported mechanical edits, review complete text with `replace-file`, using the same selected finding, scope, hashes and digest checks.
That operation treats the reviewed content as opaque UTF-8 text rather than trying another parser.

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
Dry-run plain output prints a full-file unified diff with target-relative labels and missing-final-newline markers.
CRLF carriage returns remain in the diff; there is no line-ending normalisation.
Dry-run JSON returns `data.planDigest`, `data.dryRun`, `data.diff` and `data.edits` containing each complete proposed content, original/proposed hashes and diff.
An unchanged proposed file produces an empty diff.

The [resume-state schema source](../runtime/schemas/resume-state.schema.json) owns the durable journal.
The run ID is the reviewed plan digest, under the target's existing OS-cache identity folder.
Before any replacement, apply revalidates all targets, stages complete proposed bytes, saves exact originals in scratch and flushes the journal containing original/proposed hashes.
Each replacement uses a flushed same-directory temporary file followed by rename, preserving existing file permissions.
A selected delete removes the target while preserving its original backup and explicit absent proposed hash.
An internal alias retains its reviewed resolved identity when a journalled deletion leaves its referent absent, so state inspection and repeat still recognise the applied edit.
Fresh plans and dry runs reject dangling links, including creates through links to absent targets.
Completion is journalled after replacement.
Replacement is atomic per file where supported, never across the whole set.
Unsupported atomic replacement blocks without a non-atomic fallback.
Unsupported directory flushes are reported as a power-loss durability limitation.

Repeating a plan automatically opens its digest-bound journal and validates its identity and backups before staging from the original bytes.
Actual proposed hashes mean applied; original hashes mean pending only when completion has not been recorded.
Any other state or unreadable path means conflicting, including completed edits restored to their original bytes or absence.
When original and proposed hashes are equal, the edit is already applied.
Completion flags never override actual target hashes.
Before writing a replacement, the journal records its same-directory temporary path.
Resume removes a recorded temporary only if its bytes match the proposed content or a prefix of it; unrelated bytes block continuation and are preserved.
All remaining files are preflighted before continuing, with another complete check before each replacement.
A user change to any pending or completed file blocks all further writes.
A repeated completed plan with no pending journal recovery returns `data.outcome: "already-applied"` without updating targets, originals or journal.
Changed digests or targets cannot reuse earlier completion.
On write or journal I/O failure, apply returns blocked, preserves any published journal and reports actual applied, pending and conflicting paths.
Failure before the initial journal is published leaves targets unchanged; `state show` reports a missing journal until preparation succeeds.
Failure after target writes can leave a partially applied set, with saved originals retained for resume.
Resume with the unchanged plan after resolving filesystem access.
