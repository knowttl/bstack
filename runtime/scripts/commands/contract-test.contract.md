## C4c public test command

`node skills/repo-audit/scripts/repo-audit.mjs contract-test --workspace <directory> --input tests/inputs/schema-valid.json --json` exercises dispatch, schema validation and joining IDs through the installed entry point.
It also accepts `--repo` and leaves the target unchanged.
The [input schema source](../runtime/schemas/contract-test.json) owns the required fields, allowed values and unknown-field constraints.
The command also checks the `records` collection with `validateIds`, as described above.
`--schema <file>` selects an explicit definition for schema-subset tests.
Input and schema file paths resolve from the caller's working directory, while the default schema resolves from the installed command module.
Unreadable or malformed JSON reports `invalid-input`.
This read-only test interface implements no audit, apply or evidence workflow.
