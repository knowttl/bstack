`node .agents/skills/verify-<app>/scripts/map-coverage.mjs --base <ref>` is the feature-map coverage gate that a kit rendered with `coverageGate` carries.
It is not a bstack command: it is one comment-free file that needs only Node and Git, runs from the target's worktree and does not need bstack installed.
It takes the merge base of `<ref>` and `HEAD`, unions the committed, staged, unstaged and untracked path inventories, and drops files inside the kit directory from source-impact matching.
Changes in one inventory remain counted even when reversed in another, including feature-file updates used to satisfy coverage.
For each `features/*.md` file other than `README.md`, it reads the `Source paths:` line and requires, when a changed file matches one of those paths, that the feature file changed too or that a commit message since the merge base has a line `No-map-impact: <feature-id>: <reason>` with a non-empty reason.
Exit 0 prints `feature-map-coverage: ok (<n> features checked)`.
Exit 1 prints one `<feature file>:<line of its Source paths>: feature-map-coverage: <first changed path> [and <n> more] changed without updating this feature file. Use an update to this feature file or a "No-map-impact: <feature-id>: <reason>" line in a commit message.` line per uncovered feature on stdout.
Exit 2 prints a `feature-map-coverage:` diagnostic on stderr for invalid arguments, an unusable base or kit, an empty feature inventory, invalid source paths or a feature file without exactly one complete `Source paths:` line listing comma-separated backticked paths.
The gate uses the source-path grammar above.
A path matches when it equals a declared path, lies under it or matches its `*`, `?` or `**` glob; matching uses Unicode code points, so `?` matches one non-slash code point.

The same file is the gate of a formal verification suite: when the suite folder (the parent of `scripts/`) holds a `properties/` directory it reads `properties/*.md` instead of `features/*.md`, and its rule, trailer and messages change as the next section describes.
