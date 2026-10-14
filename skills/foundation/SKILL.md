---
name: foundation
description: Turn an approved new idea into the smallest working project by choosing the stack, scaffold, setup commands and first user journey, then create it only after the owner approves the exact files and commands.
disable-model-invocation: true
---

## Scope

Only the user starts foundation.
Start this procedure only when the user's message explicitly invokes `$foundation`, `/foundation`, `/skill:foundation` or selects it through the host's skills menu.
A plain request such as "scaffold this project" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the idea workspace before proceeding: an existing directory that holds the new idea, passed as `--workspace`.
This skill is for new projects only, so an existing repo gets `/repo-audit` and the skills it lists instead.

Foundation turns the approved idea into stack, scaffold, setup commands and a first user journey, creates a Git project at a destination inside the idea workspace, and runs the declared setup and journey commands there.
It takes the approved `VISION.md` as a required input, and the confirmed glossary and the design when the user ran `/glossary` and `/architecture`.
It interviews for data, interfaces, deployment and the first journey itself.
It never adopts a non-empty directory or changes global Git configuration, and it does not build product features beyond the first journey.
Vision, domain terms, boundaries, the verification kit, the maintenance contract and the root instruction file belong to `/vision`, `/glossary`, `/architecture`, `/verification`, `/maintenance` and `/agents-md`, and a conflict with one is reported with its source.
Return the result to the project's chosen workflow instead of starting another skill or opening a pull request.
Keep proposals, interview notes, the scratch scaffold and transcripts in scratch outside the idea workspace.
Only `project create` writes the destination, after the user approves the exact files and commands.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Foundation checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Read the approved inputs
- [ ] Step 2: Interview for the technical gaps
- [ ] Step 3: Propose the foundation
- [ ] Step 4: Verify the proposal in scratch
- [ ] Step 5: Review and create
- [ ] Step 6: Prove the rules and report

### Step 1: Read the approved inputs

Read the idea workspace's `VISION.md`, and its glossary and design when they exist.
Without an approved `VISION.md`, stop and list `/vision` as the prerequisite, because the creation plan requires it and an unapproved draft is not an input.
Without a glossary, record that the plan carries none and list `/glossary` as optional; without a design, list `/architecture` the same way.
Select an absent destination under an existing parent inside the workspace, or explicitly select an empty directory with `allowEmpty` true.
A destination that holds any file is not adopted: report it and ask for another.

Done when: The vision, any glossary and design, and the destination are named with their paths, or the missing prerequisite is reported and the procedure stops.

### Step 2: Interview for the technical gaps

Summarise what the vision and the user already established, and ask only about gaps in data, interfaces, deployment, reliability and access constraints, compatible behaviour and the first journey.
Load the interview guide, and the grilling guide when an unresolved choice would change the stack.
Resolve parent decisions before dependent questions, give a recommendation and its trade-off with each, and group only independent questions into a small round.
An unresolved choice blocks the stack, scaffold or journey that depends on it.

Done when: The technical context is agreed or named as gaps, the user has confirmed the summary, and every dependent decision is resolved or explicitly blocked.

### Step 3: Propose the foundation

Load the [foundation reference](references/foundation.md) and propose the stack with its alternatives, the minimal scaffold, the setup commands, the native checks and the first journey with its acceptance check.
Tie each choice to a requirement from the vision or the confirmed context, and keep out speculative frameworks, services, integrations and empty document templates.
Retain the proposal in scratch as findings following `schemas/findings.schema.json` with stage `foundation`, the destination as a workspace target with revision null, and `journey` and `foundation-review` in `requiredOutcomes`.
Prepare a create-only change set following `schemas/change-set.schema.json` that holds the vision, any glossary and design, the `README.md` and the scaffold, each with its complete UTF-8 payload and hash.
Declare each selected command path with its edit's `checkIntegration` according to the [checks reference](references/checks.md#integrate-the-maintained-command).
Propose one pointer line as a separate selected edit in the same change set, following the [pointer guide](references/agents-pointer.md): `Run the setup and check commands in README.md before reporting a change complete.` with the file name as the link.
Prepare `schemas/project-create.json` in scratch, binding the creation plan to the change set digest and the approved destination, stack, first journey, setup commands and prerequisites.

Done when: Every proposed file and command supports an approved outcome, has a bounded scope and a verification method, and every decision affecting the proposal is resolved or marked blocked.

### Step 4: Verify the proposal in scratch

Run `node scripts/foundation.mjs project create --workspace <idea-workspace> --plan <file> --dry-run --json` to build the scaffold in scratch.
Run the declared setup and journey commands in the returned scratch scaffold before presenting anything, with approval for any that download or write outside scratch, and repair failures in the proposed bytes.
After repairs, refresh the payloads, hashes and plan digests, and repeat the dry run and the commands on those final bytes.
An unrun or failing journey keeps the proposal unverified.

Done when: The final bytes have captured scratch setup and journey results, or explicit verification limits, and no destination file exists yet.

### Step 5: Review and create

Present the complete diff, the declared commands with their potential effects and the captured results.
Only after the user approves those exact bytes and commands, run the unchanged plan without `--dry-run`.
Creation uses the protected-write engine, and journals directory creation, files, Git initialisation and command results outside the project.
Repeat the unchanged plan to resume an interrupted directory, file or Git creation, and inspect retained journals before resolving a continuation conflict.
Preserve unrelated files and user edits.

Done when: Only the approved scaffold exists at the reviewed destination in a new Git repo, with recoverable journals, or creation remains blocked with its reason.

### Step 6: Prove the rules and report

Read the returned creation record for the captured setup and first-journey results.
A failed or interrupted command leaves the project unverified and available for recovery, and an attempted command is never rerun automatically.
Run the maintained command and capture fresh evidence on the created project, following the [checks reference](references/checks.md#capture-the-outcome).
Prove each selected native rule with `rule-proof`, and add later selected changes to the created project through `apply --repo <destination>` with the same review rules.
State the destination, the stack and its alternatives, the first journey and its evidence, the proved rules, the written paths, the unresolved decisions and every verification limit.
List `/verification create`, `/maintenance` and `/agents-md` as next steps for the user to run, and `/architecture` when no design was supplied, and start none of them.

Done when: Every required outcome has fresh evidence on the final inputs, or completion explicitly remains unverified with each missing prerequisite named.

## Review before create

Keep proposals, transcripts, the scratch scaffold and previews in scratch until the user approves.
Present the exact bytes of each file and the exact declared commands, and record the approval with the plan digest it covered.
A scope or intent change needs a decision, not a silent widening of the plan.
Machine configuration changes, which include the native check configuration and the maintained command, need approval for each change.

## Write rules

Plan, validate, then execute.
Only `project create` writes the destination, and `apply` writes later selected changes to it, each validating the reviewed scope, target paths, exact-byte hashes and plan digest before any change.
Reject traversal, a changed plan, an unrelated path in the destination and an unselected edit before any write.
Do not bypass missing tooling with direct writes.
Use the installed `scripts/foundation.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Interviewing for data, interfaces, deployment and the first journey | `references/interview.md` |
| An unresolved decision would change the stack | `references/grilling.md` |
| Proposing the stack, scaffold, journey and native checks | `references/foundation.md` |
| Proving a rule, integrating the maintained command or capturing the outcome | `references/checks.md` |
| Adding the foundation's `AGENTS.md` pointer | `references/agents-pointer.md` |
| Recording the proposal and writing the scaffold | `schemas/findings.schema.json`, `schemas/change-set.schema.json`, `schemas/project-create.json` |
| Proving a rule or capturing checks | `schemas/check-plan.json` |
