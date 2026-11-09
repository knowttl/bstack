# Create guide

Create registers what the project keeps true and wires no-mistakes to check it on every change.
It never writes a document's content: terms, boundaries and purpose stay with their own skills.

## Contents

- Register the documents
- Record the instruction baseline
- Offer the no-comments rule
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
| Implementation plan | `id` `plan` | its units, and the removal condition it states |
| Anything else, such as the README | a descriptive `id` | its own facts, owned by no skill |

The sweep reads these IDs to name the mode that fixes a document, so keep `design`, `vision` and `plan` exact.
Map code to documents with `scopes`: each scope lists the code paths a document describes, in `paths`, and the `documentIds` and `ruleIds` that govern them.
A rule names a literal sentence in an authoritative document as its `pointer`, and the checks that prove it.
Use the project's own check command as a leaf check and never invoke the checker from a leaf.
Add a `generators` entry only for a section that a command renders into a document between markers.

## Record the instruction baseline

The instructions an agent loads grow by accretion, so the contract records how large they are and the docs gate fails when they grow past it.
Put test inputs and fixture trees in the draft contract's `instructions.exclude`, because their `AGENTS.md` and `CLAUDE.md` files are data and not loaded instructions.
Prepare a scratch clone reflecting the target's current filesystem state, including staged, unstaged, untracked and ignored files.
Place the draft contract and final proposed wiring edits, including any instruction-file pointer, in that clone.
Run `instructions measure --repo <scratch-clone> --json` and record `data.total.bytes` as `bytes` in `instructions.baseline`, with a specific `reason` saying why that size is right now:

```json
"instructions": { "exclude": ["tests/fixtures/**"], "baseline": { "bytes": 6457, "reason": "Initial project guidance" } }
```

If a selection or revision changes the proposed instruction tree or exclusions while the contract edit remains selected, refresh the clone from the target's current filesystem state, apply the selected edits, remeasure and update the baseline, then validate and present the revised bytes for approval.
If the contract edit is deselected, leave the existing contract unchanged, validate the selected tree in scratch, and report any resulting failure.
The gate measures the same sources as `instructions measure` and passes while the total is at or below `bytes`.
A change that needs more, including re-recording an existing baseline during create, must raise `bytes` to the new measure in the same change and replace `reason` with a new reason why the growth is worth its cost, so the increase shows in the diff for review.
Use `Measured when registered` only for first registration when the prior contract is readable and has no baseline.
If the prior contract or `origin/main` cannot be read, use a specific non-initial reason.
After pruning, lower `bytes` to the new measure so the saved room cannot be spent again unreviewed.
A contract without `instructions.baseline` has no instruction gate.

## Offer the no-comments rule

Offer an owner-selected rule that rejects every comment in project-authored code, including tests, test fixtures and snapshots that are code, except tool directives, license or SPDX headers, and a shebang on the first line.
Directives include `# type: ignore`, `//go:build` and `# noqa`; rationale, warnings, documentation comments and linked explanations are violations.
Exclude only vendored third-party code, tool-generated output marked as generated, and non-code files such as lockfiles from this rule.
Existing contributor guidance that permits other comments needs reconciliation before adoption.

Use a maintained native linter rule only when it enforces the whole policy; warning-comment rules alone are insufficient.
Otherwise propose a small project-owned check using the language's tokenizer or parser, recognising actual directives and headers rather than arbitrary comments containing their words.
Wire the selected check into the project's one maintained check command, and include all proposed files, dependencies, configuration and handling of existing violations in the review.
Do not alter existing comments or enforcement without the owner's approval of the exact changes.
Before adoption, prove the selected rule and the integrated command in disposable fixtures: clean code and files with directives, license or SPDX headers and a shebang pass, while a plain comment fails with the expected diagnostic.
Repeat the proof with a plain comment as the sole violation in a project-authored code fixture, such as `tests/fixtures/example.py` in a Python project, and in a snapshot that is code when the project has one; each must fail with the rule's diagnostic.
Record unsupported syntax and languages as coverage limits.

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
This one runs the installed checker in docs-only mode after the Document step, so a broken link, an invalid or duplicate glossary entry, a stale generated section or instructions larger than `instructions.baseline` stops the run for the author's decision:

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
  `/verification` and `/foundation` may offer an optional pre-push hook to a repo that has no gate, so maintenance never adds one itself and never replaces a gate with one.
