# Checks

Use this reference after creation to prove a selected native rule and to integrate the maintained command.
Checks catch defined mistakes, not every unsound future design decision.
A new project has no existing debt, so a rule that fails on the first run is fixed or dropped, never baselined.

## Contents

- [Prove a rule before adopting it](#prove-a-rule-before-adopting-it)
- [Integrate the maintained command](#integrate-the-maintained-command)
- [Capture the outcome](#capture-the-outcome)

## Prove a rule before adopting it

Require a representative valid case and a deliberate violation in disposable fixtures.
The valid case must pass, and the violation must fail with the expected diagnostic and exit code.
Include relevant syntax, aliases and re-exports in the proof, and record unsupported syntax and dynamic dependencies as coverage limits instead of assuming they pass.
After preparing native dependencies in the clean and the independently seeded fixtures, run `node scripts/foundation.mjs rule-proof --repo <destination> --check-plan <file> --check-id <id> --valid <clean-dir> --violation <seeded-dir> --expect <specific-diagnostic> --json`.
The plan follows `schemas/check-plan.json`, and the selected check supplies the native child-command object.
The command runs separate disposable copies, records versions, exits and diagnostics in scratch, and removes the copies.
Unavailable native tools, interrupted execution and a failed clean setup are blocked, never proof.

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
Failure-masking operators (`||`, pipelines, separators, background execution and negation), shell dispatch, substitutions, redirection, backslashes, single quotes, `$`, backticks, `%` and `!` fail with `ignored-check-failure` before any write.
Run `node scripts/foundation.mjs apply --help` for the supported edit operations.
The same maintained command must pass the valid control and reject the seeded violation through `rule-proof`.
CI examples are unverified adapters until actual hosted execution is observed, and local disposable proof does not establish a merge gate.

## Capture the outcome

Capture the maintained command, tool versions, output, exit code and relevant input state directly from execution.
Run `node scripts/foundation.mjs run-checks --repo <destination> --plan <file> --json` with a plan that follows `schemas/check-plan.json`, linking the first-journey acceptance case to the approved vision's bytes and declaring its input scopes.
Prefer the project's prepared environment and tools, such as a project-local environment or the lockfile's tool manager, over system defaults, and report the versions actually used.
Ask first before any check that writes outside scratch, costs money, sends a message or changes shared data, and report an unobservable outside dependency as unverified.
A failing, skipped, missing or stale required check cannot produce a passing completion claim.
