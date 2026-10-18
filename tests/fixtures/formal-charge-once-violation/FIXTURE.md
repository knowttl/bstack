# formal-charge-once-violation

Kind: Git repo.
Inherits `formal-charge-once` and overlays two files: `src/charge.mjs` checks the order with `get` and claims it with a separate `set` (lines 2 and 3), and `formal/ChargeOnce.tla` models that split, as a generated suite would after the code change.
Two workers can both read `pending`, so `NoDoubleCharge` fails with `charges = 2`.
The pinned tool, the check plan and the expected results are the ones in the [clean fixture](../formal-charge-once/FIXTURE.md).
Run `node tests/fixtures/formal-charge-once-violation/sanity.mjs <built-folder>`.
