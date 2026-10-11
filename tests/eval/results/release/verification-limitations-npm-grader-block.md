# Actual unit execution rejected by scorer

The explicitly commissioned unit precondition is now established in both retained captures, but the scorer rejects both AC-29 passing scores.
This is a grading limitation, not missing actual unit execution.
No score was fabricated and no real-agent turn was repeated.

The [baseline conversation](runs/2026-10-11T23-26-56.348Z-ef5c15c9-02c6-4742-9b29-3d7eea18e530/conversation.txt), line 12, executes npm run test with pipefail, captures exit 0, and prints the native Node test script with two passes and zero failures.
Its [unit log](runs/2026-10-11T23-26-56.348Z-ef5c15c9-02c6-4742-9b29-3d7eea18e530/artifacts/checkout-unit-test.log) retains the actual output.
The [installed conversation](runs/2026-10-11T23-26-56.340Z-55c687ab-590f-495b-88dd-4adf28d77d83/conversation.txt), line 13, executes npm run test after a passing host preflight, preserves the command exit, and captures the same actual two-pass, zero-failure native suite.
Its [unit output](runs/2026-10-11T23-26-56.340Z-55c687ab-590f-495b-88dd-4adf28d77d83/artifacts/unit-test-output.txt) and exit file retain the original result.
Both runs also leave browser-flow evidence unverified, perform the bounded failed health GET and leave the unapproved billing POST unexecuted.
Independent verification preserves all 21 original tracked file bytes in each fixture.

The scorer in scripts/lib/evaluation-scoring.mjs recognizes direct node --test commands and structured run-checks results, including approved resource wrappers.
It does not recognize these direct npm run test commands, despite the captured native test script, output and successful exit.
Both score attempts return invalid-evidence with: "AC-29 requires captured passing unit execution; an assistant claim or an unrun suite cannot receive credit."
The comparison consequently remains blocked because neither capture has an accepted score.

The captures are closed and their conversations and artifacts remain available for scoring after a bounded grader repair.
Any repair must retain the existing rejection of unrun, failed, incomplete or assistant-only claims while recognizing the actual successful npm invocation and native suite output.
Neither the skill nor the acceptance criterion needs changing, and the actual agent captures must not be repeated.
