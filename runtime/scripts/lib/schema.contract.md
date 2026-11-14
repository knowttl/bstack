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
