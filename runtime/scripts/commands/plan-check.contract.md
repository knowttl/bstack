## Plan check

`node skills/plan/scripts/plan.mjs plan check --repo <path>|--workspace <path> --plan <file> [--json]` checks a scratch plan record without target writes.
The [plan schema source](../runtime/schemas/plan.json) owns the record's versioned fields and constraints; installed skills carry a generated copy at `schemas/plan.json`.
Each design citation is a file citation of the [research citation check](#research-citation-check) and is resolved by the same code, so a missing or unreadable path, a line past the end, a wrong digest length, changed bytes and an unavailable revision fail with the same citation codes.
Each evidence entry names a `check` or a `kit-feature` and may carry the `nonFunctionalTarget` it measures.
Each unit records whether it is `userFacing`.

Unknown fields, malformed JSON, a unit with no design citation or Done when, and duplicate unit IDs fail with exit 1 and named problems.
A unit with an empty evidence list fails with `unit-no-evidence`.
A `userFacing` unit with non-empty evidence but no `kit-feature` entry fails with `unit-no-kit-feature` when `.agents/skills` of the target holds a `verify-<app>` directory.
This kit-feature requirement does not apply when the project has no verification kit; the other checks still apply.
A dependency on an ID that is not a unit fails with `unknown-dependency`, and a dependency cycle, including a unit that depends on itself, fails with `dependency-cycle` naming the units in the cycle.
Missing `--plan` is a usage error, exit 3.
Successful JSON output records `units`, `citationsChecked` and `order`, which lists the units with every unit after the units it depends on.
The command verifies that a unit names evidence and that its citations resolve; it does not verify that the named check or kit feature exists or passes, that a citation supports its unit, or that every non-functional target is carried by a unit.
