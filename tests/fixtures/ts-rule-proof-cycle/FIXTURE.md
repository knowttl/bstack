# ts-rule-proof-cycle

Uses the ts-shop pinned native setup and runtime requirements.
Contains public imports and cycle boundary violations.
The native import resolver proves the cycle case separately.
Run `node tests/fixtures/ts-rule-proof-cycle/sanity.mjs <built-folder> ts-rule-proof-cycle`.
Serves AC-52, AC-60 and AC-66 as fixture inputs.
