# Design standards

Use this reference when recommending design judgement rules, or deciding where a design rule or a standards document should live.
Start from the project's requirements, approved design and observed risks.
These rules are candidates, not defaults, and a check catches defined mistakes, not every unsound future design decision.

## Contents

- [Judgement rules](#judgement-rules)
- [One authoritative source per rule](#one-authoritative-source-per-rule)
- [Register the design document](#register-the-design-document)
- [CODING_STANDARDS.md](#coding_standardsmd)

## Judgement rules

DRY and KISS are standards for agents changing the project, recommended only where its evidence supports them and recorded with a reason, scope, source, enforcement and exception policy.
Their practical rules are in the architecture reference's principles table; this reference owns where they are recorded and how they are enforced.

| Rule | Enforcement | Evidence the reviewer is given |
|---|---|---|
| DRY | Human review flags duplicated knowledge in code and docs, using [one authoritative source per rule](#one-authoritative-source-per-rule) for placement and links | The duplicated rule, its authoritative owner and the coordinated change it risks, distinguishing incidental similarity |
| KISS | Human review flags needless complexity against approved requirements | The unnecessary abstraction, layer or option and a simpler alternative that preserves required behaviour |
| Keep dependencies purposeful | Human design review against the vision and the design | The requirement, the responsibility and the simpler alternative |
| Explicit state model | Human design review, proposed only with cited evidence and never as a universal rule | The cited state held in scattered booleans, phases or lifecycle checks, the invalid combination or repeated branch it allows, and the state model that would remove it |

An explicit state model is a candidate for state that must stay consistent, such as a lifecycle, a flow or a record with several writers, and not a prescription to rewrite every conditional.
Prefer boring code when the current shape is clear, local and unlikely to grow, and be sceptical of a model that adds indirection without removing branches, duplicated rules or invalid states.
Report the refactor it implies for the user to select, because no skill rewrites product code.
Where the state's steps guard money or data and depend on timing or a rare input, send the model to `/formal-verification create`, which the user runs: a model check is a Detect-rung check, so making the bad state impossible to represent stays preferred.

Do not disguise a human design judgement as a deterministic violation.
Give the reviewer the relevant authority, example and evidence instead.
Recommend a native duplication linter only when language research supports its syntax coverage and project configuration, and prove it first as the boundary checks reference describes.
Clone detection supplies review candidates, not proof that similar code represents the same knowledge, and neither duplication nor complexity scores establish DRY or KISS compliance.
Use a debt baseline, as the boundary checks reference describes, for accepted exceptions instead of silently weakening either rule.
Avoid arbitrary file, function or rule-count limits without a project-specific reason.

## One authoritative source per rule

Preserve an existing standards source that already serves reviewers.
Tool configurations own formatting values and executable constraints, so standards link to those checks instead of copying settings.
Design documents explain the structural decision without maintaining a second copy of a standard.
If a selected edit moves a review rule, replace its old text with a link to the new authority.
Read the relevant existing decisions before proposing a conflicting rule.
Keep proposals as drafts until selected, and keep review before apply for documentation as well as code.

## Register the design document

`/maintenance` reads the project's contract, `.bstack/project.json`, to find which document owns module boundaries, and it routes drift in that document to `/architecture maintain`.
Register the design or architecture document on its document record with the ID `design`, because that exact ID is how the owner is found.
Only propose registration when the project already has a contract, independently for selection, following `schemas/project.schema.json`.
Consolidate it with any other selected changes to that file into one `replace-file` edit with its complete reviewed content.
A project without a contract gets no new one from this skill, because registering documents and checks belongs to `/maintenance`.

## CODING_STANDARDS.md

A missing `CODING_STANDARDS.md` is not a readiness failure, and an existing design section can suffice for a small project.
Propose the file only when non-mechanical judgement rules need a distinct maintained home and no existing source, such as `CONTRIBUTING.md` or a design section, already serves reviewers.
Keep each standard actionable and scoped, with a reason, an example and an exception policy where needed, and link to the design rationale and the enforcing check instead of copying them.
Never record in it a rule that a native config already enforces.

Done when: Every recommended standard has a reason, scope, source, enforcement method and exception policy, each has exactly one authoritative home, and no unselected project write was made.
