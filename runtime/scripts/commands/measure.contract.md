## Measure and overlap

```sh
node skills/architecture/scripts/architecture.mjs measure --repo <path> --range <base>..<head> [--exclusions <file>] --json
node skills/architecture/scripts/architecture.mjs overlap --repo <path> --plans <file> <file> --json
```

Both commands ship in the [architecture skill](../../../skills/architecture/SKILL.md), which also runs `rule-proof`, `baseline check`, `findings validate`, `apply`, `state show` and `cite-check` from the shared runtime with those same contracts.
`measure`, `overlap`, `rule-proof` and `baseline check` accept only `--repo`; `--workspace` is a usage error for them.
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
A commit that changes more than 100 measured paths adds no pairs, because pairs grow with the square of the path count and a commit that broad is mechanical rather than a coupling signal.
It still counts toward each file's `changeCount`, and `data.limitations` names every such commit with its path count.
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
These patterns derive from the shared discovery policy in `lib/discovery.ts`.
Declare other generated files and broad formatting commits with the [exclusions schema](../../../skills/architecture/schemas/measure-exclusions.json):

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
