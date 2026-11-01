# AGENTS.md guide

## Instruction file classes

`inventory` lists discovered regular files named `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` inside the target, with their scope.
It follows no file or directory symlinks and inspects nothing outside the target.

| Class | Files | Treatment |
|---|---|---|
| Root | `AGENTS.md` in scope `.` | The file this skill owns |
| Scoped | Any instruction file with a scope other than `.` | Keeps its own scope, and is never flattened into the root file |
| Repo-owned `CLAUDE.md` | `CLAUDE.md` or `.claude/CLAUDE.md` | A merge candidate only when its content is equivalent to the `AGENTS.md` in its scope |
| Local variant | `CLAUDE.local.md` | Reported as possible shadowing, preserved and never edited |

A `CLAUDE.md` is mechanically equivalent when its bytes equal the existing `AGENTS.md` in its scope or its trimmed content is a lone import of that file, using the relative path from the `CLAUDE.md` directory, optionally prefixed with `./`.
`inventory` reports every root-scope `CLAUDE.md` as a review candidate, even without an existing `AGENTS.md`; it reports a nested candidate only for those mechanically equivalent cases.
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
| Affected and full test commands | The package script, make target or task the project defines for tests of the changed code and for the whole offline suite, named exactly as defined |

A source that exists but has no pointer is a suggestion for the author to select, not an error.

### Affected and full commands

When the project defines both an affected-test command and a full-suite command, propose these two pointer lines, each with its one link to the file that defines the commands (written below without its links):

```md
Iterate with the affected-test command, `<affected command>`, defined in <defining file>.
Run the full suite, `<full command>`, and the maintained check, `<check command>`, once before the gate and again after any dependency change, as defined in <defining file>.
```

The second line is the contract: the full suite and the check run once before the gate, not after every edit, and again only when dependencies change.
Name each command exactly as the project defines it.
Command pointers name the commands and link to their definitions; they do not copy command implementations into the root file.
When the project defines no affected command, propose only the second line, and do not invent a command to point at.
A project with no gate keeps the same contract, and the line then says before pushing in place of before the gate.
Another skill normally adds its own line when it writes its document, so do not rewrite a line it owns.

## Pointer audit

For each line of the root file, open its target and record one result:

- Resolving: the relative link names a file inside the repo that exists, and the sentence says when to use it.
- Broken: the target is missing, or the link leaves the repo.
- Copying: the line states a rule, definition or command implementation instead of pointing to the source that owns it. Propose replacing it with a pointer only when that source already holds equivalent text, and keep it otherwise.

A line with no link is either merged text the author chose to keep or a copy, so ask which.
A pointer to a command is resolving only when the project defines that command.

## Kept-rule audit

Classify each non-pointer rule kept in the root file, including text selected for a merge, with its file and line as evidence.
Keep the classification in scratch and the report, not in an instruction-file rule table.

- Enforceable: name the highest workable rung, starting with Eliminate (types or architecture), then Detect (lint, types or dependency-graph checks).
  For example, a rule forbidding one module from importing another is a candidate for a dependency boundary or import check.
  Suggest `/verification correct` with the cited rule as a candidate; that skill establishes repeated-mistake evidence and proves the enforcement.
  Do not invoke it, change product code or add checks during this audit.
- Judgment: explain why the rule needs contextual judgment and remains at Encode (prose) or Review (human judgment).
  For example, choosing a useful abstraction can remain a judgment rule when no type or check can decide it.

A rule does not move up merely because a check has a promising name.
Open the check and its proof evidence before proposing to replace already-enforced prose with one pointer to it.
Preserve kept text until the user selects that replacement; a candidate without proven enforcement stays reported as unenforced.

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
