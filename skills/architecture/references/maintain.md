# Maintain guide

Maintain keeps an existing design true as the project grows.
It reviews only what changed since the last confirmed architectural review, checks new modules against the design, proposes new boundaries and proves their rules.
It never moves code and never rewrites a decision record.

## The baseline

The design is the registered `design` document in `.bstack/project.json` when the project has a contract, otherwise the existing design or architecture document, or `DESIGN.md`.
The baseline is the commit of the last confirmed architectural review.
Design or decision-record edits alone do not establish that a review happened.
The user may name another baseline, such as a release tag, and then it replaces the review commit.
When the evidence does not establish a baseline, including a design with no committed history, ask the user for one and wait before collecting changes or reporting clean.
Record the baseline, the current revision and the working-tree state, and preserve uncommitted user work.

## What to collect

Collect the union of paths changed between the baseline and the current revision, staged changes, unstaged changes and untracked files, using `git diff --name-status -z <baseline> HEAD`, `git diff --cached --name-status -z`, `git diff --name-status -z` and `git ls-files --others --exclude-standard -z`, preserving paths from the NUL-delimited output.
Rerun `measure --repo <target> --range <baseline>..HEAD --json` for revision-bound change frequency, co-change pairs and the supporting commits, with `--exclusions` for generated paths and broad formatting commits.
`measure` reads committed history only, so read the working-tree changes directly and name them as outside the measurement.
Rerun `overlap` on two declared plans: the user's next planned changes when they name them, otherwise the two areas with the strongest co-change signal.
New modules are paths added since the baseline that form a unit with its own responsibility and interface, such as a new package, directory with an entry point or public entry.
Every candidate cites repo-relative `path:line` with state kind `sha256` and the SHA-256 of the exact working-tree file bytes read, so `cite-check` can establish freshness.

## The four classes

Give each candidate exactly one class.

| Class | Evidence needed | Proposed edit |
|---|---|---|
| Undescribed module | A module added since the baseline that the design does not name, with its responsibility and public contract read from the code | A design section naming its responsibility, owned knowledge, public contract and dependency direction |
| Broken boundary | An import or dependency in changed code that the design's allowed direction forbids, or a cycle across intended boundaries, found with the project's native analysis, or a workaround repeated at unrelated call sites, or a rise in type escape hatches at one module's callers since the baseline, each cited at its sites | A reviewed fix finding, an exception with reason and removal condition, or a boundary the user confirms should change |
| Shared edit target | A file or registry that the measured history or the overlap result shows unrelated changes repeatedly edit, with the supporting commits, or hand-maintained parallel lists with no derivation or disagreement check, or more than one supported way to do one task, read from the code and naming the files one change would edit | A narrower boundary or one writer, only after inspecting why the files change together |
| Decision to record | A change that is hard to reverse, surprising without context and the result of a real trade-off, with no decision record yet | A decision record, following the decisions guide |

Size, import counts and change frequency indicate where to look and never establish a violation by themselves.
Ask the user which reading is intended whenever the evidence supports two, and never choose a boundary from the code alone.
A new boundary rule is proposed only with its native check, proved as the boundary checks reference describes, and its existing violations go into a visible baseline.
A conflict with a recorded decision is surfaced with its source and the reason to reconsider it.
A conflict with the vision or a glossary meaning goes to `/vision` or `/glossary`, not here.

## Outcomes

Report exactly one outcome.

- Clean: a baseline from the last confirmed architectural review or explicitly supplied by the user is established, and the complete inventory has no committed changes since it and no staged, unstaged or untracked changes in code, or every changed module inventoried from that established baseline is described and within the design's boundaries. Name the baseline and the files read.
- Changed: the user selected edits, `apply` wrote them from a reviewed change set, and every proposed rule has its proof.
- Blocked: a prerequisite is missing, such as a baseline, an answer the edit depends on, an unavailable native tool or a working tree that changed under the plan. Name it and its fix.

Moves, renames and rewrites of code that the design implies are listed with their locations and left for the user to select as separate changes.
Edits to the vision, the glossary and the other skills' documents are out of scope and are named as next steps for the user to run.
