# Maintain guide

Maintain keeps an existing glossary true as the project's names change.
It reviews only what changed since the last review, proposes glossary edits and never renames code.

## The baseline

The last review is the commit that last changed a glossary file: run `git log -1 --format=%H -- <glossary paths>` over the glossary, or over the map and each context glossary.
The user may name another baseline, such as a release tag, and then it replaces the default.
A glossary with no committed history has no baseline, so ask the user for one instead of reviewing the whole repo silently.
Record the baseline, the current revision and the working-tree state, and preserve uncommitted user work.

## What to collect

Collect the union of files changed between the baseline and the current revision, staged changes, unstaged changes and untracked files, and read the commit messages for the names the team used.
Use `git diff --name-only -z <baseline> HEAD`, `git diff --cached --name-only -z`, `git diff --name-only -z` and `git ls-files --others --exclude-standard -z` to build that inventory, preserving paths from the NUL-delimited output.
Collect domain nouns from documentation headings and prose, public type, module and entity names, enumerated values, user-facing labels and API resource names in the changed files.
Leave out frameworks, storage choices, helper names, build vocabulary and other implementation detail, and say why when a borderline name is dropped.
Every candidate cites repo-relative `path:line` with state kind `sha256` and the SHA-256 of the exact working-tree file bytes read, including uncommitted files, so `cite-check` can establish freshness.

## The three classes

Give each candidate exactly one class.

| Class | Evidence needed | Proposed edit |
|---|---|---|
| Missing term | A domain name used in changed docs or code that has no glossary entry | A new entry with a confirmed definition |
| Drifted meaning | An existing entry whose definition disagrees with how changed docs or code now use the term, with both citations | A revised definition once the user confirms which meaning is intended |
| Returning synonym | A name the glossary lists to avoid, or another name for a defined concept, used again in changed docs or code | The synonym recorded under the entry's avoided names, and the docs or code locations listed for separate renames |

Ask the user which reading is intended whenever the evidence supports two, and never choose the meaning from the code alone.
Code shows current behaviour, not the intended definition.
A term whose context is unclear is asked about before it is defined.
A decision record that fixes the meaning is cited, and a conflict with it goes to `/architecture` instead of being resolved here.

## Outcomes

Report exactly one outcome.

- Clean: the complete inventory has no committed changes since the baseline and no staged, unstaged or untracked changes in docs or code, or every changed name across that inventory is covered and consistent. Name the baseline and the files read.
- Changed: the user selected edits, `apply` wrote them from a reviewed change set, and `docs check` was run again when the glossary is registered.
- Blocked: a prerequisite is missing, such as a baseline, an answer the edit depends on or a working tree that changed under the plan. Name it and its fix.

Renames that would align code or docs with the glossary are listed with their locations and left for the user to select as separate changes.
Edits to the vision, the design and decision records are out of scope and are named as next steps for the user to run.
