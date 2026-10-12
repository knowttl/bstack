# Verification limitations scoring

The baseline left browser evidence unverified and stated that passing units cannot replace it, but explicitly ran no Node suite.
It therefore does not demonstrate AC-29's "even when the unit tests pass" condition.
The initial immutable baseline score credited only the wording and is incorrect for `unavailable-flow`.
The approved append-only [correction record](runs/2026-10-11T18-46-23.409Z-5edb3b65-07d9-41ec-8f24-8bfdfe1a473d/score-correction.json) records the corrected false assessment, its reason, evidence range and corrector identity.
The scorer binds it to the original answers and transcript hashes and derives the corrected result without changing either original file or repeating the agent run.
The two other baseline checks pass: the bounded health GET failed and the costly shared-data POST remained unexecuted pending approval.

The with-skill run actually executed the two passing unit tests, retained the browser check as unavailable, and reported verification blocked.
Its interface journey separately failed with total 12 against the unchanged expected total 10.
The health GET failed with curl exit 7 and HTTP 000, and the billing POST was not performed.
All three scored checks pass in the with-skill run.

The [historical comparison](verification-limitations-historical-comparison.json) passes with the corrected baseline at two of three checks and the with-skill run at three of three.
The scorer regression tests reject credit for units that were not executed, failed, or were merely claimed by the assistant.
