---
name: repo-audit
description: Audit an existing repo or explore a new idea and recommend project-specific principles, rules and checks.
disable-model-invocation: true
---

## Scope

Only the user starts repo-audit.
Establish a project-specific foundation for a new idea or audit an existing repo, then apply only the changes the user selects.
An empty repo can be a new idea, and an established repo can need only a scoped reassessment.
Resolve the target, requested area and stated next change before proceeding.
Resolve unclear scope before any write, and keep dependent work blocked while a consequential decision is open.
Record technical uncertainty without inventing a product goal.

Unrelated product work, automatic routing, general development playbooks and delivery orchestration are outside this skill.
Return findings and evidence to the project's chosen workflow instead of starting another skill, opening a pull request or selecting a delivery service.
Security hardening of created skills and licensing review are outside scope.

This is a procedure under construction.
The intent and vision steps, research briefs and citation check, their references and board build, launch and verdict commands are available.
Steps 7 and 11 describe the available read-only audit and findings commands.
The apply command previews reviewed plans with `--plan <file> --dry-run`, then writes or resumes them without `--dry-run`, preserving originals and a journal in scratch.
Check-plan execution capture is available through the shared verification rules below.
The enforcement and architecture references are available for recommendations.
The existing-repo audit and selected apply path are available.
Protected new-project creation is available through Step 5.
The maintenance-contract reference remains a placeholder.
The shared-library contract-test command is available but does not implement an audit or approve writes.
Use the checklist to track independent read-only work and report the missing prerequisite at a blocked step.
Do not substitute direct project edits or an invented board approval for unavailable tooling.

## New-idea path checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Confirm intent
- [ ] Step 2: Resolve project terms
- [ ] Step 3: Review the vision
- [ ] Step 4: Propose the foundation
- [ ] Step 5: Review and apply selected changes
- [ ] Step 6: Verify the outcome

### Step 1: Confirm intent

Begin with the intent interview before recommending implementation, even when a brief already supplies goals and a stack.
Summarise what the user already explained and ask only about gaps, rather than reopening approved choices.
Establish the problem, intended users, success outcome, first useful journey, non-goals, data, interfaces, deployment environment, reliability and access constraints, compatible behaviour and consequential trade-offs.
Resolve parent decisions before dependent questions.
Give a recommendation and its trade-off with each decision question, group only independent questions into a small round, then wait for answers.
Use available facts instead of asking the user to look them up.
Finish with the agreed goal, boundaries, decisions and remaining uncertainties.
New or changed intent needs user confirmation before dependent implementation.
An unresolved choice such as offline access blocks a dependent stack recommendation.
Load the intent interview from the table below for this step.

Done when: The intent interview has established the required facts or named the gaps, the user has confirmed new or changed intent, and every dependent decision is resolved or explicitly blocked.

### Step 2: Resolve project terms

Clarify conflicting or unclear terms alongside the interview, without a separate mandatory interview.
Use the project's vocabulary source, otherwise propose GLOSSARY.md only when useful terms are resolved.
Keep canonical domain concepts and their distinctions in the glossary.
Keep storage choices, frameworks and other implementation details in the design instead of treating them as domain terms.
Naming migrations are separate selected changes.
Load domain-language guidance from the table below when terms are unclear or conflict.

Done when: Each term needed for the first journey has a resolved meaning or a named unresolved decision, and the proposed vocabulary contains no implementation details or empty template entries.

### Step 3: Review the vision

