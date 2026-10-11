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
