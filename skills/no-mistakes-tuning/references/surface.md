# no-mistakes configuration surface

This reference lists the keys that shape review speed and focus, where each is read from, and what no-mistakes cannot be configured to do.
It was checked against the documentation and source of no-mistakes v1.84.0 and v1.106.1, which agree on every key below.
For an installed version older than v1.84.0, confirm each key in that version's `docs/src/content/docs/reference/repo-config.md` at its release tag in the no-mistakes source repository, and drop any key it does not document.

## Repo keys this skill edits

| Key | Read from | Effect |
|---|---|---|
| `auto_fix.review` | Pushed branch | Automatic fix rounds the review step may run before it parks for a decision. `0`, the built-in default, parks on every blocking finding. Each round is a fixer turn plus a fresh, full rereview of the diff |
| `auto_fix.test`, `auto_fix.lint`, `auto_fix.ci`, `auto_fix.rebase` | Pushed branch | The same cap for those steps. Built-in default `3` each. `auto_fix.document` is not used by the automatic document pass |
| `ignore_patterns` | Pushed branch | Paths removed from the review and document steps. When every changed file matches, review approves with no agent call and the document step logs "no changes to document" and does nothing |
| `review.path_instructions` | Default branch only | Prompt text added to review for changes that touch a matching path. At most 32 entries and 16,384 bytes in total. It augments the built-in review instructions and cannot disable them |

Repo values overlay the global `auto_fix` values field by field.
A pushed branch cannot add, change or remove `review.path_instructions`; a new value acts only after it is merged to the default branch.
Matching for both path keys ignores nothing: `review.path_instructions` are selected against every changed file, including ignored ones.

### Path syntax

Both path keys use one matcher:

| Pattern | Matches |
|---|---|
| `*.md` | No slash: that basename at any depth |
| `docs/**` | Ends with `/**`: that folder and everything under it |
| `.github/workflows/ci.yml` | Contains a slash: a full-path glob |
| `**/*.go` | Also a full-path glob, so `*` never crosses `/` and this matches only one folder level |

Use `*.go` for every Go file and `internal/**` for a subtree.

## Keys other skills own

| Key | Owner |
|---|---|
| `commands.test`, `commands.lint`, `commands.format`, `commands.prepare`, `test.*`, `gates` | `/verification` |
| `document.instructions` and the docs gate | `/maintenance` |
| `agent`, `allow_repo_commands`, `disable_project_settings`, `no_ci`, `protected_paths`, `ci.*`, `rebase.*`, `pr.*`, `commit.*`, `intent.*`, `providers.*` | The user; this skill reports them and never changes them |

`review.conversation: true` lets the reviewer park to ask a question instead of filing a finding.
It trades latency, tens of minutes or more per question, for precision, so leave it off unless the history shows many findings that only the author's intent could settle.

## Global-only keys

These live in `~/.no-mistakes/config.yaml`, affect every repo on the machine, and are reported as recommendations only.

| Key | Effect |
|---|---|
| `review_agents.reviewer`, `review_agents.fixer` | Agent, model and effort for review and review fixes |
| `review_agents.reviewer_after_round`, `review_agents.fixer_after_round` | A different agent, model or effort from a given round on, for example a cheaper fixer after round 1. They never change how many rounds run |
| `review_agent_timeout` | Wall-clock limit per review agent turn |
| `session_reuse` | Whether review fixers resume one session across rounds |

## Per-run controls

| Control | Effect |
|---|---|
| `no-mistakes axi run --skip review,test` | Skips the named steps for that run |
| `git push -o no-mistakes.skip=review,test no-mistakes <branch>` | The same for a plain push |

Valid step names are `intent`, `rebase`, `review`, `test`, `document`, `lint`, `push`, `pr` and `ci`; repository gates cannot be skipped this way.

## What no-mistakes cannot be configured to do

- There is no severity threshold and no switch per finding category: review always reports `error`, `warning` and `info`, and every `error` or `warning` blocks.
  Steer what gets reported through `review.path_instructions` instead.
- There is no limit on how many review rounds a run takes when a person keeps choosing fix; `auto_fix.review` bounds only the automatic rounds.
- No setting skips the whole run by path.
  `ignore_patterns` removes agent review and documentation work, but configured test and lint commands, push, PR and CI still run.
- A path instruction cannot remove the built-in review rules.
  Those rules already limit findings to sequences that occur in the change's intended use, forbid promoting optional improvements into blockers, and run a simplification pass that reports components the change does not need as `ask-user` warnings.
