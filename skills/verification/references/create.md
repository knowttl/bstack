# Create a verification kit

Use this reference to interview a repo, write the kit plan and prove the generated kit.
The kit is written for the next agent, which reads it cold, mid-task, without having seen the product.

## Contents

- [Interview the repo](#interview-the-repo)
- [Write the kit plan](#write-the-kit-plan)
- [Feature files](#feature-files)
- [Helpers](#helpers)
- [What scaffold generates](#what-scaffold-generates)
- [Prove the kit](#prove-the-kit)
- [Host discovery](#host-discovery)

## Interview the repo

Answer each question from the codebase and ask the user only what the repo cannot show.

| Question | Where to look |
|---|---|
| Surface: what does a user touch? A web UI, a command line, a desktop app, an API, a library? | Entry points, README quickstart, routes, commands, menus |
| Run: how does the product start locally? | The repo's documented dev command, package scripts, Makefile, container files; note ports, environment, seed data and authentication |
| Drive: how can an agent interact with it programmatically? | Existing harnesses first, such as browser specs, expect scripts, terminal helpers, HTTP endpoints or a debug port; only then a generic recipe |
| Observe: what evidence can be captured? | Screenshots, terminal transcripts, response bodies, logs, exit codes, stored state |
| Isolate: can two instances run side by side? | Ports, data directories, profiles; if not, say so in the kit, because refusing to double-drive a shared instance beats corrupting the user's session |

If the checkout does not build or start as it is, report the blocker precisely.
A kit written against a broken base teaches wrong steps.
When an irrelevant missing asset blocks startup, such as a static directory the service never serves, the kit may create it as clearly marked verification scaffolding and remove it in cleanup.

## Write the kit plan

The plan follows `schemas/kit-plan.json` and is the single source for the generated files.
Every command is an argument array run without a shell, so quote nothing and expand nothing.
In any command, `{port}` is replaced by a free port, `{runDir}` by a disposable directory and `{evidenceDir}` by the evidence subdirectory for the run.

| Field | What it holds |
|---|---|
| `launch` | The command that reaches a usable state from an empty data directory, including migrations and seed data. Ready means usable, not merely that a process answers; declare exactly one of `ready.url` or `ready.output`. A short-lived command-line tool has no server: launch builds or installs once and each drive starts its own isolated session |
| `doctor` | One read-only command that answers whether this instance is worth driving: process up, right build, port owned by this run, authentication valid. Exit 0 means yes |
| `drive` | The harness name and the conventions that apply to every feature, such as preferring stable handles over coordinates |
| `evidence` | The directory outside the kit where proof lands, and the proof standards |
| `cleanup` | An optional command and notes. Cleanup removes what the run started, never the evidence |
| `helpers` | Scripts the kit ships, with the invocation shown |
| `features` | One entry per user-facing feature |

Evidence standards to state: exercise the real user path, not internal setters or test-only endpoints; capture the action and the resulting state, not only the final screen; verify side effects such as files written, rows inserted or messages sent; use mocks only where a production boundary already isolates the external system.
When the safe path is a dry run or test mode, observe what it actually skips instead of trusting its name.
Never kill by process name; stop what the run started.

## Feature files

Aim for the top three to five features to start, found from routes, commands, menus or docs.
Each feature declares:

- `sourcePaths`: the repo paths that implement it, as paths or `**` globs. Change-impact checks read this line, so keep it narrow and true.
- `subFeatures`: short IDs with one line each.
- `entryPoints`: every way a user reaches it.
- `preconditions` and `steps`: each step pairs one user action with an exact command, a human `expect` sentence and a machine `match` pattern tested against the command's stdout. Add `artifacts` the step must write inside `{evidenceDir}/`, avoiding the reserved `<feature id>.json` proof record.
- `gotchas`: traps that waste or invalidate a run.

Prefer stable handles, such as accessible names, data attributes, prompt strings and route paths, over coordinates and tab order.
If seed data lacks a precondition a journey needs, the journey reports a failure and the reason goes in that feature's gotchas.
Never weaken a step to make it pass.
The map is the maintained verification source: a proof that drives one convenient entry point is incomplete when the map lists others.
Keep implementation details out of the map; name user paths, handles, required state, commands and observable proof.

## Helpers

Every script the kit ships is documented with its invocation in the generated skill; a helper the reader must reverse-engineer is not a helper.
Helpers live inside the kit directory, so they are subject to the project's own lint, format and comment constraints.
Write them in the project's own language where it has one, so the kit needs no extra runtime.

## What scaffold generates

`kit scaffold` renders one change set, never overwriting an existing file:

| Path | Content |
|---|---|
| `.agents/skills/verify-<app>/SKILL.md` | Launch, Doctor, Drive, Evidence, Cleanup and Helpers sections rendered from the plan |
| `.agents/skills/verify-<app>/kit.json` | The plan, as the machine form that `kit prove` runs |
| `.agents/skills/verify-<app>/features/README.md` | The index, baseline preconditions, driving conventions and the feature entry contract |
| `.agents/skills/verify-<app>/features/<id>.md` | One file per feature with a title, summary, `Source paths:` line and four sections |
| `.agents/skills/verify-<app>/<helper path>` | Each helper |
| `.claude/skills/verify-<app>/SKILL.md` | A thin pointer to the kit |
| `AGENTS.md` | A one-line pointer, appended to an existing file or creating it |

Before applying, edit the plan and scaffold again to refresh the proposed files.
After applying, scaffold refuses existing kit files; propose repairs through a new hash-checked change set for `apply`, keeping `kit.json` and its rendered documents consistent.

## Prove the kit

`kit prove --app <app> --feature <id>` runs the applied kit once: launch, wait for readiness, doctor, every step of one feature, evidence capture, cleanup, and a check that the evidence is byte-identical afterwards.
One feature is enough; the map exists so later runs can cover the rest.
A failed attempt still stops the process it started, runs the cleanup command and keeps its evidence.
Failure codes name the stage: `launch-exited`, `launch-not-ready`, `doctor-failed`, `step-failed`, `step-mismatch`, `artifact-missing`, `cleanup-failed` and `evidence-lost`.
Fix harness failures through another reviewed change set.
A kit that was never executed is a draft.

If the proof ran in a stand-in for the real target, such as a container in place of a fresh machine or a local stack in place of a remote one, list every setup step the stand-in did that the target will not.
Those steps stay unverified until a run on the real target covers them.

## Host discovery

Claude Code documents project skills only under `.claude/skills/`, so the thin pointer is required for that host to find the kit; other hosts read `.agents/skills/` and the `AGENTS.md` line.
The documentation lists no `.agents/skills/` location, but discovery was not exercised in a live session, so treat it as documented behaviour rather than observed behaviour.
