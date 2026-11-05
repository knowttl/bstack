# Checks

Use this reference after creation to prove a selected native rule and to integrate the maintained command.
Checks catch defined mistakes, not every unsound future design decision.
A new project has no existing debt, so a rule that fails on the first run is fixed or dropped, never baselined.

## Contents

- [Prove a rule before adopting it](#prove-a-rule-before-adopting-it)
- [Maximum code file length](#maximum-code-file-length)
- [No-comments rule](#no-comments-rule)
- [Integrate the maintained command](#integrate-the-maintained-command)
- [Optional pre-push hook](#optional-pre-push-hook)
- [Capture the outcome](#capture-the-outcome)

## Prove a rule before adopting it

Require a representative valid case and a deliberate violation in disposable fixtures.
The valid case must pass, and the violation must fail with the expected diagnostic and exit code.
Include relevant syntax, aliases and re-exports in the proof, and record unsupported syntax and dynamic dependencies as coverage limits instead of assuming they pass.
After preparing native dependencies in the clean and the independently seeded fixtures, run `node scripts/foundation.mjs rule-proof --repo <destination> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json`.
The plan follows `schemas/check-plan.json`, and the selected check supplies the native child-command object.
The command runs separate disposable copies, records versions, exits and diagnostics in scratch, and removes the copies.
Unavailable native tools, interrupted execution and a failed clean setup are blocked, never proof.

## Maximum code file length

Include a lint rule limiting each code file to 1000 code lines, excluding blank lines and comments.
Use a maintained native linter rule when it can enforce that count, and verify that the chosen rule counts code lines equivalently.
If no native rule provides the equivalent count, include a small maintained project-owned check in the one check command that counts code lines using the language's comment syntax.
Explicitly exclude generated files, vendored code, lockfiles, fixtures, snapshots and migration dumps with globs suited to the project.
Include the rule in the check plan and prove it through `rule-proof`, both as a selected check and through the integrated command.
The valid fixture has 1000 code lines plus blank and comment lines and must pass; the violation has 1001 code lines and must fail with the length diagnostic.
Use representative comment syntax for the stack in the fixtures and record any unsupported syntax as a coverage limit.

## No-comments rule

Include a rule for all project-authored code, including tests, test fixtures and snapshots that are code, that rejects every comment except tool directives, license or SPDX headers, and a shebang on the first line.
Tool directives include lint and type suppressions and build directives, such as `# type: ignore`, `//go:build` and `# noqa`.
Rationale, warnings, documentation comments and linked explanations are violations.
Exclude only vendored third-party code, tool-generated output marked as generated, and non-code files such as lockfiles from this rule.

Use a maintained native linter rule only if it enforces this whole policy; a rule that detects only warning comments does not suffice.
Otherwise include a small project-owned check using the language's tokenizer or parser to identify comment tokens, so comment-like text in strings is not rejected.
Recognise only actual tool directives and license or SPDX headers, not arbitrary comments containing those words.
Include its files and dependencies in the proposed scaffold and wire it into the one maintained check command.

In the check plan select that command and prove it with `rule-proof`: a clean fixture passes, and a separate fixture with an ordinary comment fails with the rule's diagnostic.
Include directive, license or SPDX header, and shebang files in the valid fixture and verify they pass.
Repeat the proof with a plain comment as the sole violation in a project-authored code fixture, such as `tests/fixtures/example.py` in a Python project, and in a snapshot that is code when the project has one; each must fail with the rule's diagnostic.
Cover the project's code languages and test files, and record any unsupported syntax as a coverage limit rather than claiming it is checked.
Repeat this proof against the integrated maintained command as described below.

## Integrate the maintained command

Extend the project's one check command rather than creating a competing entry point.
The project owns each checker or pins its declared development dependency, so running the checks must not need an installed bstack skill or an agent session.
Select the maintained command in the check plan, for example executable `npm`, args `["run", "check"]`, cwd `.` and versionArgs `["--version"]`, and run the same `rule-proof` against separate disposable sources that hold the integrated command and one new seeded violation.
Capture both exits and the specific diagnostic, because a tool setup failure does not prove enforcement.

An edit that integrates selected checks declares optional `checkIntegration`, a nonempty list of unique command paths, each a nonempty array of string keys.
For `package.json`, mark each selected script with a path such as `[["scripts", "check"]]`.
For a selected `.yml` or `.yaml` CI edit, write JSON syntax, which is valid YAML, and mark the exact `run` or `script` paths, such as `[["jobs", "check", "steps", "0", "run"]]`.
The runtime supports only that JSON subset for marked CI edits and does not parse general YAML.
Every selected path must resolve to a string command in the complete proposed bytes, and `continue-on-error` and `allow_failure` on its ancestors must be literal `false` when present.
Selected commands use literal arguments in a fail-fast top-level `&&` chain, with unquoted words or whole double-quoted literals separated by spaces or tabs.
Keep this chain sequential; parallelism belongs inside each tool, using its worker setting so the execution environment can cap it.
Failure-masking operators (`||`, pipelines, separators, background execution and negation), shell dispatch, substitutions, redirection, backslashes, single quotes, `$`, backticks, `%` and `!` fail with `ignored-check-failure` before any write.
Run `node scripts/foundation.mjs apply --help` for the supported edit operations.
The same maintained command must pass the valid control and reject the seeded violation through `rule-proof`.
CI examples are unverified adapters until actual hosted execution is observed, and local disposable proof does not establish a merge gate.

## Optional pre-push hook

Offer this hook only when the project has no delivery gate.
When selected, include the hook files and installation command in the reviewed scaffold and setup commands.
Use a versioned project-local hook directory with `git config --local core.hooksPath .githooks`, or extend pre-commit or Lefthook when the project already uses it.
Preserve an existing hook configuration rather than replacing it.
The setup installs the hook for the current clone; document the same setup command for every contributor.
Use project-owned scripts and pinned development dependencies, without global wrappers, private paths, bstack or an agent session.

The hook calls the maintained formatting, linting and type-checking commands on files changed by the outgoing push, using the tools' supported file or dependency selection.
When a tool requires project-wide context, or changed-file selection cannot be established safely, run its full maintained check instead.
Run checks without modifying files and propagate every failure to reject the push.
Prove a clean push succeeds and a push containing a seeded violation fails in a disposable local repository.
Also prove the maintained command rejects that violation when invoked directly.
Hooks can be bypassed or absent in another clone, so they are never the only enforcement: keep the maintained check required by the project's delivery workflow, independently of the hook.

## Capture the outcome

Capture the maintained command, tool versions, output, exit code and relevant input state directly from execution.
Run `node scripts/foundation.mjs run-checks --repo <destination> --plan <file> --json` with a plan that follows `schemas/check-plan.json`, linking the first-journey acceptance case to the approved vision's bytes and declaring its input scopes.
Prefer the project's prepared environment and tools, such as a project-local environment or the lockfile's tool manager, over system defaults, and report the versions actually used.
Ask first before any check that writes outside scratch, costs money, sends a message or changes shared data, and report an unobservable outside dependency as unverified.
A failing, skipped, missing or stale required check cannot produce a passing completion claim.
