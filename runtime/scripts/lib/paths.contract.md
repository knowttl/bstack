## Target-relative paths

`resolvePath(root, input)` accepts a nonempty relative path and returns its resolved absolute path inside the real target root.
Absolute paths, Windows drive paths, NUL bytes and parent traversal components using either slash are refused.
Spaces, Unicode and metacharacters remain literal path characters.
For a new path, resolution starts with its nearest existing parent.
Existing links must resolve inside the target, including parents of new files.
Dangling links are refused rather than treated as absent directories, except during [journalled-deletion recovery](../commands/apply.contract.md#apply-dry-run).
Internal links are allowed and return their real destination.
No validation operation creates target files or directories.
Callers validate all inputs and paths before any write, and report every detected problem.
This is path preflight, not the reviewed atomic-write and concurrent-change protection built in T2.6.
Callers must recheck paths and reviewed bytes at that later write boundary.
