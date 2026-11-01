# What stays out of a README

A README is a bulletproof first impression, not the project's whole documentation.
Keep it to what a visitor or an agent needs to start, and link to everything else.
GitHub's own guidance is that a README holds only what developers need to get started using and contributing, and that longer documentation belongs elsewhere.

| Leave out | Why | Put it in |
|---|---|---|
| The full command, flag or API reference | It goes stale and buries the first action | A generated or hand-kept reference under `docs/`, linked from the catalogue |
| The contribution process, review rules and release steps | It is for the few who contribute | `CONTRIBUTING.md` |
| Coding standards and conventions | They govern changes, not use | A standards file the project names, and `AGENTS.md` by pointer |
| Agent rules and build or test commands for agents | The README is for people first | `AGENTS.md`, kept short and pointing at the sources of rules |
| The glossary of domain terms | It is reference, not onboarding | `GLOSSARY.md` |
| Architecture, design rationale and decision records | They explain why, after the reader has started | The design document and decision records |
| The changelog and release notes | They grow without bound | `CHANGELOG.md` or the release page |
| The roadmap and the to-do list | They go stale and promise what is not built | The issue tracker or a roadmap file |
| Long tutorials and walkthroughs | They are a different document type from a landing page | A `docs/` guide, linked |
| Security policy detail | It needs its own reporting path | `SECURITY.md` |
| Install variants for every operating system and package manager | They bury the main path | The main path inline, the rest in an install guide, linked |
| A manual table of contents on a short README | The host builds an outline | Nothing; use an anchor row only when the README is long |
| A wall of badges | It pushes the value statement down the page | Five true badges at most |
| Superlatives, hype and comparison with competitors | They are unverifiable and add no fact | A specific statement of what it does |
| Screenshots or GIFs of text, commands or output | Search and agents cannot read them | A code block of the text, with an image only for a visual interface |
| Claims no one has checked, and features not built | A wrong README costs more than a short one | Nothing, or a label saying pending |
| Secrets, tokens, real tenant data, private hostnames and local paths | They leak and mean nothing to others | Synthetic values and credential references |
| Duplicated content that another file owns | Two copies drift | One link to the owning file |
| Placeholder text, `TODO` markers and empty sections | They signal an unfinished project | Remove the section |

A README may be longer than a minimal template when the project needs it, because a missing install step is worse than a long file.
Handle length by moving depth out, not by deleting facts the reader needs to start.
