## Command dispatch

`runtime/scripts/commands.mjs` registers every command's metadata, and `runtime/skills.json` lists the commands, schemas, assets and shared references each skill ships.
Only the `vision` skill carries the board commands, so it is the only skill with a pinned runtime.
The generator bundles a skill's commands and their metadata into that skill's one entry file, `skills/<skill>/scripts/<skill>.mjs`, which validates arguments before it runs the selected command.
`<command> --help` prints that command's options without resolving a target.
No arguments print the skill's available commands with exit 3, and global `--help` succeeds.
Unknown commands, and commands a skill does not ship, are usage errors.
Command implementations return data and inputs, while the entry point owns result emission and error exit codes.
