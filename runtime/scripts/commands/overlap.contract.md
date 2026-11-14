### Declared overlap plans and glob semantics

Each file follows the [overlap plan schema](../skills/architecture/schemas/overlap-plan.json):

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
