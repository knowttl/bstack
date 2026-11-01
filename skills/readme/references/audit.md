# Auditing an existing README

An audit compares the README with the project and with the checklist, and ends in findings that a user can select one by one.
It reads, never rewrites, until the user selects changes.

## Contents

- Inputs
- Procedure
- Severity
- Findings
- Cold-start test

## Inputs

Collect these before judging anything.

- Every `README` file in the repo, including those in `docs/` and `.github/`, and which one the host shows: `.github`, then the root, then `docs`.
- The project's own description of itself: the manifest (`package.json`, `pyproject.toml` or the equivalent) name, description and keywords.
- The real install and run path: the manifest scripts and bin entries, the CLI's `--help` output where it can be run without side effects, and the skill files.
- The deeper documents the README links to or should link to: `docs/`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `LICENSE`.
- The host metadata when it is available read-only, such as the repository description and topics from `gh repo view --json description,repositoryTopics`.
  When the host cannot be read, report that the findability items for description and topics were not checked.

## Procedure

1. **First-screen test.**
   Read only the first 30 lines.
   Answer five questions from them: what is it, who is it for, why does it exist, how do I install it, what do I run first.
   Each unanswered question is a finding.
2. **Claim check.**
   List every command, flag, path, version, environment variable and link the README states.
   Check each against the code, the help output or the file system.
   A claim that cannot be checked is reported as unverified, never assumed true.
3. **Findability pass.**
   Walk the Findability table of the checklist against the README and the host metadata.
4. **Scannability pass.**
   Walk the Human scannability table, and measure the line count and the longest paragraph.
5. **Agent pass.**
   Walk the Agent readability table, then run the cold-start test below.
6. **Placement pass.**
   Mark every block that belongs in another file by the leave-out list, and name the file that should hold it.
   If that file does not exist, name the skill or the author decision that would create it, and do not create it here.
7. **Order the findings** by severity and group those that share a fix.

## Severity

| Severity | Meaning | Examples |
|---|---|---|
| Blocker | A reader or agent following the README fails or is harmed | A wrong install command, a command that does not exist, a leaked secret, a broken entry point |
| Major | The README omits a fact a reader needs to start | No value statement, no install path, no entry point, no verification command, no auth guidance |
| Minor | The README is harder to find or read than it should be | A weak opener, a missing topic, a badge wall, a paragraph over four lines, a manual table of contents |

## Findings

Record each finding with these parts so the user can decide on it alone.

- Problem: what is wrong, citing the README file and line.
- Consequence: who is hurt and how, such as a searcher who cannot find it or an agent that fails to install.
- Evidence: the repo location or command output that shows it, cited as `path:line`.
- Fix: the exact change, in words or as proposed text.
- Scope: the files the fix touches.
- Verification: how to confirm it, such as the command that prints the expected output or the link that now resolves.

Report findings the README cannot fix, such as the repository description and topics, as recommendations with the exact value to set.
Report nothing the user did not ask to have judged, such as the project's license choice.

## Cold-start test

Read only the README, as an agent with an empty context would, and answer from it alone.

1. What is this and what is it for?
2. What must be present before installing it?
3. What is the exact install command?
4. How do I know the install worked?
5. What is the single entry point, and what is the first useful thing to run?
6. Where do settings live and how are credentials supplied?
7. Where are the deeper docs and where do agent instructions live?

An answer that needs a guess, another page or a question to the user is a finding.
Record the answers with the README line each came from.
