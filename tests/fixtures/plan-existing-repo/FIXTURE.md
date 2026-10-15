# plan-existing-repo

Kind: Git repo.
The seed inherits `clear-goals` (an approved vision, an authoritative design and settled domain terms) and adds `docs/export-design.md`, an approved design for one new feature with stories, acceptance cases and a non-functional target, in a third commit.
The queue's boundaries in `DESIGN.md` are what the feature's units touch.
There is no verification kit and no code, so a plan can only name checks its units add.
Serves the plan skill's existing-repo acceptance cases as input for the builder check, the story map and revision-bound design citations.
The [registry](../fixtures.json) owns the ordered commit paths, messages and dates.
`node sanity.mjs <built-folder>` requires Node 24 or later and Git and checks the documents and clean history.
