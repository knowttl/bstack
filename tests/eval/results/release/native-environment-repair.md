# Prepared native environment discovery

The Python audit missed the already prepared Python 3.12 and Ruff environment and used system Python 3.11 instead.
An independent check confirmed that .venv/bin/python and .venv/bin/ruff were available in the original pinned container fixture.
The owning verification rules now state once that audits detect and prefer the project's prepared environment or lockfile tool manager over system defaults and report the actual interpreter and tool versions.
This repairs discovery rather than naming an environment in the evaluation request.
The Python request, fixture, rubric and retained baseline remain unchanged; one new with-skill capture will test the instruction.

The AC-29 grader now recognizes actual package-script execution with captured native pass/fail counts and exit zero.
It continues rejecting assistant-only claims, unrun suites, nonzero exits, truncated wrapped output and different wrapped native versions.
The focused grader regression passes all ten cases, including accepted npm execution, discussed-only npm units and nonzero npm execution.
The two existing changed-request AC-29 captures will be re-scored without repeating agent execution.

The new instruction changes the installed package's bound input bytes.
Earlier with-skill captures therefore remain historical under the release validator's package-source comparison, even when their individual comparisons pass.
The authorized Python-only rerun does not itself refresh those other package-bound final captures.
The single repaired Python capture passes 4/4 against the retained 3/4 baseline, with no lost check, in the [current comparison](existing-repo-python-comparison.json).
It discovers the prepared tools without an environment hint in the request, reports Python 3.12.15 and Ruff 0.14.0, and actually executes both unit tests, Ruff lint, the native boundary command and the public ledger/startup journey.
The [independent verification](runs/2026-10-11T23-38-07.646Z-4b2b39e0-6e2e-4115-a125-f3ffe28e8ffb/artifacts/independent-native-verification.json) matches the returned recorder data to its actual artifact, the interpreter versions and journey script hash.
Known private-import failure remains visible; formatting is diagnostic because no formatter policy was adopted.
The unchanged fixture's eleven tracked files, full conversation and eighteen scratch artifacts remain retained, and the isolated home is deleted after scoring.
