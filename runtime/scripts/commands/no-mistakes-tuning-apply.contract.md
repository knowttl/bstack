## No-mistakes tuning apply

```sh
node skills/no-mistakes-tuning/scripts/no-mistakes-tuning.mjs apply --repo <path>|--workspace <path> --plan <file> [--dry-run] [--approved-fingerprint <planDigest>] [--json]
node skills/no-mistakes-tuning/scripts/no-mistakes-tuning.mjs state show --repo <path>|--workspace <path> --run <id> [--json]
```

This is the `apply` command of the [no-mistakes tuning skill](../../../skills/no-mistakes-tuning/SKILL.md), the only write that skill performs.
Its `state show` is the [apply state inspection](apply.contract.md#apply-dry-run) unchanged.

Before it runs [apply](apply.contract.md#apply-dry-run), it checks each plan edit whose `path` is `.no-mistakes.yaml`.
An edit passes when its `proposedContent` lists `.no-mistakes.yaml` in a top-level `ignore_patterns` key.
An edit with no `proposedContent` is checked as empty and fails.
The check is textual: the key must start at column 0, its items are the indented or blank lines that follow it, and `#` comments are removed before matching.
A name counts when it is a whole bare or quoted list item, or a member of a flow list on the key's line.
So `upstream/.no-mistakes.yaml`, and a name that appears only in a comment, do not count.
A plan that cannot be read, or that has no `edits` array, is not checked here; apply reports it.

A failing edit makes the command return `failed` with the problem `gate-config-not-ignored` at path `.no-mistakes.yaml`, exits 1 and writes nothing, dry run included, because apply is not reached.
When every such edit passes, or the plan has none, the command behaves exactly as apply does for the same arguments, including its `--approved-fingerprint` requirement for assessment writes.
