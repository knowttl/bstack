### Assessment validation

```sh
node skills/maintenance/scripts/maintenance.mjs evidence validate --repo <path> --base <ref> --assessment <file> [--contract <repo-relative-file>] --json
```

The caller-relative assessment follows `schemas/evidence.schema.json`.
Collection now includes the local real repo path and a null review fingerprint, and unions previous/proposed document candidates so removed coverage remains visible.
Comparison supports an ancestor commit, or `empty` only before the first commit.
Unavailable comparison objects block with their restoration prerequisite.
Validation recomputes all changed paths, change categories, mappings, candidate documents and unmapped paths from Git; a supplied incomplete inventory cannot establish coverage.

Each document or unmapped-path entry's `assessment` follows `schemas/impact-assessment.json`:

```json
{
  "result": "no-impact",
  "changedBehavior": "The quote function now uses an explicit statement terminator.",
  "changedPaths": ["src/price.mjs"],
  "reason": "The pricing definition still specifies quantity multiplied by 12, which the internal fix preserves.",
  "citations": [{"path": "DESIGN.md", "pointer": "quantity multiplied by 12", "version": "base"}],
  "dependentWork": []
}
```

Every relevant changed path must appear in the entry's `changedPaths`.
Document assessments cite the authoritative document itself, using literal nonempty source excerpts from `base` or `current` bytes.
An `updated` result also requires `delta: {"before": "old definition", "after": "new definition"}` excerpts that actually disappeared and appeared in that document.
Empty before/after excerpts describe additions/deletions.
Update metadata explicitly labeled `updated` or `last updated`, whitespace and HTML or C-style comments alone cannot establish an updated definition or rule.
Hash comments in YAML, Python and shell files or labeled fenced examples also cannot establish an updated definition or rule.
Dates within definitions and rules remain meaningful, including YAML `date` fields, standalone payment deadlines and effective dates.
An unrelated meaningful edit cannot justify a cosmetic asserted delta.
Normalization is conservative structural screening, not a parser for arbitrary documentation formats or proof of semantic agreement.
Comment screening preserves prose URLs and quoted literal text, including template text, while excluding comments inside template expressions.
Language context preserves YAML block scalars, Python triple-quoted strings and shell heredoc bodies, while screening comments inside shell command substitutions.
Prose apostrophes and unmatched quote delimiters do not protect comments from screening.
Delta excerpts are screened at their occurrence in the document so full excerpts can include comments alongside changed rule text.
A `decision-needed` result names `dependentWork` and remains blocked until the substantive assessment is resolved and reviewed again.

`coverage` lists affected authoritative rule IDs.
The validator reads the previous contract from the base commit and the proposed contract from the current tree.
Historical sources resolve internal file and directory links entirely within the comparison tree; escaping, cyclic and missing link targets block validation.
The prior policy defaults to `.bstack/project.json` at the comparison base, independently of the proposed `--contract` path.
Custom prior authority must be explicitly reconciled with `--previous-contract <repo-relative-file>` on both collection and validation.
The assessment records `previousContract`, and changing that selection invalidates its review binding.
Unrelated fixture contracts are not discovered by their JSON shape.
If a default prior and a different explicitly selected prior coexist, validation blocks for reconciliation instead of dropping either.
When no default or explicit prior is available, selecting an existing or renamed contract blocks for explicit prior-authority reconciliation.
A newly added contract can reach foundation validation, including in committed repositories containing sample contracts.
The selected foundation review must establish that this is a first installation; structural validation cannot infer custom prior authority from unrelated file contents.
A deleted prior requires reconciliation unless Git records a clear rename of that same file to the proposed location.
Previous scopes, document pointers, rule relationships and check declarations remain obligations even when the new contract removes them.
An absent previous contract blocks with a named prerequisite unless `foundation: {"findingId": "F-001", "record": <findings record>}` explicitly selects a foundation finding covering the new contract, target and revision.
That record uses the existing findings schema, `stage: "foundation"`, and a selected finding and ID.
An unsupported previous version or invalid previous policy blocks for a reviewed migration rather than trusting proposed coverage.

An acceptance-source replacement requires a decision naming `source` (repo-relative path), literal `oldCase`, approved `newCase` and nonempty `affectedWork`.
Decisions have unique `id` and `status: "pending" | "approved"`.
An approved replacement also supplies an `approval` citation in the same path/pointer/version format, from a source separate from the acceptance sources being checked.
The old/new case excerpts must exist in the base/current source respectively; `[absent]` explicitly denotes an initially absent or deleted source.
Pending decisions block all dependent work even with passing executable checks.
The helper verifies provenance structure and binding, not whether an owner actually approved a natural-language statement.
The project's selected review process must assess that authorization and semantic correctness against the diff.

Validation returns the current `data.fingerprint`, including on stale-review blocked results.
After reviewing the substantive claims against the live diff, the selected reviewer records that value in the assessment's top-level `fingerprint`.
The validator never writes or automatically approves the review binding.
Repeated completed assessments have stable fingerprints.
Changing code, source citations, the base, coverage, decisions or a no-impact reason invalidates the review.
The review uses the [shared fingerprint contract](../lib/fingerprint.contract.md#fingerprints) with changed paths, policy pointers, cited sources and check inputs, plus substantive assessment data.
Explicit directory arguments in check commands, resolved package scripts and version probes contribute their file inventory to selection and freshness, including deleted tracked inputs.
Internal directory links and command working-directory links resolve to that inventory while retaining lexical inputs.
The selected assessment supplies `evidencePath` and its substantive fields through `inputs`.

`execution` references existing local captures as `[{"runId": "<run-id>", "plan": "<caller-relative-plan.json>"}]`.
The validator reads `checks.json` from the target's scratch run and recomputes the capture's current input state through the same hashing function as `run-checks`.
An after capture must have passed with equal original, final and current fingerprints and the exact plan digest.
Each required check must have executed successfully with its exact declared command and version probe, and its plan must include the previous/proposed check input scopes and both policy locations and authoritative source paths.
Changed literal and deleted inputs must be represented in the capture; a glob that omits a deleted path needs that path declared explicitly in the capture plan.
Changed check commands require successful captures of both declarations.
Missing, failed, unavailable, skipped or stale captures cannot pass.
Attaching or replacing execution references does not alter the substantive review fingerprint.
Keep assessment execution records outside leaf-check product scopes so writing capture references cannot invalidate the leaf capture.
This validates local captures only; prior-checker execution and portable results follow the [standalone execution contract](../../../scripts/checker-entry.contract.md#standalone-checker-execution).
