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
The separately selected creation operation uses the [protected project creation contract](../commands/project.contract.md#protected-project-creation).
