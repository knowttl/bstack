# Shared command contracts

## Standalone checker generation

`node scripts/generate-checker.mjs --repo <target> [--check] [--json]` generates the C24a artifact from this checkout's shared validator sources.
Run `npm ci` in the source checkout first.
The pinned esbuild development dependency bundles Node ESM and embeds the imported JSON schemas.
The emitted file uses only Node built-ins and needs no skill folder or installed dependencies.
Its exported `buildVersion` records the package version, bundler version and a digest of source modules, schemas, generator and package manifests.
Changed source bytes invalidate freshness even when their bundled executable output would be equivalent.

With `--check`, generation stays in memory and compares exact bytes against `skills/repo-audit/scripts/bstack-check.mjs` in the source checkout.
The command returns `passed` (exit 0) for current bytes or `failed` with problem code `stale-checker` (exit 1) for absent or different bytes.
It creates no scratch directory and changes neither source nor target.
`npm run check` runs this freshness gate after package validation.

Without `--check`, the command writes `bstack-check.mjs` and `checker-proposals.json` to ordinary bstack scratch outside the selected target.
The JSON result names `checkerPath`, `proposalsPath` and `proposedHash`; plain output names the proposal file.
Regeneration changes neither the target nor the canonical generated resource.
Review the returned bytes before updating the canonical resource during development.

Each installation proposal targets `.bstack/bin/bstack-check.mjs`, names its exact original and proposed hashes, and contains the complete UTF-8 bytes and diff.
An absent destination uses `create`; an existing destination uses `replace-file`; an identical destination produces no proposal.
The proposal alone is not permission to write.
Select its foundation finding and bind it to the reviewed change set, including resolved scope and findings and plan digests.
Use the existing `apply --plan <file> --dry-run`, then `apply --plan <file>` interface.
Apply validates the selected finding and exact bytes before writing; a destination changed since review survives with a non-passing result.
An existing user-edited checker requires review of its specific replacement, never unconditional overwrite by regeneration.

C24a exports `validateContract`, `checkDocuments`, `checkGeneratedFacts`, `validateEvidence` and `validateData` from the same sources as the skill commands.
`checkGeneratedFacts` always selects check mode and cannot create regeneration proposals.
The existing validators retain their coverage and proof limits, including generated commands' read-only contract and local evidence captures' lack of portable attestation.
C24b adds the aggregate execution interface below.
Maintenance guidance remains T3a.7, and hosted CI behavior is unverified.

## Standalone checker execution

```sh
node .bstack/bin/bstack-check.mjs --repo <path> --base <ancestor-commit> --assessment <file> [--contract <repo-relative-file>] [--json]
```

Node 24 and Git are required; the installed file needs no dependencies, skill installation or agent session.
The caller selects every input explicitly; the assessment path is caller-relative and the contract defaults to `.bstack/project.json`.
The result uses the shared exit codes: 0 passed, 1 failed, 2 blocked and 3 usage error.

Preflight validates the live inventory, previous/proposed contracts, substantive assessments, source citations, review fingerprint, document references and generated facts.
It inspects package script dependencies and every required previous/proposed leaf for cycles and obvious aggregate recursion before executing leaves.
Generated-fact commands retain their existing read-only contract.
Each affected required leaf declaration runs once in each checker invocation, with its declared version probe and normal timeout/cancellation handling.
Result validation uses only these current executions, never saved `execution` references in the assessment.
Changed review inputs block final validation, and failed or incomplete required executions cannot pass.
Completed leaf execution writes a fresh scratch `checker-result.json` containing source and base objects, their computed merge base, timestamps and current command results, including failures.
The selected ancestor policy requires that merge base to equal the assessment's comparison object.
The checker never edits the assessment.
Opaque leaf programs retain the existing review boundary: only supported direct invocations and package aliases are inspected for recursion.

### Portable committed review

Commit implementation changes before collecting portable review:

```sh
node skills/repo-audit/scripts/repo-audit.mjs evidence collect --repo <target> --base <ancestor-commit> --portable .bstack/assessment.json --json
node skills/repo-audit/scripts/repo-audit.mjs evidence validate --repo <target> --base <ancestor-commit> --assessment <target>/.bstack/assessment.json --json
```

Copy the returned skeleton to the explicitly selected repo-relative assessment path and complete its substantive claims through the selected review process.
Validation returns the fingerprint to record after review, even while leaf execution is still missing.
Commit the completed, bound assessment separately and run the installed aggregate.
Portable records use `repo: "."` and retain the reviewed implementation commit in `head`.
That commit must be an ancestor of submitted HEAD, with no subsequent source changes except the selected assessment itself.
Portable inventory omits that record's own path, and portable fingerprints replace absolute roots with `.` and normalize modes to executable bits.
The record's substantive claims are still hashed; this narrow self-exclusion avoids making its own commit or serialized hash self-referential.
Renaming the selected record together with a source path is unsupported.
The aggregate requires the selected file's bytes to match its committed HEAD blob.
Local records retain absolute-root and live-HEAD behavior and cannot claim portable clean-checkout evidence.
Neither format authenticates semantic review or owner approval.

