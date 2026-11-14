`state show` requires the explicit target and `--run`, reads the journal and inspects current targets without writes.
Apply and state results include `runId`, `planDigest`, per-edit `state` and `actualHash` when readable, path lists `applied`, `pending` and `conflicting`, and `affectedChecks`.
Apply also returns the scratch journal path, an `outcome` on success and filesystem limitations.
Affected checks are the reviewed findings' required outcomes, which must rerun after writes.
These commands report affected checks for execution through `run-checks`.
