# Foundation proposal

Use this reference to propose the smallest sound foundation for a new project.
Start from the approved vision, the confirmed technical context, the glossary and the design when the user ran them.
Every choice below is a candidate tied to a requirement, never a default.

## Contents

- [Choose the stack](#choose-the-stack)
- [Choose the scaffold](#choose-the-scaffold)
- [Choose the first journey](#choose-the-first-journey)
- [Choose the native checks](#choose-the-native-checks)
- [Record each proposal](#record-each-proposal)

## Choose the stack

Tie the language, framework and storage to a requirement from the vision or the technical interview, and name the meaningful alternative with its trade-off.
Keep the target's language independent of this skill's Node helpers: the helpers run the plan, and the project uses whatever stack the owner selects.
Prefer the platform's standard library and one well-supported tool over a framework stack that no requirement needs.
An unresolved choice such as offline access blocks the dependent stack recommendation, so name the blocked choice instead of guessing.
Research order for a missing capability: the stack's own configuration conventions first, then its official documentation, then established community guides.
Without web access, mark language and outside recommendations "not researched" with the reason, and rely on the confirmed context and general principles alone.

## Choose the scaffold

Include only files that the first journey, the declared checks or the approved documents need.
The scaffold carries these, each with its complete reviewed UTF-8 payload:

- The approved `VISION.md` bytes, at the root path `VISION.md` that the creation plan requires.
- The confirmed glossary and the design, when the user ran `/glossary` and `/architecture`, at their real paths.
- A `README.md` that states what the project is, the setup commands and the check commands exactly as the plan declares them.
- The source, manifest and native configuration that the journey and the selected checks need.

Do not add speculative frameworks, service layers, integrations, hosted pipelines or empty document templates.
CI is an explicitly selected integration, and hosted behaviour that has not run remains unverified.
Cover data flow, errors, configuration and external interfaces only where the first journey touches them.
Terms in code and documents use the glossary's words.

## Choose the first journey

The first journey is the smallest end-to-end path that shows the project does its job for a user.
State it as steps a user takes and the outcome they see, then name the native command that performs it and fails when the outcome is wrong.
Take the expected outcome from the approved vision or the confirmed context, never from what the scaffold happens to print.
A journey that only prints a fixed string, or passes whatever the code does, does not count.
Make the journey work end to end where practical, and keep out features the journey does not need.
When a browser or device interaction cannot be observed here, report that part as blocked instead of claiming it passed.

## Choose the native checks

Include setup, formatting, linting, type checking where the stack has it, and tests, using the stack's own tools and one maintained command that runs them together.
Use a formatter, linter or type system only when it expresses a required constraint reliably, and separate formatting from design checks.
Per-language rule mappings are proven in the created project with `rule-proof`, never asserted from a table.
Testing rules and the verification kit belong to `/verification create`: list it as a next step and do not draft testing guidance here.
Prefer native checks and one source of truth over duplicated prose or a second verification engine.
Distinguish automated rules from judgement rules, and leave design judgement rules to `/architecture`.

## Record each proposal

| Field | Required evidence |
|---|---|
| Reason | The vision requirement or confirmed decision that the choice serves |
| Alternative | The meaningful alternative and why it was not chosen |
| Scope | The files and commands the choice adds |
| Verification | The command that proves it in the scratch scaffold and the outcome it must show |
| Open decision | Any unresolved choice that blocks it, named instead of guessed |