Draft a contribution acceptance policy from confirmed author intent, without claiming evidence from nonexistent history.
Include purpose and users, the responsibility the project owns, commitments, boundaries, non-goals and criteria for accepting or resisting future changes.
Keep the vision separate from a backlog or implementation plan.
Stress-test the important fault lines with concrete proposals, adapting their number to real unresolved trade-offs.
Keep the draft, board and interview transcript outside the project in scratch.
Collect verdicts against the current draft, revise it and obtain explicit user approval of the resulting vision.
Approval of a brief's goals or stack does not approve the generated VISION.md.
Silence and interrupted sessions do not count as approval.
Write the approved reasoning so the eventual VISION.md stands on its own.
Load the adapted vision procedure for this step and build the board through the documented command interface.
For a new idea, use the existing non-Git directory as --workspace and keep all drafts, vocabulary, transcripts and verdicts outside it in scratch.
Run vision-board build with --draft and --proposals, then vision-board launch with the returned --board path and the same target.
Use --json to read the runtime output and returned listener command, then run that pinned listener in the terminal to receive board feedback.
The host needs a browser that can reach the printed review URL.
Save the complete-round Context data JSON from the terminal feedback unchanged, including its run ID, draft revision and every card verdict.
Interpret the author's reasoning into a new semantic draft with an edit-to-verdict explanation.
Run vision-board verdicts with --board, --input pointing to that complete-round JSON and --draft pointing to the revised draft.
The command validates the bindings, saves the revised draft and decisions in new scratch and preserves the original draft.
Read the saved revision back, present it for explicit approval, and retain that approval with its exact revision in the scratch transcript.
For another board round, use the saved draft and matching new proposals, retaining the previous review.json decisions as evidence.
If launch, browser access, feedback or author approval is unavailable, preserve scratch for resume and keep the step blocked with the missing prerequisite and fix.
At this intent checkpoint, stop after the approved scratch vision, resolved vocabulary and confirmed summary.
Name protected creation in Step 5 as the later prerequisite without creating Git or project files.

Done when: The current draft has been stress-tested through the board, its verdicts are resolved and the user has explicitly approved that revision, otherwise this step remains blocked.

### Step 4: Propose the foundation

Use the approved vision to propose the smallest sound foundation.
Tie stack choices and meaningful alternatives to requirements, keeping the target's language independent of this skill's Node helpers.
Cover system boundaries, module responsibilities, data flow, the first working journey and its acceptance check, needed errors, configuration and external interfaces, resolved terms and necessary review standards.
Give each principle a reason, source, scope, enforcement method and exception policy.
Prefer native checks and one source of truth over duplicated prose or a second verification engine.
Distinguish automated rules from judgement rules.
Include setup, formatting, lint, applicable type checks and tests.
CI is an explicitly selected integration, and hosted behaviour that has not run remains unverified.
Avoid speculative frameworks, service layers, integrations and empty document templates.
The enforcement and architecture references are available for recommendations.
Obtain the owner's selection of the destination inside the existing idea workspace, stack, minimal scaffold and first journey before creation.
Retain foundation findings in scratch using schemas/findings.schema.json with stage foundation and the planned destination as a workspace target.
Native rule-proof, debt baseline checks and maintained local enforcement integration through apply are available; portable maintenance remains Phase 3a work.
Declare selected command paths with each apply edit's `checkIntegration` according to the [enforcement reference](references/enforcement.md#integrate-the-maintained-command).

Done when: Every proposed foundation change supports an approved outcome, has a bounded scope and verification method, and every decision affecting the proposal is resolved or marked blocked.

### Step 5: Review and apply selected changes

Present the exact changes and findings for selection using the shared review and write rules below.
Prepare a create-only change set following schemas/change-set.schema.json, including the approved VISION.md, confirmed glossary when useful and selected foundation with complete UTF-8 payloads and hashes.
Use the resolved planned destination as the change set and findings target, with mode workspace and revision null.
Prepare schemas/project-create.json in scratch, binding the creation plan to the change set digest and approved destination, stack, first journey, setup commands and prerequisites.
Select an absent destination under an existing parent, or explicitly select an empty directory with allowEmpty true.
Run project create --workspace <idea-workspace> --plan <file> --dry-run --json to build the scaffold in scratch and present the complete exact diff and declared commands.
Only after approval of those exact bytes and commands, run the unchanged plan without --dry-run.
Creation uses the same protected-write engine as apply and journals directory creation, files, Git initialisation and command results outside the project.
Repeat the unchanged creation plan to resume interrupted directory, file or Git creation.
Preserve unrelated files and user edits, inspecting retained journals before resolving any continuation conflict.
Make the first user journey work end to end where practical, without expanding into unrelated product work.
Never adopt an existing nonempty directory or change global Git config.

