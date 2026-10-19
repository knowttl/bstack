---
name: maintenance
description: Register a project's documents, scopes and checks so they stay true as code changes, wire no-mistakes to check them on every change, and sweep the whole repo now and then for drift.
disable-model-invocation: true
---

## Scope

Only the user starts maintenance.
Start this procedure only when the user's message explicitly invokes `$maintenance`, `/maintenance`, `/skill:maintenance` or selects it through the host's skills menu.
A plain request such as "keep the docs up to date" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
Resolve the target and the mode, `create` or `sweep`, before proceeding.
Use `create` when the repo has no `.bstack/project.json` or the user wants its registration or wiring changed, and `sweep` when it has one; if the user's choice contradicts the repo, say so and ask.

Create registers the project's documents, the code scopes that govern them, the rules they state and the checks that prove them in `.bstack/project.json`.
It installs the dependency-free checker at `.bstack/bin/bstack-check.mjs` and wires no-mistakes with an ownership map for its Document step and a docs gate after it, so everyday upkeep needs nothing new from the user.
Sweep is the user-started, read-only check of every registered document, the verification kit, each `formal-*` formal verification suite and the `AGENTS.md` pointers against the whole repo.
It returns one list that names the mode that fixes each item and fixes nothing itself.
A request for a signed-off assessment of one change uses the [contract reference](references/maintenance-contract.md) directly, without either mode.

Neither mode edits product code, rewrites a document's content, resolves vocabulary or boundary questions, or opens pull requests.
Terms belong to `/glossary`, boundaries to `/architecture`, purpose to `/vision`, the kit to `/verification`, a formal verification suite to `/formal-verification` and the root pointer file to `/agents-md`; this skill only names them as the fix.
Return the result to the project's chosen workflow instead of starting another skill.
Keep drafts, previews and transcripts in scratch outside the target.
Only `apply` writes to the target, after the user approves the exact bytes.
Do not substitute direct project edits or an invented approval for unavailable tooling.

## Create checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Find the document sources
- [ ] Step 2: Draft the contract
- [ ] Step 3: Draft the wiring
- [ ] Step 4: Review and apply
- [ ] Step 5: Prove the wiring and report

### Step 1: Find the document sources

Read the project's own documents before asking anything: the vision, glossary or glossary map, design and architecture documents, README, contributor guidance, and any existing `.bstack/project.json` or `.no-mistakes.yaml`.
Run `node scripts/maintenance.mjs contract validate --repo <target> --json` when a contract exists, and keep the output in scratch.
Record which document owns terms, boundaries and purpose, and the code paths each one describes.
Ask one targeted question per unclear owner, naming the plausible readings and recommending one, and group only independent questions into a small round.
Load the [create guide](references/create.md) for the registration shape and the ownership convention.

Done when: Every document the project keeps is classified as owning terms, boundaries, purpose or something else, with the code paths it governs, and every unclear owner has an answer or is named as open.

### Step 2: Draft the contract

Draft the complete `.bstack/project.json` in scratch following `schemas/project.schema.json`, keeping every entry an existing contract already holds.
Register documents under the IDs the guide names, scopes that map code paths to the documents they govern, the rules whose literal text a check or reviewer can find, and the project's own maintained check commands.
Leave out documents the project does not keep, and never invent an owner to fill a gap.
Validate it in a scratch clone of the target with the draft placed at `.bstack/project.json`, running `contract validate` and `docs check` there with the same flags.

Done when: The draft is in scratch, every entry points at an existing source, and the validation results from the scratch clone are recorded.

### Step 3: Draft the wiring

Draft the `.no-mistakes.yaml` change as the complete file: the existing keys unchanged, plus the ownership map in `document.instructions` and a `docs` gate after the `document` step that runs the installed checker in docs-only mode.
Draft `.bstack/bin/bstack-check.mjs` as the exact bytes of this skill's `scripts/bstack-check.mjs`.
Draft one pointer line for the root `AGENTS.md` following the [pointer guide](references/agents-pointer.md): `Before finishing a change, review the documents it affects against the contract in .bstack/project.json.` with the contract path as the link.
Load the [create guide](references/create.md) for the map wording and the gate command.
State that the wiring takes effect only after it reaches the default branch, because no-mistakes honours it only from there.

Done when: The three drafts are in scratch, the ownership map names only documents the contract registers, and the gate command matches the installed checker's documented usage.

### Step 4: Review and apply

