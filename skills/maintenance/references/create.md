# Create guide

Create registers what the project keeps true and wires no-mistakes to check it on every change.
It never writes a document's content: terms, boundaries and purpose stay with their own skills.

## Contents

- Register the documents
- Write the ownership map
- Add the docs gate
- Install the checker
- Effect and limits

## Register the documents

`.bstack/project.json` follows `schemas/project.schema.json`.
Register only documents the project already keeps, each with a stable `id` and its repo-relative `path`.

| Document | Register as | Owner of |
|---|---|---|
| Glossary or each context glossary | any `id`, with `glossary: {context, format}` | domain terms |
| Design or architecture document | `id` `design` | module boundaries and responsibilities |
| Vision | `id` `vision` | purpose, users and non-goals |
| Anything else, such as the README | a descriptive `id` | its own facts, owned by no skill |

The sweep reads these IDs to name the mode that fixes a document, so keep `design` and `vision` exact.
Map code to documents with `scopes`: each scope lists the code paths a document describes, in `paths`, and the `documentIds` and `ruleIds` that govern them.
A rule names a literal sentence in an authoritative document as its `pointer`, and the checks that prove it.
Use the project's own check command as a leaf check and never invoke the checker from a leaf.
Add a `generators` entry only for a section that a command renders into a document between markers.

## Write the ownership map

The map goes into `document.instructions` in `.no-mistakes.yaml`, which no-mistakes gives its Document step on every run.
Write it from the registered documents only, one owner per fact, and keep any instructions the file already holds.
For a project that registers `GLOSSARY.md`, `docs/design.md` and `VISION.md` it reads:

```yaml
document:
  instructions: |
    GLOSSARY.md owns domain terms. docs/design.md owns module boundaries and responsibilities. VISION.md owns purpose, users and non-goals.
    When a change adds, renames or redefines a domain term, update GLOSSARY.md in the same change.
    When a change moves a boundary or responsibility, update docs/design.md in the same change.
    When a change would alter the purpose or a non-goal, do not edit VISION.md; report it as a finding for the author.
```

Replace the paths with the registered ones, and drop the sentence for a document the project does not keep.
No-mistakes applies a correction-only rule to `AGENTS.md`, so the map never asks for additions there.

## Add the docs gate

A gate is a command that runs after a core step and passes on exit code 0.
This one runs the installed checker in docs-only mode after the Document step, so a broken link, an invalid or duplicate glossary entry or a stale generated section stops the run for the author's decision:

```yaml
gates:
  - name: docs
    after: document
    command: node .bstack/bin/bstack-check.mjs --repo . --docs-only
```

Gate names are lowercase words that are not a core step name, so `docs` is valid and `document` is not.
Add the entry to an existing `gates` list instead of replacing it, and keep the name unique.
Docs-only mode needs no base, assessment or network, and it checks the current tree against the contract in `.bstack/project.json`.
Pass `--contract <repo-relative-path>` when the project chose another contract location.

## Install the checker

The checker is the file `scripts/bstack-check.mjs` in this skill, and it is installed unchanged at `.bstack/bin/bstack-check.mjs` as a `create` or `replace-file` edit in the reviewed change set.
It needs only Node 24 and Git, so the gate runs without this skill installed.
Compare the installed bytes with the skill's copy when the skill is updated, and propose a `replace-file` edit when they differ.

## Effect and limits

- No-mistakes honours `document.instructions` and `gates` only from the default branch's copy of `.no-mistakes.yaml`, so the wiring acts once it is merged, not on the branch that adds it.
- The Document step sees only the change's diff, so it keeps terms and boundaries current for that change; drift that built up elsewhere is what the sweep finds.
- The gate command runs repository files at the pushed head, so a contributor who edits the checker or the contract changes what it checks; the signed-off per-change assessment, which SKILL.md names, covers edits to either.
- The map and gate steer a pipeline that is already in use; this skill does not add a pipeline, a hosted workflow or a hook.