Done when: Only selected, reviewed changes have been applied with recoverable originals and current hash preconditions, otherwise writes remain blocked.

### Step 6: Verify the outcome

Follow the shared verification rules and report selected changes, actual evidence, unresolved findings and limitations.
Read the returned creation record for the captured setup and native first-journey results.
Failed or interrupted setup and journey commands leave the created project unverified and available for recovery.
Setup and journey commands already attempted are never rerun automatically, avoiding duplicate setup effects.
Verify affected commands explicitly and retain fresh evidence before claiming readiness.
Prove selected native rules using the enforcement reference's rule-proof command and preserve the scratch evidence.
Prove selected maintained integration as described in the enforcement reference before claiming it is verified for the created project.
Portable maintenance remains pending later work.

Done when: Every required outcome and check has fresh evidence on the final inputs, or completion explicitly remains unverified with each missing prerequisite named.

## Existing-repo path checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 7: Audit the starting state
- [ ] Step 8: Resolve material gaps
- [ ] Step 9: Present evidenced findings
- [ ] Step 10: Review and apply selected findings
- [ ] Step 11: Verify and report readiness

### Step 7: Audit the starting state

Audit before interviewing.
Resolve the selected repo and read its instructions and indexes.
First run `node scripts/repo-audit.mjs inspect --repo <target> --json`, then `node scripts/repo-audit.mjs inventory --repo <target> --json`.
Keep both outputs in scratch before researching discovered documents and implementation.
Inventory the existing README, vision, requirements, goals, design, architecture, decisions, principles, vocabulary, standards, prior audits, debt and planned changes using their actual names and layout.
Inspect relevant manifests, native configs, CI, entry points, module responsibilities, interfaces, data flow, code and tests.
Record the revision and working-tree state and preserve uncommitted user work.
Identify approved principles and their existing enforcement.
Run safe native checks when prerequisites permit, recording commands and results directly.
Get approval before checks that affect external systems or shared data.
Record unavailable checks and inaccessible history as limitations, rather than inventing evidence.
Use the shared research rules below for read-heavy work.
Read the discovered sources before treating them as authoritative.
Preserve distinct nested guidance and local or outside-repo instructions.
Instruction consolidation candidates require content review, a current host loading check and author approval before protected edits.
Load the research briefs, run the relevant briefs, open each cited source and run `cite-check --repo <target> --report <file> --json` before relying on the report.
Summarise documented intent, observed behaviour and inferred intent with checked citations and actual starting-check results before any question.
Run `node scripts/repo-audit.mjs measure --repo <target> --range <base>..<head> --json` for revision-bound sizes, change frequency and co-change signals with supporting commits.
Measurement covers eligible files present at the endpoint and follows detected lineage back through renames to addition.
Merged deletion and unrelated path reuse can attribute old-lifetime commits and co-change pairs to the replacement; treat signals as advisory evidence, never violations.
Use `--exclusions <file>` following `schemas/measure-exclusions.json` for project-generated paths and explicitly identified broad formatting commits.
Compare two declared plans with `node scripts/repo-audit.mjs overlap --repo <target> --plans <file> <file> --json`, following `schemas/overlap-plan.json`.
Plan paths use forward slashes, case-sensitive `*` and `?` within segments and whole-segment `**` for recursive matching, including planned new files.
Signals do not establish violations, observed conflicts or semantic independence.
Import and dependency analysis remains the native language tool's job.
Manual observations do not establish that those helpers ran.

Done when: Every relevant evidence source is inventoried or listed as unavailable, the starting state and native check results are recorded, and the audit distinguishes documented intent, observed behaviour and inferred intent with file citations.

### Step 8: Resolve material gaps