Record one finding in scratch following `schemas/findings.schema.json` with stage `audit`, the target and the paths below as its reviewed scope, and a change set following `schemas/change-set.schema.json` with the exact approved UTF-8 bytes and their hashes.
The change set holds one edit each for `.bstack/project.json`, `.bstack/bin/bstack-check.mjs`, `.no-mistakes.yaml` and the `AGENTS.md` pointer, and the user may deselect any of them.
The pointer edit follows the pointer guide's table, which includes no edit when a root `CLAUDE.md` would hide a new `AGENTS.md`.
Include `starting-checks` in the findings' `requiredOutcomes`, as required by stage `audit`, with mode `repo` and the current revision.
Run `node scripts/maintenance.mjs apply --repo <target> --plan <file> --dry-run --json`, present the exact diff, then run the unchanged plan without `--dry-run` only after the user approves those bytes.
Use `state show` with the returned run ID to inspect an interrupted apply, and repeat the unchanged plan to resume.

Done when: Only the approved files have been written with unchanged hash preconditions and recoverable originals, or the write remains blocked with its reason.

### Step 5: Prove the wiring and report

Run `node .bstack/bin/bstack-check.mjs --repo <target> --docs-only --json` and confirm it passes on the written tree.
Prove the gate fails when it should: in a scratch clone of the target, break one local link in a registered document, run the same command there and confirm a nonzero exit, then discard the clone.
Run `docs generate --repo <target> --check --json` when the contract registers generators.
State the written paths, that the ownership map and gate act only once merged to the default branch, which documents each skill owns, and every step left blocked with its missing prerequisite.
Name `sweep` as the later pass that finds drift, and start no other skill.

Done when: The docs-only checker passes on the written tree and fails on the scratch clone with the broken link, or the report names why either was not run.

## Sweep checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 6: Run the sweep
- [ ] Step 7: Judge the drift the command cannot see
- [ ] Step 8: Report one list

### Step 6: Run the sweep

Run `node scripts/maintenance.mjs sweep --repo <target> --json` and keep the output in scratch.
It reads the registered documents, generated sections, verification kits, formal verification suites and `AGENTS.md` links and writes nothing.
Every problem it returns carries the skill mode in its `fix` field.
Its `data.coverageLimits` records unchecked scope, including skipped Markdown and unsupported fragments; these are never repair items and do not fail the command by themselves.
Load the [sweep guide](references/sweep.md) for what each problem code means and which mode owns it.

Done when: The command result is saved in scratch, and a missing or invalid contract is reported as the first item instead of being worked around.

### Step 7: Judge the drift the command cannot see

For every registered document, compare its claims with the whole current repo, including staged, unstaged and untracked content, as the guide describes.
Check glossary terms, design boundaries, README instructions and facts, vision purpose and user claims, and the claims of any other registered document.
History may order the work but never exclude a document or repository area; no history baseline is required.
Open every file the judgement rests on, and cite repo-relative `path:line` for each item.
Add an item only when the evidence supports it, name the mode that owns it, and leave the decision to that mode.
Report a document that cannot be judged as unchecked, with the reason.

Done when: Every registered document is judged drifted with citations, or judged current against the whole current repo, or listed as unchecked with a concrete reason and the unreviewed scope.

### Step 8: Report one list

Merge the command's problems and the judged items into one list, one line per item, each naming the file, what drifted and the mode that fixes it, such as `3 new terms - run /glossary maintain`.
Group items by mode in the order `/maintenance`, `/glossary maintain`, `/architecture maintain`, `/vision`, `/verification maintain` and `/agents-md`.
State what the sweep checked, what it could not, and that nothing was written.
Include unresolved coverage limits as unchecked scope in this account, without labelling them drift or assigning a repair mode.
Start none of the named modes.

Done when: The report is one list in which every item names its mode, with the checked scope and the limits, and the target is unchanged.

## Review before apply

Keep drafts, previews and transcripts in scratch until the user selects changes.
Present each edit's problem, consequence, fix, scope and verification, then the exact bytes.
Machine configuration changes, which include `.no-mistakes.yaml` and the installed checker, need approval for each change.
A scope change needs a decision, not a silent widening.
Record the approval with the exact content it covered.

## Write rules

Plan, validate, then execute.
Only `apply` writes to the target, and it validates the reviewed scope, target path, original and proposed exact-byte hashes and the plan digest before any change.
A record outside the approved edit plan, such as a change assessment, is proposed with its exact content and written only after its own exact approval.
Do not bypass missing apply tooling with direct writes.
Use the installed `scripts/maintenance.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.
Resume by inspecting current files instead of trusting old completion flags, and treat user changes as blocking the remaining writes.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Registering documents or drafting the no-mistakes wiring | `references/create.md` |
| Adding the maintenance `AGENTS.md` pointer | `references/agents-pointer.md` |
| Reading sweep problems or judging the drift the command cannot see | `references/sweep.md` |
| Recording a signed-off assessment of one change | `references/maintenance-contract.md` |
| Writing approved changes | `schemas/findings.schema.json`, `schemas/change-set.schema.json` |
| Preparing a contract or an assessment | `schemas/project.schema.json`, `schemas/evidence.schema.json`, `schemas/impact-assessment.json` |
