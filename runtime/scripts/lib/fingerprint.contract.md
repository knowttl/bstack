## Fingerprints

`hashBytes(bytes)` returns a lowercase SHA-256 digest of exact bytes, preserving line endings.
Callers represent an absent original or proposed file with `null`, never the hash of empty bytes.
`canonicalJSON(value)` serializes JSON values with sorted object keys and preserved array order.

`fingerprint(target, { baseCommit, paths, inputs, evidencePath })` returns `{ fingerprint, state }`.
The caller supplies the resolved base commit and JSON assessment inputs.
For local records, the state includes the real target root, base commit, sorted unique paths and substantive inputs.
Local inventoried files record their path, presence, filesystem mode, lexical link target and exact-byte content hash.
Initialized submodule fingerprints include tracked link targets and source contents so retargeting a link invalidates captured execution and review bindings.
Absent files record `present: false`, `mode: null` and `contentHash: null`.
Unreadable inputs and unsafe paths refuse the operation rather than producing a fingerprint.

Only the top-level `inputs.fingerprint` and `inputs.execution` fields are omitted as derived data.
All other fields, including nested fields with those names, remain substantive.
When `evidencePath` is supplied, its resolved file and every inventoried alias retain presence, mode and link state, but their serialized content is not hashed.
The caller must include the evidence's substantive fields in `inputs`.
This avoids a self-referential evidence hash without omitting the assessment itself.
Portable committed identity follows the standalone execution contract above; [the assessment schema source](../runtime/schemas/evidence.schema.json) owns the implemented assessment format.