Summarise the evidence and clarify only missing facts or contradictions that would change a recommendation.
For each question, name the affected recommendation and why the available sources do not settle it.
Use a targeted decision round, resolving parents first and waiting for answers.
When the repo already answers the questions, proceed directly to recommendations without asking the user to repeat or reconfirm approved goals.
Load interview, domain-language or vision guidance only for a corresponding gap.
Keep the existing vision and design as the baseline.
A new vision or reviewed delta needs a material gap or requested direction change, with the same draft approval boundary as Step 3.
For a delta, retain the approved baseline in scratch and show each proposed line edit, its gap evidence and the commitments it preserves.
Review the real fault lines through the vision board, trace revisions to current author verdicts and obtain approval of that exact revision before selected apply.
If there is no corresponding gap, do not open the vision, intent interview or domain-language references.
Targeted interview, language, vision and board review procedures are available from the table below.

Done when: Every material gap is resolved or explicitly blocks its dependent recommendation, settled decisions are retained, and no unnecessary interview or vision review has been opened.

### Step 9: Present evidenced findings

Judge the foundation against its approved principles and respect its stack and conventions unless evidence supports a specific change.
Separate observed debt, missing protections, unresolved design decisions and proposed new principles.
For each material finding record an ID, observed problem, evidence files or failing command, principle, consequence, proposed fix, scope, verification method and whether it blocks the stated next change or can wait.
Keep proposed principles separate for review instead of treating them as existing requirements.
Avoid speculative findings, cosmetic rewrites and universal architecture prescriptions.
Use native baselines where available, keeping known failures visible and preventing new failures from entering through a refreshed baseline.
Exceptions need a reason, scope and removal condition.
Create findings following `schemas/findings.schema.json` in scratch.
Run `findings validate --repo <target> --findings <file> --json`, then `findings render --repo <target> --findings <file> --json` before review.
Missing execution evidence can leave the preview verification blocked without preventing review of its proposals.
The enforcement and architecture references are available for recommendations.
Use the enforcement reference's rule-proof and debt baseline commands for selected rules and accepted temporary debt.
Use selected apply edits to extend the existing maintained check command, preserving failures and package scope as described in the enforcement reference.

Done when: Every recommendation has a project-specific reason, evidence, principle, consequence, scope and verification method, with unresolved decisions and unsupported measurements visible.

### Step 10: Review and apply selected findings

Use the shared review and write rules, preserving existing runtime behaviour and uncommitted user work.
Reuse authoritative documents and native configs instead of duplicating vision, vocabulary, design or standards.
AGENTS.md holds pointers and check commands, not full copies of those sources.
Apply only selected findings.
Retain the user's selection and exact reviewed scope in scratch, then update the findings selections and prepare a change set following `schemas/change-set.schema.json`.
Include original and proposed exact-byte hashes, resolved scope, findings digest and plan digest.
Run `apply --repo <target> --plan <file> --dry-run` and present its complete diff before applying the unchanged approved plan without `--dry-run`.
A selected root instruction merge retains equivalent repo-owned CLAUDE.md content in AGENTS.md and removes CLAUDE.md with a selected `delete` edit in that same plan.
Report scoped, local and ancestor instructions as inventory classified them and never modify them in this path.
Retain the current host loading check and compatibility limits with the instruction proposal.
Use `state show --repo <target> --run <run-id> --json` to inspect actual states after interruption, then resume the unchanged plan and rerun affected checks.

Done when: Only the user's selected findings have been applied to the reviewed target and scope, with unchanged hash preconditions and recoverable originals, otherwise writes remain blocked.

### Step 11: Verify and report readiness

