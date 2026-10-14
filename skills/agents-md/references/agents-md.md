# AGENTS.md guide

## Instruction file classes

`inventory` lists every file named `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` inside the repo, with its scope, and nothing outside it.

| Class | Files | Treatment |
|---|---|---|
| Root | `AGENTS.md` in scope `.` | The file this skill owns |
| Scoped | Any instruction file with a scope other than `.` | Keeps its own scope, and is never flattened into the root file |
| Repo-owned `CLAUDE.md` | `CLAUDE.md` or `.claude/CLAUDE.md` | A merge candidate only when its content is equivalent to the `AGENTS.md` in its scope |
| Local variant | `CLAUDE.local.md` | Reported as possible shadowing, preserved and never edited |

A `CLAUDE.md` is equivalent when its bytes equal the `AGENTS.md` in its scope or it only imports that file with `@AGENTS.md`.
`inventory` reports exactly those cases as candidates.
A `CLAUDE.md` with other content is distinct: its extra content is repo-owned guidance for the author to place, so compare it line by line with `AGENTS.md` and propose a merge only for what the author confirms is the same guidance.
A nested file is a candidate only for the `AGENTS.md` in its own scope.

## What the root file points to

Pointers cover the project's rules, evidence requirements and maintained check commands.
Find each in the source that already owns it instead of restating it.

| Subject | Usual source |
|---|---|
| Purpose and non-goals | `VISION.md` |
| Domain terms | `GLOSSARY.md`, or `GLOSSARY-MAP.md` for several contexts |
| Design and boundaries | The design or architecture document |
| Review standards | `CODING_STANDARDS.md` or `CONTRIBUTING.md` |
| Evidence requirements | The verification kit under `.agents/skills/verify-<app>/`, or the document that says what proves a change |
| Check commands | The project's maintained check command, such as a package script or a make target, named exactly as defined |

A source that exists but has no pointer is a suggestion for the author to select, not an error.
Another skill normally adds its own line when it writes its document, so do not rewrite a line it owns.

## Pointer audit

For each line of the root file, open its target and record one result:

- Resolving: the relative link names a file inside the repo that exists, and the sentence says when to use it.
- Broken: the target is missing, or the link leaves the repo.
- Copying: the line states a rule, definition or command instead of pointing to the source that owns it. Propose replacing it with a pointer only when that source already holds equivalent text, and keep it otherwise.

A line with no link is either merged text the author chose to keep or a copy, so ask which.
A pointer to a command is resolving only when the project defines that command.

## Host loading check

Before proposing to remove a `CLAUDE.md`, read the current official Claude Code memory documentation at https://code.claude.com/docs/en/memory, section "AGENTS.md", and run the host's version command where it is available.
The page read on 2026-10-14 said:

- By default Claude Code reads `AGENTS.md` only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or any directory above it, so a remaining `CLAUDE.local.md` hides `AGENTS.md`.
- Reading `AGENTS.md` directly needs Claude Code v2.1.277 or later, and some sessions before v2.1.281, such as Amazon Bedrock or telemetry-disabled sessions, read `CLAUDE.md` files only.
- A session with the built-in `AGENTS.md` plugin disabled reads `CLAUDE.md` files only.
- A `CLAUDE.md` containing `@AGENTS.md` loads `AGENTS.md` once in every supported session, and the page says to keep it when some sessions cannot load `AGENTS.md` directly.

These facts change with the host, so recheck them and state what the current page and runtime say instead of repeating this list.
Present the compatibility limits with the proposal: removing the file hides the project's instructions in a session that reads only `CLAUDE.md`, and a collaborator's host or version may differ from the author's.
Keeping an import-only `CLAUDE.md` is the safe alternative, and the author chooses.
Other hosts are outside this check unless the author names one, and then the same rule applies to its official documentation.
