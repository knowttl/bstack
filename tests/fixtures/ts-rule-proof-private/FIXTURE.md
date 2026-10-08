# ts-rule-proof-private

Uses the ts-shop pinned native setup and runtime requirements.
Contains public imports and private boundary violations.
The native import resolver proves the private case separately.
Run `node tests/fixtures/ts-rule-proof-private/sanity.mjs <built-folder> ts-rule-proof-private`.
Serves AC-52, AC-60 and AC-66 as fixture inputs.
