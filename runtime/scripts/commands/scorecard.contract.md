## Constraint ledger and lock-down scorecard

A repo's constraint ledger is the data file `.bstack/constraints.json`, following the [constraint ledger schema](../../schemas/constraints.schema.json).
It is the memory of the learning loop: one entry per mistake class, so a class seen once is counted the next time it occurs and each adopted constraint keeps its rung, check and proof.
It is data, not an instruction file: no host loads it into an agent's context, no skill reads it whole, and commands report only what they derive from it.

```json
{
  "schemaVersion": 1,
  "entries": [
    {
      "class": "app imports ledger internals",
      "occurrences": ["commit 1a2b3c4 src/app.py:3", "run 01J finding f3"],
      "constraint": {
        "principle": "hard-boundaries",
        "rung": "detect",
        "retireWhen": "The internals move out of the package.",
        "check": { "id": "lint", "ruleId": "private-import", "proofDate": "2026-11-01", "baseline": "debt/boundaries.json" }
      }
    },
    { "class": "handler builds raw SQL", "occurrences": ["commit 5d6e7f8 src/orders.py:41"] }
  ]
}
```

| Field | Meaning |
|---|---|
| `class` | The mistake class, unique in the ledger |
| `occurrences` | Its cited occurrences, each a commit, file location, review comment, run finding or session |
| `constraint.principle` | `conventional-structure`, `hard-boundaries`, `illegal-states`, `footgun-bans` or `early-rejection` |
| `constraint.rung` | `eliminate`, `detect`, `encode` or `review`, the rungs of the constraint ladder from highest to lowest |
| `constraint.retireWhen` | The condition under which the constraint can be retired |
| `constraint.check.id` | The ID of the check in the project contract's `checks` that enforces the constraint |
| `constraint.check.ruleId` | The stable `rule-id:` prefix of the check's diagnostic |
| `constraint.check.proofDate` | The date, as `YYYY-MM-DD`, of the passing `rule-proof` |
| `constraint.check.baseline` | Optional repo-relative path of the constraint's debt baseline, following the [baseline schema](../../schemas/baseline.schema.json) |

An entry without `constraint` is a class below the two-occurrence threshold, kept with its single occurrence.
A constraint that comes from an approved requirement or the slop baseline may record no occurrences.
A native tool's own baseline format is not recorded as `baseline`.

`bstack-check.mjs --docs-only` validates the ledger when the file exists and does nothing when it is absent.
Each problem names the class in its message:

| Problem code | Failure |
|---|---|
| a schema code such as `missing-field` | The file does not follow the schema; a check without a proof date fails here |
| `duplicate-constraint-class` | Two entries record the same class |
| `constraint-threshold-reached` | An entry has two or more occurrences and no constraint, so the class now needs a rung |
| `constraint-unproven` | A constraint on the `eliminate` or `detect` rung records no check |
| `constraint-check-missing` | The check ID is not registered in the selected project contract |
| `constraint-baseline-missing` | The named baseline file does not exist |
| `constraint-baseline-grew` | The baseline holds an entry for the constraint's rule that the baseline at `origin/main` did not |
| `prior-unavailable-fetch-the-ref` | An entry names a baseline and `origin/main` cannot be read |

A baseline is compared only when the ledger at `origin/main` already records the same class with a baseline, so the first baseline of a new constraint is accepted at any size.
The comparison covers the baseline entries whose `rule` equals the constraint's `ruleId`, by rule, path and key.
An `encode` or `review` constraint needs no check, because nothing fails when it is skipped; it is recorded so that a recurrence moves the class up a rung.
An unreadable ledger is blocked with `constraints-unavailable`.

```sh
node skills/repo-audit/scripts/repo-audit.mjs scorecard --repo <target> [--contract <repo-relative-file>] [--json]
```

`scorecard` reads the ledger and the checks registered in the project contract, `.bstack/project.json` by default, and writes nothing.
`data.principles` holds one row for each of the five principles, in the order above, with `principle`, `title`, `rung` and `proven`.
`rung` is the highest rung among the principle's recorded constraints, or null when it has none.
`proven` is true when a constraint on that rung names a check the contract registers.
`data.ledger` is the ledger path, or null when the repo has none, which is a pass with every rung null and a limitation.
A ledger without a project contract reports every rung unproven with a limitation.
Plain output prints one line per principle with its rung and `proven` or `not proven`, or `none`.
The command returns the summary only, never the entries, and does not run the validation above.
