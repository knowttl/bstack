# no-mistakes wiring

Use this reference to propose the no-mistakes configuration that makes the verification kit count in a pipeline run, and to offer setup in a repo that has none.
no-mistakes is optional: no step of this skill depends on it, and the kit works without it.
Everything here is a selected change that goes through the exact-diff review and apply boundary.

## Contents

- [What the wiring does](#what-the-wiring-does)
- [Propose the configuration](#propose-the-configuration)
- [Change-scoped Test command](#change-scoped-test-command)
- [Offer setup where there is none](#offer-setup-where-there-is-none)
- [The coverage gate](#the-coverage-gate)
- [What is verified and what is inference](#what-is-verified-and-what-is-inference)

## What the wiring does

| Pipeline step | Responsibility under this wiring |
|---|---|
| Review | Judge the diff and its tests against the testing criteria, including whether a changed feature file still says what the code does; never drives the product |
| Test | Run the targeted offline test command, then drive the changed scenarios live through the kit named in `test.instructions` |
| Document | Update the feature file of a changed user-facing feature, because `document.instructions` names the feature map as the owner of how a user reaches each feature |
| Gate after Document | Fail when a change touches a feature's source paths without updating its feature file or recording a no-impact reason; the gate decides coverage only and never judges design |
| Lint | Run the maintained check command through `commands.lint` |

The implementing agent drives the kit while building and updates the changed feature's entry itself.
no-mistakes then repeats that proof with a fresh agent on the same kit, so the proof is independent of the author.
The full `maintain` pass stays a user-started pass, because Test only covers the change.
no-mistakes gates are shell commands; a dedicated agent review round for the map is not possible.

## Propose the configuration

Read the existing `.no-mistakes.yaml` first.
Extend it: keep every key, instruction and gate that is already there, and add only what is missing.
Propose the edit as a whole-file replacement or a create, with the exact diff, because the mechanical edit operations do not cover YAML.

For an app named `shop` whose default branch is `main`, the additions are:

```yaml
commands:
  lint: "npm run check"
  test: "npm test"

gates:
  - name: feature-map-coverage
    after: document
    command: "node .agents/skills/verify-shop/scripts/map-coverage.mjs --base origin/main"

test:
  instructions: |
    Use the verification kit in .agents/skills/verify-shop/ (start at its SKILL.md).
    Run its doctor first, launch with its Launch section, and drive each scenario
    through the matching feature file. Save evidence where the kit says.

review:
  path_instructions:
    - path: "**"
      instructions: |
        Apply the project's testing guidance: the four-question gate, public-interface tests,
        exact assertions, the wasteful-test patterns and the test-quality rules with their exemptions.

document:
  instructions: |
    .agents/skills/verify-shop/features/ owns how a user reaches each feature. When a
    user-facing feature changes, update its feature file or say why not.
```

Adapt it to the repo:

- Use the project's own maintained check command for `commands.lint` and its offline default test command for `commands.test`; Test runs the configured test command as written, so set it only to a command that is targeted or quick, and otherwise leave it for the user to decide.
- Replace `origin/main` with `origin/` plus the repo's default branch; the gate compares against it.
- Point `review.path_instructions` at the project's existing testing document, linking rather than copying, and merge with any entries already present.
- Add the gate only when the kit was rendered with `coverageGate` set in its plan.

## Change-scoped Test command

When full validation is slow, propose a changed-area selector for `commands.test` using the module declarations in the project's existing design document.
Reuse an existing selector and runner before adding a script; keep one path-to-module map and one full offline validation command.
This is a selected configuration change, not permission to narrow the suite silently.
The selector runs locally in the no-mistakes Test step and needs no hosted CI.

1. Resolve the merge base of `HEAD` and `origin/<default-branch>`.
   Include committed, staged, unstaged, deleted and untracked paths, retaining both sides of renames.
2. Map every changed path to the architecture's declared source paths and collect touched modules plus their reverse dependents.
   Include affected test and fixture paths; unresolved dependency edges do not prove independence.
3. Run the affected modules' build, lint and test commands through the maintained runner, propagating any failure.
   Keep required repository-wide checks in `commands.lint`; scoped validation does not silently weaken them.
4. When a protocol module changes, include every declared dependent's tests, following reverse dependencies transitively.
   A shared schema, message, API or fixture contract change can affect callers without touching their source paths.
5. Fall back to full offline validation on any unmapped path, empty diff, unresolvable base, incomplete dependency map, or selector, dependency, build or test-infrastructure change.
   Failure of the selected command is a failure, not a reason to retry a smaller set.

Print the resolved base, changed paths, selected modules and commands, and the reason for any full fallback.
Keep enough evidence to distinguish a successful selected run from a full run and a selection error.
The full fallback is an explicit exception to the targeted-command preference; it must run the complete baseline rather than report a false success.

For a large cohesive module, research the stack's native related-test tooling before recommending within-module selection.
Confirm its handling of imports, dynamic loading, shared fixtures and configuration changes for this project; do not assume file proximity establishes coverage.
Keep the full module suite when the related-test tool cannot establish the affected set.
Selection saves time only when it keeps detecting real failures, so measure it rather than promising savings from source inspection.

Prove the selector through its public command in disposable fixtures with a clean control and independent seeded changes: a module bug, a protocol change affecting a dependent, and each full-fallback condition.
Show that each selected set includes the test that fails for the seeded bug, and that a selected failure reaches the command's exit status.
Use the project's existing fixtures and runner; do not add source-string tests that merely recognize the selector's implementation.
Record the selection, failure and fallback evidence beside the selected configuration.
During `/verification maintain`, compare selected validation with a full offline run to detect misses, or use a scheduled local full run only when the owner selects it.
Each miss needs a mapping or dependency fix and a regression case through the selector's real interface.
Keep the fallback until the corrected selection is proven, and tune the map as protocols and modules evolve.

An existing project's worked example pairs a Python script named test-selection.py in its scripts directory with a validation-runner.md contract in its architecture documentation.
Its selector owns the path-to-segment map, follows reverse static imports with a documented depth limit, maps shared fixture contracts to dependent suites, and uses full validation for unknown paths or uncertain scope.
Its frontend uses native related-test selection, and periodic full local runs expose misses for mapping fixes.
These are observed design choices from that example, not a portable dependency-depth guarantee or a requirement to use its tools.
The source is private; this anonymized example supplies the pattern, and project-specific research and seeded proof remain required.

## Offer setup where there is none

When the repo has no `.no-mistakes.yaml` and no initialized gate, offer setup as a selected step and let the user decline it.
Propose the file above as a create.
Tell the user to run `no-mistakes init` themselves; it registers a git remote and a local service, so this skill never runs it and never touches the shared no-mistakes service.
Do not generate hosted CI workflows, including through `no-mistakes ci-workflow`, unless the user asks for them.
The configuration takes effect only after it merges to the default branch, so the first branch that carries it is not checked by it.

## The coverage gate

Render the gate with the kit by setting `coverageGate` to `true` in the kit plan; `kit scaffold` writes it into the kit's `scripts` folder and `kit check` keeps it identical to the source.
It is one dependency-free file that needs only Node and Git, runs without bstack, and contains no comments.

`node <kit>/scripts/map-coverage.mjs --base <ref>` finds the merge base of `<ref>` and `HEAD`, collects every file changed since it, committed or not, and reads each feature file's `Source paths:` line.
For each feature whose source paths match a changed file outside the kit, it requires one of:

- the feature file itself changed in the same range;
- a commit message in the range with a line `No-map-impact: <feature-id>: <reason>` and a non-empty reason, one line for each affected feature.

It exits 0 when every feature is covered, 1 with one line per uncovered feature naming the feature file and the first changed path, and 2 for an unusable base, kit or feature file.
A path matches a declared source path when it equals it, lies under it, or matches its `*`, `?` or `**` glob.

Limits to state when proposing it:

- It checks that the map was touched, not that it is right; any edit to the feature file satisfies it, so Review and Test judge the content.
- It cannot find a new user-facing feature that has no feature file yet; `maintain` and Review catch that.
- The trailer lives in commit messages because a gate cannot read a pull request description.
- A branch can edit the gate and the kit it is checked with, so Review must read changes under the kit directory; to remove that, point the gate's `command` at a copy outside the repo.

## What is verified and what is inference

Verified against the pinned no-mistakes documentation (commit 93b4407) and re-read on a later copy of the docs:

- Gates are shell commands run through the platform shell in the run worktree, pass on exit code 0, and may anchor after `rebase`, `review`, `test`, `document` or `lint`; agent gates are rejected.
- The worktree is checked out at the pushed head, so a gate script and the kit files it reads come from the branch under test, not from the default branch.
- Gates, `test.instructions`, `document.instructions` and `review.path_instructions` are honored only from the default branch's copy of the file.
- The Rebase step fetches `origin/<base branch>` into the worktree, so the gate's `--base` ref resolves there.
- Test runs the configured command and then an evidence agent that stands the product up; the evidence agent must not independently rerun the complete repository suite.
  The configured selector may run its full offline fallback when scope is uncertain.
- A failing gate parks the run for a decision instead of auto-fixing.

Verified by running: the gate script on a disposable fixture repo, for a covered change, an uncovered change, a recorded no-impact reason, an uncommitted change, a deleted source file and an unresolvable base.

Still inference, because verifying them needs a real pipeline run with a model session, which was not started:

- That the evidence agent reads the kit's feature files from the branch under test, as the gate does; the documentation says only that agents work in that worktree.
- That the Document step follows the ownership instructions and updates feature files.
- That the proposed `.no-mistakes.yaml` parses and runs end to end; the binary offers no check that avoids registering a repository.
- That the gate's plain exit code and output are enough for the parked-run decision; the pinned documentation also offers a structured findings file, which this gate does not use.
