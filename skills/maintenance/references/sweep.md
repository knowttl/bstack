# Sweep guide

Sweep checks the whole repo against what the contract registers and returns one list.
It reads and reports; it writes nothing and starts no other skill.

## What the command returns

`sweep` fails when anything drifted and passes when nothing did.
Each problem's `fix` field names who repairs it.

| Problem code | Meaning | Fix |
|---|---|---|
| `contract-missing` | No `.bstack/project.json` | `/maintenance create` |
| `unknown-id`, `missing-path`, `invalid-pointer`, other contract codes | A registration points at something that is gone or invalid | `/maintenance create` |
| `broken-local-link`, `invalid-glossary`, `duplicate-term` in a registered document | Broken link, empty glossary or repeated term | The document's owner: `/glossary maintain` for a glossary, `/architecture maintain` for `design`, `/vision` for `vision` |
| `lagging-document` | Files in a scope changed in Git history since its document last did | The document's owner, as above |
| `stale-generated-section`, other generator codes | A generator's output differs from the section in its document | `/maintenance` with its `docs generate` command and a selected change set |
| Kit codes such as `file-drift`, `file-missing`, `orphan-feature-file`, `pointer-missing`, `source-path-missing` | A verification kit no longer matches its plan or the repo | `/verification maintain` |
| `broken-local-link` in `AGENTS.md` | A pointer's target is gone | `/agents-md` |

A document registered under another ID has no owning skill, and its problems are corrected by hand.
`lagging-document` reads committed history only, so it is a prompt to look, not proof of drift.

## Drift the command cannot see

Names and boundaries are judged by reading, not by a script, so the sweep does it with the same evidence rules as the owning skills.

1. For each registered glossary, take the last commit that changed it, from `git log -1 --format=%H -- <path>`.
2. List the files changed since then with `git diff --name-only -z <commit> HEAD`, plus staged, unstaged and untracked files.
3. Read those files for domain nouns the glossary lacks, definitions they now use differently, and names the glossary tells readers to avoid.
4. For each registered design document, read the changed modules for responsibilities, interfaces or dependency directions the document no longer describes.
5. Cite `path:line` for every item, and word it as a count and a mode, for example `3 new terms in packages/billing - run /glossary maintain`.

Do not define a term, choose a meaning or edit a boundary here.
Code shows current behaviour, not intended meaning, so the owning mode asks the author.
A glossary or design document with no committed history has no baseline: report it as unchecked and name the missing baseline.

## Report

Return one list.
Each line names the file, what drifted, the evidence and the mode to run.
End with what was checked, what could not be checked and the statement that nothing was written.