Clone into a different root, use a fresh isolated home and cache with no installed repo-audit skill, and pass the same base and committed record explicitly.
No earlier cache entry or leaf success can satisfy that clone's current run.
Missing assessment files and missing comparison objects block rather than producing an empty diff.
A shallow checkout missing its base reports the required fetch:

```sh
git fetch --unshallow origin
git fetch origin <required-base-commit>
```

For a full clone with a missing object, fetch the required commit explicitly.
After rebasing or changing the agreed base, recollect, review, bind and commit the assessment again.
`--base empty` remains supported only before a repository's first commit, using an explicitly selected initial foundation assessment.

### Previous-policy execution

When a change modifies the installed checker or either contract location, the aggregate extracts the base's `.bstack/bin/bstack-check.mjs` to scratch and invokes its exported `runChecker` against the proposed target and selected assessment before its current leaf phase.
That comparison invocation has its own fresh leaf results; it does not recurse into another comparison invocation.
The explicit assessment carries the reconciled `previousContract` path, including custom prior authority.
Previous scopes and required checks remain obligations when the proposed policy removes them.
A deleted prior config without a clear Git rename stays blocked for reconciliation, including when a replacement checker would return success.
For independently selected delivery checks, extract and run the prior file directly with the same explicit inputs as well.
An absent or incompatible prior checker blocks for a recorded migration decision and explicit prior coverage; this slice does not silently waive that prerequisite.
A selected first-installation foundation with no previous policy has no prior checker to execute.
The delivery process must actually invoke these checks; changed scripts can omit their own checker, so forge enforcement and hosted CI behavior remain unverified.

The planned production interface is `node skills/repo-audit/scripts/repo-audit.mjs <command> [options]`.
Resource paths are relative to the installed skill, never the caller's current directory.
Command-specific options and input formats belong to their owning tasks and command help.
C4a establishes arguments, targets, paths, scratch and results.
C4c adds command dispatch and the explicitly supported schema subset.

## Project contract and change collection

```sh
node skills/repo-audit/scripts/repo-audit.mjs contract validate --repo <target> [--contract <repo-relative-file>] --json
node skills/repo-audit/scripts/repo-audit.mjs evidence collect --repo <target> --base <ref> [--contract <repo-relative-file>] --json
```

