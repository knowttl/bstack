# Plan format

A plan is one document that tells a builder what to build in what order and what proves each piece done.
The plan record that `plan check` reads and the document the user reads state the same units, and the document is written from the checked record.

## Contents

- Story map
- Units
- Evidence
- Non-functional targets
- The document
- What the plan leaves out

## Story map

List every story in the design with its acceptance cases, meaning observable outcomes that show the story works for its user.
Mark a story core when the product cannot do its job without it, and put core stories first.
"Story map" is the name for this list; the verification kit's "feature map" is a different thing.
A story with no acceptance case goes back to the user as a question.

## Units

A unit is the smallest slice of work that ends in a state something can check.
Each story becomes one unit or several, and a slice that cannot be checked on its own merges into the one that can.
Each unit ends in a verifiable state, and the next unit starts only after the previous one is green.
Order units so the sequence proves itself: a scaffold before the feature on top of it, and a baseline capture before the change it measures.

| Field | Contents |
|---|---|
| `id` | A stable ID such as `U1`, which the document's heading repeats |
| `title` | The work as a verb phrase |
| `core` | Whether the unit belongs to a core story |
| `dependsOn` | The IDs of units that must be done first, with no cycle |
| `design` | One or more citations of the design sections the unit implements, `path:line` bound to the SHA-256 of the exact bytes read |
| `boundary` | The module or boundary the unit touches, named from the project's design document, or from the design when the project has none yet |
| `doneWhen` | Observable results, each checkable without reading the code |
| `evidence` | The checks or kit features that prove the unit, as below |

A core unit depends only on core units.
Cite the project's vision, glossary and design document where a unit depends on one of their rules, instead of restating the rule.

## Evidence

Every unit names the evidence that proves it, because a unit nobody can check is a wish.
Evidence is a check, meaning a test, a lint or an import-boundary rule, or a verification kit feature, meaning one of the feature files that `kit prove` drives.
Prefer a check the project already proves with `rule-proof`, and a kit feature the kit already lists.
Where no such check exists yet, the evidence names the check the unit adds, and the unit's Done when says it exists and fails on a seeded violation.
`plan check` verifies that a unit names evidence and that the plan is acyclic and cited; it cannot verify that the evidence exists or would pass.

## Non-functional targets

A non-functional target is a measurable limit on how the product behaves, such as a response time, a size limit or an availability level.
Carry each one as evidence on every unit it constrains, with the target written in the evidence entry's `nonFunctionalTarget` and the check that measures it in `ref`.
Add its threshold to the unit's Done when.
A target no unit constrains, or none can measure, is an open question for the user and appears in the document's open questions.

## The document

Write the plan to `docs/plan.md` unless the user names another path, and replace an existing plan only when the user asks.
Use these sections in this order, each heading stating the task or the finding:

1. A title and a purpose of under ten lines: what is built, for whom, and the units in order.
2. "How to read this": a unit is done only when its evidence exists and passes, and the plan is a description of the work, not an instruction to start it.
3. "Build order": the units in dependency order from `plan check`, each with the units it depends on.
4. One section per unit, headed `### <id> <title>`, with Depends on, Design, Boundary, Done when and Evidence in that order.
5. "Decisions": each answer from the builder check and each default taken, with its source.
6. "Open questions" and "Gaps": questions the user left open, and each missing input with the skill that would create it.

## What the plan leaves out

The plan states what depends on what and what proves each unit done.
It names no development method, tool, agent or model, assigns no owner, carries no progress boxes and does not say who runs it or when.
It never tells a reader to start a unit, and the skill never runs one.
