# formal-charge-once

Kind: Git repo.
A worker charges an order once by claiming it with the atomic `compareAndSet` of `src/charge.mjs`.
`formal/ChargeOnce.tla` models two workers, each action naming the code line it models, and checks `NoDoubleCharge == charges <= 1`.
`check-plan.json` is an ordinary check plan with one `protection` check, `tlc-charge-once`, run from `formal` with a 120000 ms timeout.
`formal-charge-once-violation` splits the claim into a `get` then a `set` and updates the model to match, so TLC finds a double charge.

Serves the `/formal-verification` acceptance cases as the clean-versus-broken input of `rule-proof`.
Neither fixture installs a tool.
Put the pinned TLC jar at `tools/tla2tools.jar` in each built folder, which `.gitignore` keeps out of the repo, and use a Java runtime of version 11 or later.

- Jar: `tla2tools.jar` from the tlaplus `v1.8.0` release asset, sha256 `15d103b7e5617780bcc904c0af12f1ad242e2b345c0301136c5be4588f17edac`, reporting "Version 2026.10.15.145915 (rev: 932d35e)".
  That release is a prerelease republished on 2026-10-15, so the tag alone does not pin a version; check the hash.
- Expected with the unchanged `rule-proof` command (`--check-id tlc-charge-once --expect 'Invariant NoDoubleCharge is violated'`): the clean fixture exits 0 with 12 distinct states, the violation fixture exits 12, and the proof passes.
- TLC exits 75 for a modelling error such as a branch that leaves `charges` unassigned, which is a different signal from the 12 of a property violation.
- On a violation TLC writes a `ChargeOnce_TTrace_*.tla` trace spec beside the model, which `.gitignore` keeps out of the repo.
- `rule-proof` records the version of `java`, so nothing in its proof identifies TLC; the suite must check the jar hash itself.

`node sanity.mjs <built-folder>` needs Node 24 or later only; it checks the files and the plan's hash and never runs TLC.