Both commands require a Git working tree and accept `--contract`, defaulting to `.bstack/project.json`.
The selected contract path resolves from the target root, independent of the caller's working directory.
The installed [project schema](../skills/repo-audit/schemas/project.schema.json) owns version 1 and rejects unknown fields and versions.
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
The `evidence validate`, `docs check` and `docs generate` argument pairs require those exact spellings and a `repo-audit.mjs` executable or argument; independent project tools may use those argument pairs.
Native npm, pnpm and yarn script aliases support `run <script>`, explicit `test`/`start`/`stop`/`restart` scripts and version flags.
For npm, script lookup uses the nearest ancestor within the repo containing `package.json` or `node_modules`, and script bodies are inspected from that directory.
For Yarn, lookup uses the nearest ancestor within the repo containing `package.json`, without stopping at `node_modules`.
Script bodies use the [selected integration grammar](../skills/repo-audit/references/enforcement.md#integrate-the-maintained-command), which owns token, quoting, whitespace and unsupported shell-transformation rules.
That grammar applies to every command in pre/main/post and nested script bodies reached from checks, generators or their version probes; direct child-command arrays retain literal arguments under the [child-command contract](#child-commands).
The validator follows script aliases and declared npm, pnpm and yarn pre/post lifecycle scripts, rejecting cycles, missing scripts and aggregate calls.
Declared pnpm hooks are inspected even when local configuration disables them, so enabling hooks cannot introduce aggregate recursion.
Unsupported package-manager invocation syntax and shell programs require a reviewed direct leaf command.
Other child executables are opaque reviewed leaves; validation does not statically analyse arbitrary program implementations for hidden aggregate calls.

Collection requires an explicit base.
In a repo with a current commit, `<ref>` resolves to a commit and `data.base` records its requested `ref`, `kind: "commit"` and exact `objectId`.
Before the first commit, use `--base empty`; the base records `kind: "empty-tree"` and the Git empty-tree object ID, with `head: null`.
A missing base always blocks, produces no assessment, and never substitutes an empty comparison.
A shallow clone missing the base reports `git fetch --unshallow origin` followed by `git fetch origin <ref>`; the helper never fetches automatically.

`data.changes` retains source (`committed`, `staged`, `unstaged` or `new`), Git status, path and an `oldPath` for detected renames.
Committed changes are the endpoint diff from the resolved base to the current HEAD; staged changes compare HEAD to the index, and unstaged changes compare the index to the working tree.
Untracked files respect Git ignore rules.
The inventory unions these differences, so staged and working-tree changes that cancel each other remain visible.
Git detects renames with 50% similarity; both original and destination paths map independently through scopes, while undetected moves remain deletions and additions.
The owning repo's Git inventory reports submodules at their gitlink path, including dirty submodules, rather than traversing another repo's files.
`data.paths` is the sorted unique union, including new and deleted paths.
Collection permits absent document, rule and acceptance-source pointers only when the live Git comparison records their deletion or rename.
Git-proven removed spellings remain collectable during case-only renames; ordinary source pointers still require exact case.
Removed source paths retain concrete lexical validation but do not require their current replacement to be a file.
Those paths remain in the inventory and affected documents remain candidates; `contract validate` still requires every source pointer to exist.
`data.mappings` records matching scope, document and rule IDs for each path.
`data.candidateDocuments` is the union of scoped documents and changed document paths themselves.
Paths with no document relationship remain in `data.unmappedPaths`, including paths in scopes that name only rules.

The command writes one `assessment.json` skeleton to [scratch](#scratch) and returns its absolute path in `data.path`.
The skeleton preserves the live inventory, mapping, document entries with `assessment: null`, unmapped impact entries with `assessment: null`, and empty decisions, coverage and execution lists.
These are pending semantic assessments, not no-impact claims or passing check evidence.
Every collection recomputes from Git and the working tree; no supplied inventory option exists.
The shared live inventory is also the input for [assessment validation](#assessment-validation), which recomputes rather than trusting the skeleton's path list.
Assessment validation and local freshness are implemented below; the standalone execution contract above owns portable clean-checkout behavior.

### Assessment validation

```sh
node skills/repo-audit/scripts/repo-audit.mjs evidence validate --repo <path> --base <ref> --assessment <file> [--contract <repo-relative-file>] --json
```

The caller-relative assessment follows `schemas/evidence.schema.json`.
Collection now includes the local real repo path and a null review fingerprint, and unions previous/proposed document candidates so removed coverage remains visible.
Comparison supports an ancestor commit, or `empty` only before the first commit.
Unavailable comparison objects block with their restoration prerequisite.
Validation recomputes all changed paths, change categories, mappings, candidate documents and unmapped paths from Git; a supplied incomplete inventory cannot establish coverage.

Each document or unmapped-path entry's `assessment` follows `schemas/impact-assessment.json`:

```json
{
  "result": "no-impact",
  "changedBehavior": "The quote function now uses an explicit statement terminator.",
  "changedPaths": ["src/price.mjs"],
  "reason": "The pricing definition still specifies quantity multiplied by 12, which the internal fix preserves.",
  "citations": [{"path": "DESIGN.md", "pointer": "quantity multiplied by 12", "version": "base"}],
  "dependentWork": []
}
```

Every relevant changed path must appear in the entry's `changedPaths`.
Document assessments cite the authoritative document itself, using literal nonempty source excerpts from `base` or `current` bytes.
An `updated` result also requires `delta: {"before": "old definition", "after": "new definition"}` excerpts that actually disappeared and appeared in that document.
Empty before/after excerpts describe additions/deletions.
Update metadata explicitly labeled `updated` or `last updated`, whitespace and HTML or C-style comments alone cannot establish an updated definition or rule.
Hash comments in YAML, Python and shell files or labeled fenced examples also cannot establish an updated definition or rule.
Dates within definitions and rules remain meaningful, including YAML `date` fields, standalone payment deadlines and effective dates.
An unrelated meaningful edit cannot justify a cosmetic asserted delta.
Normalization is conservative structural screening, not a parser for arbitrary documentation formats or proof of semantic agreement.
Comment screening preserves prose URLs and quoted literal text, including template text, while excluding comments inside template expressions.
Language context preserves YAML block scalars, Python triple-quoted strings and shell heredoc bodies, while screening comments inside shell command substitutions.
Prose apostrophes and unmatched quote delimiters do not protect comments from screening.
Delta excerpts are screened at their occurrence in the document so full excerpts can include comments alongside changed rule text.
A `decision-needed` result names `dependentWork` and remains blocked until the substantive assessment is resolved and reviewed again.

`coverage` lists affected authoritative rule IDs.
The validator reads the previous contract from the base commit and the proposed contract from the current tree.
Historical sources resolve internal file and directory links entirely within the comparison tree; escaping, cyclic and missing link targets block validation.
The prior policy defaults to `.bstack/project.json` at the comparison base, independently of the proposed `--contract` path.
Custom prior authority must be explicitly reconciled with `--previous-contract <repo-relative-file>` on both collection and validation.
The assessment records `previousContract`, and changing that selection invalidates its review binding.
Unrelated fixture contracts are not discovered by their JSON shape.
If a default prior and a different explicitly selected prior coexist, validation blocks for reconciliation instead of dropping either.
When no default or explicit prior is available, selecting an existing or renamed contract blocks for explicit prior-authority reconciliation.
A newly added contract can reach foundation validation, including in committed repositories containing sample contracts.
The selected foundation review must establish that this is a first installation; structural validation cannot infer custom prior authority from unrelated file contents.
A deleted prior requires reconciliation unless Git records a clear rename of that same file to the proposed location.
Previous scopes, document pointers, rule relationships and check declarations remain obligations even when the new contract removes them.
An absent previous contract blocks with a named prerequisite unless `foundation: {"findingId": "F-001", "record": <findings record>}` explicitly selects a foundation finding covering the new contract, target and revision.
That record uses the existing findings schema, `stage: "foundation"`, and a selected finding and ID.
An unsupported previous version or invalid previous policy blocks for a reviewed migration rather than trusting proposed coverage.

An acceptance-source replacement requires a decision naming `source` (repo-relative path), literal `oldCase`, approved `newCase` and nonempty `affectedWork`.
Decisions have unique `id` and `status: "pending" | "approved"`.
An approved replacement also supplies an `approval` citation in the same path/pointer/version format, from a source separate from the acceptance sources being checked.
The old/new case excerpts must exist in the base/current source respectively; `[absent]` explicitly denotes an initially absent or deleted source.
Pending decisions block all dependent work even with passing executable checks.
The helper verifies provenance structure and binding, not whether an owner actually approved a natural-language statement.
The project's selected review process must assess that authorization and semantic correctness against the diff.

Validation returns the current `data.fingerprint`, including on stale-review blocked results.
After reviewing the substantive claims against the live diff, the selected reviewer records that value in the assessment's top-level `fingerprint`.
The validator never writes or automatically approves the review binding.
Repeated completed assessments have stable fingerprints.
Changing code, source citations, the base, coverage, decisions or a no-impact reason invalidates the review.
The review uses the [shared fingerprint contract](#fingerprints) with changed paths, policy pointers, cited sources and check inputs, plus substantive assessment data.
Explicit directory arguments in check commands, resolved package scripts and version probes contribute their file inventory to selection and freshness, including deleted tracked inputs.
Internal directory links and command working-directory links resolve to that inventory while retaining lexical inputs.
The selected assessment supplies `evidencePath` and its substantive fields through `inputs`.

`execution` references existing local captures as `[{"runId": "<run-id>", "plan": "<caller-relative-plan.json>"}]`.
The validator reads `checks.json` from the target's scratch run and recomputes the capture's current input state through the same hashing function as `run-checks`.
An after capture must have passed with equal original, final and current fingerprints and the exact plan digest.
Each required check must have executed successfully with its exact declared command and version probe, and its plan must include the previous/proposed check input scopes and both policy locations and authoritative source paths.
Changed literal and deleted inputs must be represented in the capture; a glob that omits a deleted path needs that path declared explicitly in the capture plan.
Changed check commands require successful captures of both declarations.
Missing, failed, unavailable, skipped or stale captures cannot pass.
Attaching or replacing execution references does not alter the substantive review fingerprint.
Keep assessment execution records outside leaf-check product scopes so writing capture references cannot invalidate the leaf capture.
This validates local captures only; running a prior checker implementation and portable standalone execution remain later tasks.

## Generated facts

```sh
node skills/repo-audit/scripts/repo-audit.mjs docs generate --repo <target> --check --json
node skills/repo-audit/scripts/repo-audit.mjs docs generate --repo <target> --json
```

Both forms load the project contract, with the same optional `--contract` override as `contract validate`.
Each registered generator's unique `id` is its marker ID, `outputPaths` names its documents, and `inputScopes` names its authoritative inputs.
Every output document must already contain exactly one corresponding section between `<!-- bstack:generated <id> -->` and `<!-- bstack:end -->`.
IDs used as markers are single tokens without whitespace or angle brackets.
Duplicate, nested, malformed and unmatched markers in those documents fail before commands execute.
The child command's stdout is the exact UTF-8 body between markers, including any leading or trailing newlines; no whitespace normalization occurs.
The same output fills that generator's section in each declared document.
Nonzero exits, unavailable tools, timeouts, cancellation, invalid UTF-8 and truncated output cannot establish freshness.

`--check` compares section bytes and fails with `stale-generated-section` for each stale section.
During each generator, including its version probe, the command watches every existing project directory for changes and snapshots project file bytes, modes, directories and link targets before and after execution, including ignored files but excluding Git metadata.
Project changes fail the generator's read-only contract in either form, including files created and removed or bytes changed and restored before execution finishes; the command does not undo the generator's changes.
Write detection does not provide an operating-system sandbox or prove that the generator reads only its declared inputs.

Without `--check`, complete proposed documents render only to scratch.
The result names `generated-proposals.json` and includes each changed document's original hash, proposed hash, complete replacement payload and exact diff.
Surrounding document bytes and marker comments remain unchanged.
These proposals do not authorize writes or select findings.
Bind chosen proposals to selected findings in a reviewed change set, review `apply --plan <file> --dry-run`, then use `apply --plan <file>`.
The existing protected apply contract still enforces finding selection, scope, original hashes, complete proposed bytes and the reviewed digest.
No separate regeneration write path bypasses those protections.
Human summaries and JSON results report structural proof limits.

## Document references

```sh
node skills/repo-audit/scripts/repo-audit.mjs docs check --repo <target> [--contract <repo-relative-file>] --json
```

The command loads the project contract and verifies every registered document, rule and acceptance source path without executing checks or generators or writing files.
For UTF-8 `.md` and `.markdown` sources it checks local inline links, images and defined reference links, including collapsed and shortcut references.
Relative destinations resolve from the source document, may traverse parents inside the selected target, must use exact path case and cannot escape through symlinks.
Ordinary destinations contain no whitespace, backslashes, parentheses, brackets, angle brackets or backticks; paths can use percent encoding.
Optional titles and other destination spellings are coverage limits.
Heading fragments use lowercase ATX or setext heading slugs, with punctuation removed, whitespace changed to hyphens and repeated headings suffixed `-1`, `-2` and so on.
External URLs are not fetched.
Code fences, indented code and HTML comments do not contribute links or glossary entries.
Inline code, escaped labels, emphasis, nested links, raw HTML, explicit HTML anchors, custom heading IDs and HTML entities are coverage limits.
When such markup occurs outside excluded blocks, the source document's links and glossary are left for renderer review; registered paths are still verified.
A fragment target containing such markup also reports a coverage limit rather than a missing heading.
Fragments in non-Markdown targets are not validated.
Unsupported document encodings and formats produce `data.coverageLimits`, also visible in plain output, rather than a readiness failure or a forced rewrite.
Broken supported local references fail with `broken-local-link`.
The command checks registered sources only, not every document reachable through their links.

Register a glossary on its document record as `"glossary": { "context": "ordering", "format": "markdown-bold" }`.
Context is an explicit domain identity; document headings and filenames do not select or split contexts.
The supported formats are:

- `markdown-bold`: entries beginning at column zero with `**Term**:`, followed by a definition on that line or subsequent lines until the next entry or heading.
- `markdown-table`: two-column tables with `Term` and `Definition` headers and a Markdown separator row, with one term and definition per row.

Glossary fields use plain text; code spans, escaped pipes and other field markup are coverage limits.
Unusual table rows report coverage limits rather than invalid or empty fields.
Trailing horizontal whitespace on ordinary table lines is accepted.

Supported glossaries require at least one entry and nonempty canonical terms and definitions.
Term comparison normalizes Unicode to NFC, lowercases text and collapses whitespace.
Duplicate canonical terms fail within the same registered context, including across files.
The same word in two different contexts is valid.
Synonyms, contradictory definitions and domain relevance remain reviewer judgements.
An unrecognized glossary format reports a coverage limit while supported local links in that document are still checked.

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

## Protected project creation

```sh
node skills/repo-audit/scripts/repo-audit.mjs project create --workspace <existing-idea-directory> --plan <file> --dry-run --json
node skills/repo-audit/scripts/repo-audit.mjs project create --workspace <existing-idea-directory> --plan <file> --json
```

The owner approves intent and the exact scratch vision first, then selects the destination, stack, minimal scaffold and first journey.
The versioned [creation schema](../skills/repo-audit/schemas/project-create.json) owns the plan's fields and command objects.
`workspace` identifies the real idea directory.
The destination path is workspace-relative and its resolvedPath binds the reviewed absolute location.
`changeSet` resolves relative to the creation plan.
The referenced change set follows the existing apply schema and owns complete generated file payloads, selected findings, scope, exact-byte hashes and its digest.
Its findings use stage foundation and both targets identify the planned destination as `{ mode: "workspace", root: <resolved-destination>, revision: null }`.
Every scaffold edit uses create with originalHash null and complete UTF-8 payloads.
See the [apply operation table](#apply-dry-run) for supported file formats.
The same plan writes the approved vision, confirmed glossary when useful and selected foundation.
The creation digest uses the existing canonical JSON hash algorithm on every field except planDigest.

Commands have unique IDs across prerequisites, setup and journey, and a positive safe-integer timeoutMs.
Prerequisites run before destination writes, with cwd `.` at its existing parent, and must be selected read-only availability checks.
Git availability is always checked.
Setup and journey cwd must be the scaffold root or a declared scaffold directory.
The owner reviews commands with their potential effects along with the exact generated bytes.
Unsupported fields, payloads, links, scope, digests, unresolved decisions and unavailable prerequisites are rejected before any destination write.
The destination parent must already exist, the destination must lie inside the idea workspace, and the destination itself must be absent or explicitly selected empty.
Nonempty directories are never adopted.
Scaffold paths use canonical forward slashes and cannot contain .git components or conflict with directory paths.

Dry run builds the scaffold only in external scratch and returns its path, destination, complete diff and declared commands.
Plain output also prints the complete diff.
After approval, omit --dry-run with the unchanged plan.
The directory and Git journal is creation.json in destination-keyed scratch, with directory intentions saved before mkdir and Git intention saved before git init.
The T2.6 engine owns the file journal, atomic writes, actual-hash recovery and user-edit conflicts.
Git is initialised only at the reviewed destination and global configuration is never changed.
Repeat the unchanged creation plan to inspect actual paths and resume pending directory, file and Git work.
Unrelated paths block before setup, including during file writes, and changed reviewed bytes block every continuation.
After setup starts, generated files are permitted while reviewed scaffold files still have protected hash preconditions.

Each setup and journey command is recorded as unverified before execution and its actual captured result is saved afterward.
An interrupted or failed command is not automatically repeated, avoiding duplicate setup effects.
Prerequisites run again on every invocation, including dry runs and resume.
Missing, failed or interrupted setup or journey produces exit 2 with creation-unverified and keeps the project.
Inspect the retained record and capture fresh affected native checks explicitly before claiming readiness.
A successful record includes tool versions and captured outputs, gitComplete and verified true, and names maintained enforcement and portable maintenance as pending.
These are unperformed creation steps, not global capability status; selected maintained integration is available through [apply](#apply-dry-run) and needs its own disposable proof.
Real Windows and macOS execution remains owner checklist evidence, rather than a Linux support claim.

## Arguments and targets

Options use `--name value`, with a separate, nonempty value.
`--json` is a boolean flag.
Unknown arguments, positional arguments, repeated options, missing values and `--name=value` are usage errors.
Argument validation collects detected problems before refusing an operation.
Each command registers its own value options with `parseArgs`.

Exactly one explicit target is required.
`--repo <path>` selects an existing Git working tree and resolves its real Git top level, including when selected from a subdirectory or before its first commit.
A bare repo or non-Git directory is blocked, with a Git prerequisite and fix.
`--workspace <path>` selects an existing directory that need not contain Git for draft commands, workspace apply and protected project creation.
The two target options are mutually exclusive.
Relative target paths resolve from the caller's working directory.
Target identity is `{ mode: "repo" | "workspace", root: <absolute real path> }`.
Links to the target share that identity.
Draft commands do not initialise Git, create a repo or write foundation files.
The separately selected creation operation uses the [protected project creation contract](#protected-project-creation).

## Target-relative paths

`resolvePath(root, input)` accepts a nonempty relative path and returns its resolved absolute path inside the real target root.
Absolute paths, Windows drive paths, NUL bytes and parent traversal components using either slash are refused.
Spaces, Unicode and metacharacters remain literal path characters.
For a new path, resolution starts with its nearest existing parent.
Existing links must resolve inside the target, including parents of new files.
Dangling links are refused rather than treated as absent directories, except during [journalled-deletion recovery](#apply-dry-run).
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
A target subfolder uses SHA-256 of the absolute real target root, and `createScratch` assigns a UUID to each new draft run.
Apply uses the [digest-bound run identity](#apply-dry-run) instead.
Existing cache and run-parent links are resolved before creating directories.
A resolved scratch location inside the target is blocked before any write.
Draft review commands use explicit returned scratch paths rather than guessing the newest run.
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
Each inventoried file records its path, presence, filesystem mode, lexical link target and exact-byte content hash.
Initialized submodule fingerprints include tracked link targets and source contents so retargeting a link invalidates captured execution and review bindings.
Absent files record `present: false`, `mode: null` and `contentHash: null`.
Unreadable inputs and unsafe paths refuse the operation rather than producing a fingerprint.

Only the top-level `inputs.fingerprint` and `inputs.execution` fields are omitted as derived data.
All other fields, including nested fields with those names, remain substantive.
When `evidencePath` is supplied, its resolved file and every inventoried alias retain presence, mode and link state, but their serialized content is not hashed.
The caller must include the evidence's substantive fields in `inputs`.
This avoids a self-referential evidence hash without omitting the assessment itself.
Portable committed identity follows the standalone execution contract above; [the assessment schema](../skills/repo-audit/schemas/evidence.schema.json) owns the implemented assessment format.

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
Duplicate JSON member names at any depth, including escaped equivalents, and numbers that decode to nonfinite values also fail validation.
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
These stage requirements alone do not establish maintained enforcement, portable assessment or final release acceptance.

Validation returns the current fingerprint even when evidence is missing.
It hashes the real target root, reviewed revision, exact scoped file bytes and modes, including absence, and all substantive findings inputs except `execution`, using the T0.4 fingerprint contract.
Capture each approved outcome against that fingerprint with a unique record ID, outcome name, actual status, method, output artifact path and exact-byte SHA-256.
Artifact paths resolve from the invoking cwd and may be absolute scratch paths.
Keep artifacts outside the reviewed files so capturing them does not itself invalidate the reviewed state.
One current record per outcome prevents contradictory duplicate outcomes.
These commands read supplied observation records and artifacts without executing checks.
They do not prove that a supplied observation is truthful or that the chosen outcomes exhaust the user's requirements.
Automatic command capture is available through `run-checks` below.

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
Write the reviewed report into the project's audit record through an `apply` create or whole-file replacement plan.

## Apply dry run

```sh
node skills/repo-audit/scripts/repo-audit.mjs apply --repo <path> --plan <file> --dry-run [--json]
node skills/repo-audit/scripts/repo-audit.mjs apply --workspace <path> --plan <file> --dry-run [--json]
node skills/repo-audit/scripts/repo-audit.mjs apply --repo <path>|--workspace <path> --plan <file> [--json]
node skills/repo-audit/scripts/repo-audit.mjs state show --repo <path>|--workspace <path> --run <id> [--json]
```

`--plan` is required, while `--dry-run` selects validation and preview only.
Dry run writes no target, scratch, dependency or journal files.
Omitting `--dry-run` applies or resumes the reviewed plan with backups and a durable journal.
The plan digest selects the run automatically.

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
For a fresh plan or dry run, current file bytes must match `originalHash`; a create must start absent and a delete must start present.
Resume validates the saved originals against `originalHash` and derives current file states as described below.
Complete bytes for every file are staged in memory before reporting success.
The installed [enforcement reference](../skills/repo-audit/references/enforcement.md#integrate-the-maintained-command) owns selected `checkIntegration` paths, their bounded command grammar, supported CI format and disposable-proof requirements.
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
Replacement labels contain no brackets, backslashes, backticks or emphasis markers; destinations follow the ordinary contract above and cannot include titles or trailing text.
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
An absent audit record uses `create`, while an existing audit record uses `replace-file` with the exact T2.5 rendered bytes.

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

The [resume-state schema](../skills/repo-audit/schemas/resume-state.schema.json) owns the durable journal.
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

`state show` requires the explicit target and `--run`, reads the journal and inspects current targets without writes.
Apply and state results include `runId`, `planDigest`, per-edit `state` and `actualHash` when readable, path lists `applied`, `pending` and `conflicting`, and `affectedChecks`.
Apply also returns the scratch journal path, an `outcome` on success and filesystem limitations.
Affected checks are the reviewed findings' required outcomes, which must rerun after writes.
These commands report affected checks for execution through `run-checks`.

## Check plans and capture

`run-checks --repo <path> --plan <file> [--phase before|after] [--prior-run <id>] [--json]` executes a plan from `schemas/check-plan.json`.
The phase defaults to `after`.
The plan file is caller-relative and can live outside the target.
Results are captured directly into a new scratch run, never imported from agent-written execution claims.

The plan names a `changeKind`: `feature`, `bug-fix`, `refactor` or `document-config`.
`acceptanceSources` name unique IDs, repo-relative source paths and exact-byte SHA-256 `contentHash` values.
Each acceptance case joins a source ID, gives a literal nonempty `pointer` found in that source, states the approved observable `outcome`, and declares whether it is a `userJourney`.
These pointers identify the agreed source rather than deriving expectations from the tested implementation.
The helper validates source existence, content freshness and pointer presence without claiming that it can assess the meaning of a requirement.
Acceptance changes require owner review and a new plan.

Each check has a unique ID, a child-command object, a `required` flag, acceptance case IDs, `inputScopes` and a `role`.
Roles are `outcome`, `reproduction`, `protection` and `compatibility`.
Scopes use the overlap command's glob syntax and discovery exclusions.
Literal paths also record absence, while glob scopes include newly added files on subsequent fingerprints.
Include the command's scripts, configuration, dependency locks and relevant product inputs in these scopes.
The plan and acceptance sources are always fingerprinted too.
The author owns the scope's completeness.
An optional `skipReason` records why execution cannot run, leaving the check and any affected user flow unverified.
All references, command objects, paths and scopes are validated before any check runs.
The scratch destination is created and validated before any version probe or check, and reused for the final artifact.

Before runs execute reproduction and protection checks.
After runs execute outcome, protection and compatibility checks, plus reproduction checks to confirm the bug now succeeds.
Each phase requires at least one active required check; otherwise preflight rejects the plan before any command executes.
A bug fix requires a scratch `before` run with a failed required reproduction that executed normally with a passing version probe, plus the same required reproduction passing after the change.
A refactor requires all required protective checks passing in a `before` run, plus at least one required compatibility check after the change.
Missing evidence blocks before execution.
Prior runs must belong to the same target and exact plan, precede the current run, and name a different original input state.
The recorded `originalState` is one fingerprint of the Git revision, check-plan bytes and presence, acceptance sources and the union of every declared product scope, including exact input hashes, presence and modes.
The same inputs are fingerprinted once after the run as `finalState`.
If that final snapshot cannot be read or validated, `finalState` is `null`; completed command evidence is still saved, and the capture is blocked with `inputs changed during run`.
Prior evidence requires a passing before capture with matching original and final fingerprints.
Execution order links prior capture to the after run.
Local scratch evidence is an execution record, not an authenticated portable attestation.

Every executed check records its command, version probe, exit code, output tails, timing and order within the capture.
Timeout, cancellation, unavailable tools and skipped checks cannot pass.
If the before and after fingerprints differ, the entire capture is `blocked` with `inputs changed during run`, every executed check becomes blocked, and its acceptance coverage is unverified.
This applies to optional and inactive checks' declared inputs as well as required checks in either phase.
There is no intermediate input tracking; changes restored before the final fingerprint are not detected.
Required checks must pass for a phase to pass, apart from the expected failing reproduction in a successful before bug-fix run.
That expected failure satisfies the reproduction prerequisite but still reports its acceptance outcome as failed, without claiming a verified user journey.
After captures also require passing coverage for every declared user journey: failed journeys fail the capture, and unverified journeys block it.
Per-case coverage lists executed evidence, failed outcomes and unverified flows.
A result covering no user journey explicitly says so, even when all required checks pass.
Human summaries include the run, readiness and coverage limits.
Outside dependencies require separate live probe evidence as described below.

## Live probe pairs

`probe record --repo <path> --name <n> --phase before|after --spec <file> [--approved-by-user] [--json] -- <executable> [args...]` captures one live call in scratch `probe.json`.
The command after `--` is a literal argument array, with no shell interpolation.
All helper options precede that delimiter.
The [descriptor schema](../skills/repo-audit/schemas/probe-spec.json) defines this input:

```json
{
  "schemaVersion": 1,
  "endpoint": "https://service.example.invalid/price",
  "environment": ["SERVICE_REGION"],
  "sideEffects": false,
  "assumption": "The checkout total is 10.",
  "inputScopes": ["src/**", "scripts/probe.mjs"],
  "cwd": ".",
  "versionArgs": ["--version"],
  "timeoutMs": 120000
}
```

Declare every environment key relevant to the call, including credentials or runtime selectors when they affect behaviour.
The capture records each declared key's actual value, with null for absence, while the child inherits the host environment.
The endpoint is declared identity, not an injected argument or proof of where the command connects.
The caller must select a command that probes that endpoint and asserts the agreed outcome.
A successful process alone does not prove an arbitrary printed result matches an assumption.
Nonzero outcome assertions fail the probe, including disagreement with a mock.
The helper captures tool version, exit code, output tails and timing through the shared child-command runner.

The [record schema](../skills/repo-audit/schemas/probe-record.json) defines persisted fields.
Nested descriptors and command objects are validated against the descriptor and check-plan command schemas.
Records bind the target, name, literal command, endpoint, relevant environment, side-effect marker and assumption with a canonical SHA-256 call digest.
Side-effecting probes refuse before version or command execution without `--approved-by-user`.
Approval records the digest and unique run ID for that call, so a before approval cannot authorise an after call.
The flag asserts that the user approved this specific invocation.
The helper does not obtain approval itself.
Local scratch may contain sensitive environment values and command output, and is not a portable committed artifact.

Declared input scopes use the check-plan glob semantics.
Fingerprints record target identity, HEAD, declared file bytes and modes, descriptor bytes and call digest once before and once after execution.
Any difference blocks the capture with `inputs changed during run`.
Transient changes restored before the final fingerprint remain undetected.
Unavailable executables or versions, cancellation and timeout retain the reason and assumption with probe status `unverified` and envelope status `blocked` (exit 2).
Failed outcome assertions return `failed` (exit 1).
The scratch destination is validated before any command runs, and final snapshot failures retain execution evidence as blocked.

`probe compare --repo <path> --name <n> --before <run-id> --after <run-id> [--json]` verifies an outside dependency's pair.
Missing or unreadable captures fail, as do wrong names, targets or phases, reused runs, reversed execution order, unsuccessful probes, unmatched commands/endpoints/environments/descriptors or approval from a different call.
The after capture must still match current HEAD, descriptor bytes, declared input state and relevant environment.
The before and after product fingerprints may differ because the change occurs between probes.
No comparison invokes a command or writes the target.
Successful comparison returns `verified: true`, status `passed` and exit 0.
Every incomplete pair returns `verified: false`, status `failed` and exit 1 with named reasons.
Completion for a change depending on outside behaviour requires both check evidence and a successful comparison for every such dependency.
Automatic collection of those separate records belongs to the later evidence tasks.

## Rule-proof and temporary debt

`rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text> [--json]` reads the existing `schemas/check-plan.json` format and selects one check's child command.
The valid and violation directories must be distinct, prepared fixtures with native dependencies already installed.
Use the clean rule-proof variant as the source of both, with one independently seeded violation per invocation.
The command copies each fixture into a separate scratch directory, runs the command there, captures the native version, stdout, stderr and exit, then removes the disposable copies.
It never runs the child against the source fixtures or target repo.
Valid must exit zero; violation must exit nonzero and include the exact expected text in stdout or stderr.
A skipped or absent check cannot prove enforcement.
Unavailable tools, failed version probes, failed clean setup, cancellation, timeouts and missing working directories are blocked.
The saved `proof.json` reports cases, native commands, diagnostics, status and source locations; failed proof returns exit 1, blocked proof exit 2.
Proof establishes only the supplied static cases; it does not infer coverage of unresolved imports, dynamic dependencies or unsupported syntax.
See [fixture construction](fixtures.md) for the native stacks and independently seeded proof cases, and the [T3.3 progress record](implementation-plan.md#progress) for the baseline research outcome.

`baseline check --repo <target> --baseline <repo-relative-file> --violations <file> [--json]` compares complete current normalized native diagnostics with `schemas/baseline.schema.json`.
Native adapters must preserve stable rule/path/key identities, and must not present setup failure or unavailable analysis as an empty violation list.
This command compares supplied data; it does not execute the native analysis.
The [baseline schema](../skills/repo-audit/schemas/baseline.schema.json) owns the fields; each entry records a narrow reason and removal condition.
The baseline file must already exist; start with `{"schemaVersion":1,"entries":[]}` when no debt has been accepted.

The violation file is an array such as `[{"rule":"private-import","path":"src/app.py","key":"ledger._internal"}]`.
Duplicate identities, unknown fields, blank reasons and removal conditions, directory scopes and unsafe paths are rejected.
Missing source files are allowed because fixed debt may refer to a deleted file.
Existing debt remains visible in both plain and JSON output.
An unrecorded violation fails with `new-debt`; a fixed entry fails with `stale-debt` until removed.
`--refresh` removes fixed entries and keeps matching entries; any new debt prevents all writes.
Adding exactly one entry requires `--refresh --finding <id> --findings <file> --entry <file>`.
The entry file holds one complete baseline entry matching a current unrecorded violation.
Findings follow `schemas/findings.schema.json`, refer to the selected target and list that ID as a selected unresolved debt finding whose concrete scope includes the entry path.
The command rejects missing, unselected, resolved, out-of-scope or non-debt findings.
If other new debt remains, the refresh writes nothing even when the one entry is authorized.
Apply the selected native tool's own baseline or suppression mechanism instead when research finds one, retaining the same no-growth and removal requirements.
