# Sweep guide

Sweep checks the whole repo against what the contract registers and returns one list.
It reads and reports; it writes nothing and starts no other skill.

## What the command returns

`sweep` fails on evidence-backed drift and passes when no drift is demonstrated in the checked scope.
Each problem's `fix` field names who repairs it.
Skipped Markdown and unsupported link fragments in registered content or `AGENTS.md` appear only in `data.coverageLimits`, with a `path` and `reason`.
These are unchecked scope, never problems or repair items, and never fail the command by themselves.

| Problem code | Meaning | Fix |
|---|---|---|
| `contract-missing` | No `.bstack/project.json` | `/maintenance create` |
| `unknown-id`, `missing-path`, `invalid-pointer`, other contract codes | A registration points at something that is gone or invalid | `/maintenance create` |
| `broken-local-link`, `invalid-glossary`, `duplicate-term` in a registered document | Broken link, empty glossary or repeated term | The document's owner: `/glossary maintain` for a glossary, `/architecture maintain` for `design`, `/vision` for `vision` |
| `stale-generated-section`, other generator codes | A generator's output differs from the section in its document | `/maintenance` with its `docs generate` command and a selected change set |
| Kit codes such as `file-drift`, `file-missing`, `orphan-feature-file`, `pointer-missing`, `source-path-missing` | A verification kit no longer matches its plan or the repo | `/verification maintain` |
| Suite codes such as `file-drift`, `table-drift`, `source-paths-missing`, `orphan-property-file`, `step-code-missing`, `tool-hash-mismatch` in a `formal-*` folder | A formal verification suite no longer matches its plan, the repo or its pinned tool | `/formal-verification maintain` |
| `broken-local-link` in `AGENTS.md` | A pointer's target is gone | `/agents-md` |

A `formal-*` suite is checked next to the kit, and a `verify-` kit is never read as a suite.
A suite whose pinned tool file is missing is unproven and not drifted, so it appears in `data.coverageLimits` and never fails the command.

A document registered under another ID has no owning skill, and its problems are corrected by hand.
Code changes or document age alone are not evidence of drift and never create repair items or fail the command.

## Drift the command cannot see

The claims of every registered document are judged by reading the whole current repo, with the same evidence rules as the owning skills.

1. Inventory every registered document and the current repository areas, including staged, unstaged and untracked content.
   Review all areas, including those outside registered scopes; history may order the work but never exclude files or documents.
2. For each registered glossary, read current domain code for nouns the glossary lacks, definitions it uses differently, and names the glossary tells readers to avoid.
3. For each registered design document, read current modules for responsibilities, interfaces or dependency directions the document no longer describes.
4. For each registered README, check its instructions and factual claims against current commands, configuration and behaviour.
   For each registered vision, compare its purpose, users and non-goals with current behaviour and approved intent; report mismatches for `/vision` without deciding a new purpose.
   For every other registered document, compare its claims with their current repository evidence and name its owning mode or manual correction when no skill owns it.
5. Cite document and repository `path:line` evidence for every drift item, and word it as a count and a mode, for example `3 new terms in packages/billing - run /glossary maintain`.
   Record each document as current, drifted or unchecked, naming any inaccessible evidence and unreviewed repository areas.

Do not define a term, choose a meaning or edit a boundary here.
Code shows current behaviour, not intended meaning, so the owning mode asks the author.
No committed history or baseline is needed to review the current repo.

## Report

Return one list.
Each line names the file, what drifted, the evidence and the mode to run.
End with what was checked, what could not be checked and the statement that nothing was written.
Include unresolved `data.coverageLimits` as unchecked scope in that closing account, without a repair mode or a claim of drift.
