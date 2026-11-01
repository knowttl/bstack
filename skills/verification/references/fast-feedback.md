# Fast feedback

Use this reference to measure where a project's feedback time goes, to propose the layers, commands and settings that shorten it, and to split a slow suite into sections.
Every command here is a stack's own public tool and runs on any host for any user; nothing depends on bstack, a hosted runner or a particular machine.
Everything here is a selected change that goes through the exact-diff review and apply boundary; measuring is read-only.

## Contents

- [When to apply](#when-to-apply)
- [The four layers](#the-four-layers)
- [Measure first](#measure-first)
- [Agent loop contract](#agent-loop-contract)
- [Workers and shared hosts](#workers-and-shared-hosts)
- [Reusing setup safely](#reusing-setup-safely)
- [Timeouts](#timeouts)
- [Tool choice](#tool-choice)
- [Splitting the suite into sections](#splitting-the-suite-into-sections)
- [Sources](#sources)

## When to apply

Skip the speed work when the suite is already fast for the project's size: a change that saves seconds on a suite that runs in seconds is not worth a diff.
The layers, their recorded times and the [timeouts](#timeouts) always apply, because they cost little and a hung test costs a whole run.
Judge "fast for the project's size" against the project's own history and the cheap wins the [measurements](#measure-first) show, not against a fixed number; projects differ too much for one target.

## The four layers

Each layer has one command and one recorded time, measured on the project rather than estimated.

| Layer | Question it answers | Typical command |
|---|---|---|
| Pre-push check | Is this change well-formed? | The maintained check command: format, lint and type check, ideally on changed files only |
| Iterate | Did my last edits break the tests they touch? | The stack's [affected command](#agent-loop-contract) |
| Full suite once | Is the whole offline suite green before the change leaves the machine? | The full offline test command plus the maintained check, once before the gate and again after any dependency change |
| Slow tier | Does the selector still agree with the full suite, and do slow journeys still pass? | A scheduled full run, nightly or per release batch, plus any live or end-to-end tier |

Aim for each layer to be as fast as practical for the project; there is no fixed target.
A slowdown against the project's own recorded history, or a large cheap win found by the measurements, triggers maintenance work.
A layer's time is recorded and compared, never asserted: a time on its own is not a check that fails.

## Measure first

Do not propose a speed change before measuring.
Time these separately, because the fix for each differs:

- **Wait**: time spent before any test starts because the host is busy, a queue is full or a lock is held.
  Wait is out of scope for this reference when it comes from shared infrastructure; report it and leave scheduling to the host's owner.
- **Setup**: dependency install, build, compile, fixture and container startup.
- **Run**: the tests themselves.

Measure each of them warm (caches primed by an immediately preceding run) and cold (caches cleared by the stack's own clean command or a fresh clone), because a fix that helps only a cold run does nothing for the daily loop.
List the slowest tests with the runner's own report: `vitest run --reporter=verbose`, `pytest --durations=20`, `cargo nextest run` with its per-test timings, `go test -v` with its per-test times.
Repeat the measurement at least three times and keep the spread; a single run on a shared host is noise.
Count how many times the full suite ran per change; a suite that runs three or four times per change costs that much more than its single-run time suggests.
Label a saving observed when it was measured and estimated when it was inferred, and rank proposals by saving.

## Agent loop contract

Name two commands for the project, an affected command and a full command, and put one pointer line for them in the project's `AGENTS.md`:

> Iterate with the affected command; run the full suite and the maintained check once before the gate and after any dependency change.

The check belongs in that line because a gate that runs lint after tests would otherwise find a type error only after a full test run.

Affected commands by stack:

| Stack | Affected command | Note |
|---|---|---|
| Node/TypeScript with Vitest | `vitest run --since-last-run` | Compares each loaded file with the time of that test's last run, so it still selects tests right after a commit; `vitest run --changed` compares with a Git reference and is empty right after a commit. The first run is a full run, and `vitest run --clearCache` resets the record. |
| Python with pytest | `pytest --testmon` | Selects by recorded dependencies; the first run is a full run. |
| Go | `go test ./path/to/package/...` for the changed packages | Go caches successful package results, so unchanged packages replay instantly. |
| Rust | `cargo nextest run -p <crate>` for the changed crates | Use a `-E` filter expression to narrow further. |

The affected command is for iteration only.
A selected run never replaces the full run before the gate, and a project whose gate selects tests by change follows the change-scoped Test command section of the no-mistakes wiring reference for the proof the selector needs.

## Workers and shared hosts

Use the cores the host gives you, through the tool's own worker setting, so the host owner can cap it without editing the project.
Default to physical cores rather than logical threads, and expose the setting as an environment variable or a flag the host can override.
When several agents or lanes share one host, the cap keeps one suite from starving the rest; a fixed worker count written into the config does not.

| Stack | Setting |
|---|---|
| Vitest | `VITEST_MAX_WORKERS` or `--maxWorkers` |
| pytest with pytest-xdist | `-n auto`, capped by `PYTEST_XDIST_AUTO_NUM_WORKERS` |
| Go | `go test -p <packages>` for packages in parallel, `-parallel <tests>` within a package |
| Rust with nextest | `--test-threads <n>` or `test-threads` in the nextest config |

The check command stays a sequential fail-fast `&&` chain; parallelism lives inside each tool, not in background jobs or pipelines in the chain.
Measure before and after: more workers than the host has cores, or than the tests can use without contention for a database or port, make a suite slower.

## Reusing setup safely

Expensive setup repeated per test file, such as a browser, a database, a compiled binary or a large fixture, can often be paid once per worker.
Reuse it only when the tests prove they clean up after themselves; shared state that leaks between tests produces failures that depend on order.

Proof of cleanup:

1. Run the suite with the setup shared and again in a different order or with random ordering where the runner offers it.
2. Run each test file alone and compare its result with its result inside the whole suite.
3. Keep a leak found by either run as a failing case until the test cleans up.

| Stack | Reuse |
|---|---|
| Vitest | `isolate: false` (or `--no-isolate`) shares the environment and module state per worker; `vitest doctor` measures alternative configurations on the real suite instead of estimating them. |
| pytest | Session- or module-scoped fixtures. |
| Go | `TestMain` for package-level setup. |
| Rust with nextest | Keep nextest's process-per-test model, which isolates tests by design; move expensive setup into a cached build artifact instead. |

Cache deterministic work, such as a build keyed by its source inputs, in the stack's own cache.
Cache only results that cannot depend on the state of the machine.

## Timeouts

Every test gets a per-test timeout and the whole suite gets a ceiling, so a hang fails loudly instead of holding a run until someone notices.
Size the per-test timeout from the slowest legitimate test in the [measurements](#measure-first), and set the suite ceiling to about twice the suite's recent measured time.
Revisit both when the measured time moves; a ceiling that never fails is too loose, and one that fails on a healthy run is too tight.

| Stack | Per-test timeout |
|---|---|
| Vitest | `testTimeout` |
| pytest | `pytest-timeout`: `--timeout <seconds>` or `timeout` in the config |
| Go | `go test -timeout <duration>`, which applies to the whole package run, so also guard individual tests with a context deadline |
| Rust with nextest | `slow-timeout` with `terminate-after` |

The suite ceiling is the project's test command wrapped in the platform's own timeout mechanism; a timeout is a failure, not a retry.

## Tool choice

Prefer the fastest maintained tool that gives the same answers.
Swap an existing tool only with an equivalence proof and a measured saving:

1. Seed the same violations in a disposable copy: a type error, a lint violation and a formatting error for each rule the project enforces.
2. Run the old and the new tool through their public commands and show that both flag the same seeded violations and both pass the clean control.
3. Record the measured time of each, warm and cold, and propose the swap only when the saving is worth the diff.

A tool still in beta stays a candidate; do not swap it into the check command until it is stable.
Check that no script imports an API the faster tool does not ship; for example TypeScript 7 provides no compiler API, so a script that imports the `typescript` package needs a compatible TypeScript version installed beside it.

| Check | Faster maintained candidates |
|---|---|
| Type check, Node/TypeScript | TypeScript 7 (`tsgo`) |
| Lint, Node/TypeScript | Oxlint |
| Lint and format, Python | Astral's Rust-based linter and formatter; its type checker `ty` is a candidate while it is in beta |
| Lint, Go | golangci-lint with its cache |
| Test runner, Rust | cargo nextest |

## Splitting the suite into sections

A suite split into named sections lets the iterate layer run one section instead of the whole suite.
Split along boundaries that already exist, not new ones: the module declarations in the project's design document, and then the stack's own units.
Keep one command that runs every section; the full suite is the sections together, never a different list.

| Stack | Section mechanism |
|---|---|
| Vitest | `test.projects` in the config, run with `vitest run --project <name>` |
| pytest | Directories (`pytest tests/<section>`) or markers (`pytest -m <marker>`, with markers registered in the config) |
| Go | Packages (`go test ./<section>/...`) |
| Rust | Crates (`cargo nextest run -p <crate>`) or nextest filter expressions (`-E 'package(<crate>)'`) |

Name each section after the module it covers, and map each module's source paths to its section so the change-scoped selector in the no-mistakes wiring reference and the iterate layer use one map.
Put slow, live or end-to-end tests in their own section so the daily loop skips them and the [slow tier](#the-four-layers) runs them.
After a split, run the sections together against the old full suite and confirm they report the same tests; a test that belongs to no section is silently lost.

## Sources

- Vitest, [improving performance](https://vitest.dev/guide/improving-performance) and [affected tests](https://main.vitest.dev/guide/recipes/affected-tests).
- [pytest-testmon](https://www.testmon.org/), [pytest-xdist distribution](https://pytest-xdist.readthedocs.io/en/stable/distribution.html) and [pytest-timeout](https://github.com/pytest-dev/pytest-timeout).
- Go, [the `go` command](https://pkg.go.dev/cmd/go) for test caching, `-p`, `-parallel` and `-timeout`.
- cargo-nextest: [benchmarks](https://nexte.st/docs/benchmarks/), [why process-per-test](https://nexte.st/docs/design/why-process-per-test/) and [slow tests](https://nexte.st/docs/features/slow-tests/).
- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Oxlint](https://oxc.rs/docs/guide/usage/linter), [Astral Python tools](https://docs.astral.sh/) and [ty](https://docs.astral.sh/ty/).
- Martin Fowler, [Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html).
- Meta, [Predictive Test Selection](https://arxiv.org/abs/1810.05286).
