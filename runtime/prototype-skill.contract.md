## Prototype skill commands

`node skills/prototype/scripts/prototype.mjs <command> --repo <path> [--json]` is the installed entry point of the prototype skill, which ships only `kit check` and `kit prove`.
Both run from the [shared runtime](../runtime/) with the contracts in the [verification skill commands](#verification-skill-commands), and the skill adds no command of its own.
`--help` lists the commands, and `<command> --help` prints that command's syntax.

The skill runs `kit check` on the target, which reads and never writes, and runs `kit prove` only on scratch clones of the target, because the proof writes its evidence into the repo it runs in.
A clone holds the committed state of the target, so uncommitted target changes and untracked files are absent from it.
`kit prove` replaces `{port}`, `{runDir}` and `{evidenceDir}` as it does for the verification skill, so two clones run side by side on different ports when the kit's isolation allows it.
A variant's measurements are the proof record's step output and the failure code of a failed proof, read from `data.evidenceDirectory` inside the clone.
