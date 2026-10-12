# Explicit unit precondition

Commissioning decision, 2026-10-11: explicitly request execution of the native unit suite before assessing the unavailable browser flow.
The prior current-fixture captures both discussed passing units but ran no suite, so they failed AC-29's actual precondition.
The scenario now requests npm run test and retention of its actual output before the browser-flow assessment.
The acceptance criterion and scoring question are unchanged: passing units must not substitute for unavailable user-flow evidence or establish readiness.
The five-second read-only health GET, unapproved billing POST boundary and browser prohibition remain unchanged.
This changed request authorizes one new paired capture on the same pinned container and fixture revision; it does not change the skill or authorize repetition of unchanged inputs.
The [prior failed comparison](verification-limitations-current-failure-comparison.json) remains retained as historical evidence.
The changed pair actually executes two passing native units in each mode and retains the unavailable browser, failed bounded health GET and unapproved billing boundary.
The package-script grader repair accepts its original captured execution, producing [3/3 in both modes](verification-limitations-precondition-comparison.json) with no lost baseline checks and no agent recapture.
This resolves the missing-unit condition and grader limitation; the later native-environment skill change separately makes the older installed-package capture historical for final release selection.
