# Representative extension requires a fixture decision

AC-64 cannot pass the representative-extension scenario on its current ts-rule-proof starting state.
The [fresh comparison](representative-extension-current-failure-comparison.json) scores 0/1 in both modes; neither a missing prerequisite nor coverage from the separate independent-extension scenario waives this scenario.
No acceptance procedure is marked completed on this failed evidence.

The [baseline conversation](runs/2026-10-12T00-32-51.154Z-c93e352f-ecca-46fc-a9cb-191bd6a75b5f/conversation.txt), lines 6–61, implements serviceQuote through the public core interface and passes two units, types and native boundaries, but explicitly reports no approved examples or guidance and incomplete verification against them.
Independent checks retain its three changed files and diff, the unchanged original quote function and assertion, and hashes confirming all other tracked inputs unchanged.

The [installed conversation](runs/2026-10-12T00-34-38.718Z-0bbff631-6f4f-464b-9916-13844ced9f2a/conversation.txt), lines 7–60, actually validates the absent .bstack/project.json and returns contract-unavailable.
After the ordered scripted reply, it passes existing quote units, types and boundaries but leaves the new feature unimplemented because approved examples and the contract are missing.
The declared journey command also has no journey.mjs file.
Its [independent record](runs/2026-10-12T00-34-38.718Z-0bbff631-6f4f-464b-9916-13844ced9f2a/artifacts/independent-verification.json) verifies all eleven tracked files unchanged and login removal.
Both complete conversations, false scores and final isolated-home/container cleanup are retained.

A differently shaped check confirms the fixture mismatch: the actual Git inventory has no guidance, design, approved-example record, maintenance contract or journey file, and [the fixture declaration](../../../fixtures/ts-rule-proof/FIXTURE.md) describes rule-proof inputs serving AC-52, AC-60 and AC-66 rather than a maintained extension starting state.
The package correctly stops at missing authority instead of inventing an approved outcome.

Recommended commissioning decision: use the already-existing maintained-ts-shop fixture for this scenario and supply a concrete approved public-interface extension outcome, preserving original quote and checkout behavior and the AC-64 scoring criterion.
Changing only this scenario's fixture selection and request would require fresh baseline and installed captures for this pair; it would preserve the global fixture revision and unrelated completed comparisons.
The alternative is a separately approved maintained setup for the current fixture, which must also supply its missing examples, contract and journey before a new pair can be captured.
The commissioning decision on 2026-10-12 approved the existing maintained-ts-shop starting state and one concrete extension outcome: quote defaults to one unit at 12 and supports two units at 24 through the public core interface.
The scenario now selects that existing overlay and names this outcome, preserving the original checkout journey, total 10, quote assertion and user note.
Its scoring criterion, ordered answer and final checkpoint remain unchanged, as does the global fixture revision.
Only this changed pair requires fresh captures; the failed pair remains visible as the reason for the decision.
The separate final-independent-extension scenario remains without-only because its criterion expressly requires no discoverable audit skill; this representative-extension scenario still requires both modes.