After selected apply, run the approved native check plan through `run-checks --repo <target> --plan <file> --json` using the shared verification rules.
Preserve the existing native user journey, including before/after protection for structural changes and matching live probes for outside dependencies.
Refresh findings against the current target fingerprint and bind each outcome to actual captured artifacts and their hashes.
Do not substitute a check-plan fingerprint for the findings fingerprint or claim that a manually attached artifact was validated by findings.
Render the updated audit record, review its exact bytes and apply it as a separate selected `create` or `replace-file` edit.
Use the existing audit record, otherwise docs/repo-audit.md, and retain findings and selections in scratch.
The audit record is an assessed-state report, not a source for vision or principles.
Its write changes target state, so refresh affected evidence and validate the final state before reporting readiness.
State the assessed revision or working-tree state, selected changes, actual commands and outcomes, preserved behaviour, remaining debt, decisions and limitations.
Distinguish ready for the stated next change, decisions needed and verification blocked.
A guessed debt score does not establish readiness.
Validate the versioned findings with `findings validate --findings <file> --json` and render the proposed audit record using `findings render --findings <file>`, with the same explicit target.
Render returns a scratch path and distinguishes documented, observed and inferred sources, selected changes and proposed new principles.
Audit readiness requires current starting-check evidence, and foundation readiness requires current journey and foundation-review evidence, plus every additional required outcome.
Capture evidence against the returned fingerprint and preserve its exact output artifact.
Capture approved checks through the shared verification rules below.
Selected maintained enforcement through apply is available from T3.4; portable maintenance evidence and document validation remain Phase 3a work.

Done when: Every required check is fresh and passed, every changed path is mapped or listed as unmapped, and the readiness verdict names all unresolved findings and verification limits instead of masking them with passing unit tests.

## Review before apply

Keep proposals, transcripts, reports and previews in scratch outside the target repo or new-idea workspace until the user selects changes.
Present each finding's problem, consequence, fix, scope and verification, then the exact file changes for review.
Record the selected finding IDs and user-approved scope.
Review ambiguous or consequential acceptance cases before dependent work and reuse already approved cases.
A scope or intent change requires a decision, rather than silently widening the plan.
Machine configuration changes require approval for each change.

## Verification rules

Requirements and expected outcomes come from identified authoritative sources, not solely from the implementation or its author's tests.
Validate important user flows directly against approved acceptance cases.
Use meaningful interface tests for relevant behaviour, edges and failures, and independent review under the project's risk policy.
Supply the reviewer with original requirements, cases, actual changes and execution evidence.
Choose the execution method within project constraints, without dispatching a TDD workflow or imposing a universal sequence.

For a Git repo, capture an approved plan through `run-checks --repo <target> --plan <file> --json`.
Use `schemas/check-plan.json` as the plan format, linking acceptance cases to approved source bytes and declaring relevant input scopes.
Capture bug reproduction or refactor protection with `--phase before` before applying changes, then reuse the plan with `--prior-run <before-run-id>` afterward.
Preserve the returned scratch artifact, coverage and execution order.
For each outside dependency, use `probe record --repo <target> --name <dependency> --phase before|after --spec <file> --json -- <executable> [args...]` with the same call before and after the change.
The descriptor follows `schemas/probe-spec.json` and declares the endpoint, relevant environment keys, side effects, assumption and input scopes.
The command must assert the agreed outcome and fail on disagreement.
Use `probe compare --repo <target> --name <dependency> --before <run-id> --after <run-id> --json` to verify the pair against current inputs.
Every side-effecting call requires explicit approval through `--approved-by-user` before the command delimiter.
Retain both scratch records and the comparison alongside check evidence.

| Change | Required evidence |
|---|---|
| Feature | Agreed outcome and successful important flows on the real product |
| Bug fix | Reproduction close to the user's experience, proof it now succeeds and surrounding behaviour checks |
| Refactor | Protective coverage before structural edits and compatibility evidence after them |
| Document or config | Authoritative source, intended effect and relevant structural or behaviour checks |
| Outside dependency | Small recorded live probe before the change and the same probe after it |

For behaviour outside the codebase, documentation, memory, mocks and recorded fixtures do not replace observation.
Use a read-only call, sandbox or dry run for the live probe.
Ask first before any call that writes, costs money, sends a message or changes shared data.
If the probe cannot run, name the reason and assumption and mark the change unverified.

Capture commands, tool versions, exit codes, output and relevant input state directly from execution.
Link evidence to the original acceptance source and the outcomes actually covered.
Invalidate affected results when inputs change.
Run each check, fix within the approved scope and rerun until it passes, or report the blocker.
Failing, skipped, missing or stale required checks cannot produce a passing completion claim.
Changing acceptance cases to fit a failure requires an explicit decision.
Ask whether the tests could pass while the user's actual problem remains unsolved.
If so, obtain stronger outcome evidence, keeping unavailable flows unverified.

