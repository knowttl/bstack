# Third-party lens

Use this reference only when the product integrates with an outside service or API that needs authentication or secrets, or that can hit a rate limit.
A product that calls no such service does not run this lens; state that limitation instead of inventing an integration.

## What the lens adds

Establish, for each outside dependency:

1. **Safe live probes before and after changes.** A small read-only call, sandbox call or dry run that asserts the agreed outcome and fails on disagreement. Record it with `probe record` before a dependency or integration change and the same call after it, then require the matching pair with `probe compare`. Documentation, memory, mocks and recorded fixtures never replace the observation.
2. **Sanitized boundary fixtures.** Recorded responses used by the offline suite are stripped of credentials, tokens, customer data and anything else that must not be committed, and say when and how they were captured.
3. **The distinct failures the product handles differently.** Name each failure the product distinguishes, such as rejected credentials, an expired token, a rate-limit response with a retry hint, a timeout and a malformed body, and give each one a fixture or a probe. Cover those failures instead of every status code.
4. **An offline default suite.** The default test command stays offline; live probes supply vendor evidence and never run inside it.

## Approval and limits

Ask the user first before any call that writes, costs money, sends a message or changes shared data, and again for each side-effecting call.
Unavailable credentials or vendor access are explicit verification limits.
Report the change as unverified with the reason and the assumption; never claim success from a mock.
Keep secrets out of the kit, the plan, evidence and findings: reference the environment variable name, never its value.
Rate limits count against the user's quota, so prefer the fewest probes that answer the question and note any probe that consumed quota.

## In the kit

Put the probe in the kit as a documented helper and list its prerequisites, such as the credential variable and the sandbox account, in the feature file's preconditions.
Give the feature a gotcha for each failure behaviour the product handles differently.
A feature whose outside dependency cannot be reached is reported unreachable with the attempted route, never driven through a different path.