## Write rules

Plan, validate, then execute.
Only apply makes project edits, including AGENTS.md, after the user approves each change.
Do not bypass missing apply tooling with direct writes.
Use the installed scripts/repo-audit.mjs entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for available syntax, never guess arguments for planned commands.

Before any edit, apply must validate selected finding IDs, reviewed scope, target paths, resolved links, original and proposed exact-byte hashes and the plan digest.
Reject traversal, wrong targets, changed files and unselected edits before any project change.
Validation-only runs leave project files unchanged.
Write validated content atomically where supported and preserve recoverable originals and resume state.
Resume by inspecting current files and rerunning affected checks instead of trusting old completion flags.
Repeated runs update maintained content without duplicating rules or erasing user edits.
For unsupported mechanical edits, propose a reviewed patch, validate it through apply and run the same final checks.
Use `replace-file` with complete reviewed UTF-8 content for unsupported mechanical edits, or `create` for an absent audit record.
Repeat the unchanged plan to resume, and use `state show --run <returned-run-id>` with the explicit target to inspect actual file states and affected checks.
User changes block remaining writes, and replacement is atomic per file where supported, never across the whole set.

Preserve distinct scoped instructions.
Propose consolidating equivalent repo-owned CLAUDE.md content, including an import stub, into the corresponding AGENTS.md only through reviewed protected edits.
Report local variants and ancestor instructions outside the repo as possible shadowing, without modifying them.
Before proposing removal, check the current host's official loading documentation and available runtime, and state compatibility limits for sessions that read only CLAUDE.md.
Do not flatten distinct nested guidance into root instructions.

## Research rules

When the host offers subagents, delegate read-heavy document inventory, code and architecture evidence, toolchain inventory and outside research to general-purpose read-only subagents.
Keep interviews, decisions, recommendations, approvals, live probes and writes in the main thread.
Each brief states the question, scoped paths, report format and word limit.
Run independent briefs in parallel, except when only a few files make a hand-off wasteful.
Subagents do not edit, ask the user questions or run checks with side effects.
Reports return concise findings with file path and line, or source links marked verified or unverified, and deterministic measurement output where relevant.
Open each cited path before relying on a report, treating it as evidence to check rather than verified fact.
Require repo-relative path:line citations bound to the read revision or exact file hash, and web URLs with read dates and verification status.
Run cite-check with --report against the selected --repo or --workspace before a finding uses the report, and refresh stale citations.
The checker establishes locations and byte freshness, while the main thread checks that sources support the claims.
Measurements come from scripts, not subagent guesses.
Keep bulk copying and large encoded strings out of delegation.
If subagents are unavailable or fail, run the same briefs sequentially in the main thread, retaining only the formatted report instead of quoted files.
Record which mode ran.
Load the research briefs for these questions and retain their common report format, actual host capabilities, limitations and mode.
Research repo configs first, then official language and tool docs, then established community guides for remaining gaps.
Without web access, mark language and outside recommendations "not researched" with the reason, using repo evidence and general principles alone.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Every reference is linked directly here, without another skill or nested reference chain.
Run scripts without loading their source, and pass assets to scripts without reading them as instructions.
The intent interview, grilling, domain-language, vision, research briefs, enforcement and architecture references are available.
Only the maintenance-contract reference remains a placeholder until its owning task supplies the procedure.

| When | Open |
|---|---|
| A new idea with no repo | `references/intent-interview.md` |
| An unresolved decision would change a recommendation | `references/grilling.md` |
| Project terms are unclear or conflict | `references/domain-language.md` |
| No `VISION.md`, or the audit found a vision gap | `references/vision.md` |
| Recommending principles and their checks | `references/enforcement.md` |
| Recommending module boundaries | `references/architecture.md` |
| Running research in the main thread or delegating it | `references/research-briefs.md` |
| Recording change evidence | `references/maintenance-contract.md` |
