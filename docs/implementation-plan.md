# bstack: repo-audit implementation plan

This plan tells a build agent how to build the first release of bstack, the `repo-audit` skill, in order.
The design is [design.md](design.md), revision 26.
Implementation review applied on 2026-10-07, with owner approval to apply the recommendations.
Commissioning review applied on 2026-10-07, with the owner's approval of its six recommendations.
The design records them under "Commissioning decisions (2026-10-07)".
This file specifies build work, with completed tasks tracked under "Progress" and evidence recorded under "Task evidence contract".

This plan was migrated on 2026-10-07 from `projects/bstack/implementation-plan.md` in the owner's private repo `knowttl/brytton`, at commit `28191a1def2c6c89b6a60d95f00056aaacfea669`.
This copy is now authoritative, and readers need no access to that source.

The design owns the requirements: what to build and why.
This plan owns the build sequence and evidence: how to build it, in what order, and how each task proves it is done.
When this plan and the design disagree about a requirement, the design wins.
Stop and ask the owner.

## Start here

Read this section before your first task.

### What you are building

`repo-audit` is one skill that only the user can start.
It audits an existing repo, or interviews the user about a new idea.
It then recommends project-specific principles, rules and checks, and applies the ones the user selects.
Everything it needs ships inside one folder, `skills/repo-audit/`.
The bstack repo also holds a package check, an installer, test fixtures, an evaluation runner and the no-mistakes gate config.
It has no hosted CI workflows (design "Commissioning decisions (2026-10-07)").

### How to work through this plan

1. Find the first unticked task whose prerequisites are complete.
   Use its "Depends on" field and the slice order in "Commissioning slices", not task numbering alone.
2. Read only the design sections that task lists under "Read".
   Do not read the whole design up front.
3. Do the steps in order.
4. Run its verification commands and every "Done when" check.
   Record results using the task evidence contract below.
   A missing prerequisite or unavailable live check leaves the task blocked.
5. Tick the task in "Progress", and commit with a conventional message, for example `feat(scripts): add inspect command (T2.2)`.
   Ship each slice through the no-mistakes pipeline, as "Delivery gate" describes.
6. Move to the next ready task.
   Do not use a later task's unbuilt component to pass an earlier task.

Keep task IDs stable because acceptance evidence refers to them.
If a task needs several sessions, add numbered subtasks and record the resume point before continuing.
Do not mark a partially implemented path as complete.

### Task evidence contract

Each task names prerequisites, inputs and outputs, and verification commands.
Its steps define the interface and failure behaviour, with the shared contracts below as defaults.
Read only the task and the shared contract it needs.

- Record the task ID, source revision, commands, exit codes, result paths and limitations in `tests/eval/results/tasks/<task-id>.json`.
- Include the tested operating system, Node version and relevant target tool versions.
- Store command output as an artifact beside the record, rather than recreating it from memory.
- Link each covered acceptance case to a named automated test or a completed agent or manual procedure.
- Record unavailable verification as blocked, with a reason and the next prerequisite.
- On resume, inspect the current files and rerun checks affected by changes since the saved evidence.

In a Git checkout with available evidence metadata, `npm test` captures its full-suite output and test identities in `.cache/full-suite.json`, recording whether its source inputs are committed.
When capture metadata is unavailable, ordinary `npm test` still executes the full suite; explicit capture remains strict.
The [gate configuration](../.no-mistakes.yaml) owns the explicit capture command; ordinary and explicit capture execute the same full suite.
After the final source, test and documentation fixes, Document attaches that run with `node scripts/task-evidence.mjs .cache/full-suite.json <task-id>` before publication.
The generator reads the saved run rather than executing another suite or starting another pipeline.
Its validation binding records the tested head, resolved base, command, environment, selected suite paths, test identities, counts, timing, output hashes and complete authored input inventory.
An evidence-only descendant can reuse the tested head when the generator confirms ancestry and identical inputs, base and environment at the final head.
The record cannot contain its own commit hash; publication identifies the final head, and the input binding proves that head has the tested contents.
Capture includes every authored task artifact.
Explicit capture requires committed inputs; ordinary tests can capture dirty inputs, but that evidence cannot be attached.
Attachment excludes only its own `<task-id>.json`, `<task-id>.full-tests.txt` and `<task-id>.events.jsonl` files from both inventories and the commitment check.
Every other task artifact remains an input, including evidence consumed by acceptance tests.
TAP and stderr stream to the terminal and the capture file while the suite runs.
Changes to behaviour, tests or other inputs require a fresh full-suite capture within the existing pipeline before attachment.
Preserve task-specific commands, acceptance cases and limitations; the full-suite record does not replace them.

The [task evidence schema](../tests/eval/task-evidence.schema.json), introduced in T0.1, owns this record's versioned format.
Later tasks reuse that format rather than adding separate completion logs.
No build task is complete merely because `npm test` exits zero with no relevant tests.
The final release validator checks actual case evidence, not only task ticks.

### Stop and ask the owner

Stop and ask before you do any of these:

- Push outside the no-mistakes pipeline, create a tag or publish a release.
- Change a design decision in the decisions table at the end of the design.
- Resolve a contradiction between this plan and the design.
- Add a runtime dependency other than `lavish-axi`.

Record the answer in this plan or the design, then continue.

Licensing is out of scope.
Do not check upstream licences or raise licence questions (design R24).

### Conventions

- **Language.** bstack's own scripts are JavaScript ES modules (`.mjs`) on Node 24 or later (design D3).
- **Dependencies.** Installed skill scripts use Node built-in modules only.
The one runtime dependency is `lavish-axi` for the VISION board.
Repository development tools may use the root development dependencies declared in `package.json`.
Tests use `node:test` and `node:assert`.
- **Paths.** Use `node:path` and `node:url`.
Never build a path by joining strings with `/`.
Every script must work on Windows, macOS and Linux.
- **Child processes.** Use `execFile` or `spawn` with an argument array.
Never build a shell string from project data.
- **Writing.** No em dashes or en dashes in any file.
No semicolons in prose.
Canadian spelling.
One term for each concept, matching the design.
- **Constants.** Each top-level constant has a comment on the line above that gives its reason.
The [package check contract](command-contract.md#package-check) defines the implemented syntactic enforcement and its limits.
- **Tests.** Each script has tests in `tests/scripts/` that call it through its command interface, not its internal functions.

### Defaults this plan sets

The design leaves these choices to the implementation plan.
Change one only by editing this table with the reason.

| Topic | Default |
|---|---|
| Node version | Support Node 24 and later. Recorded local runs on Node 24 and Node 26, with no hosted matrix. The [official release schedule](https://nodejs.org/en/about/previous-releases), checked 2026-10-07 in T0.6, lists Node 24 and 22 as LTS and Node 26 as Current |
| Script command | One entry point, `node skills/repo-audit/scripts/repo-audit.mjs <command>`. Target options follow the [arguments and targets contract](command-contract.md#arguments-and-targets) |
| Result format | One JSON envelope on stdout with `--json`, a short summary otherwise. Envelope in T0.4 |
| Exit codes | 0 passed, 1 failed, 2 blocked, 3 usage error |
| Scratch and resume state | Outside the target repo or new-idea workspace, in the OS cache folder: `%LOCALAPPDATA%\bstack\` on Windows, `~/Library/Caches/bstack/` on macOS, `$XDG_CACHE_HOME/bstack/` or `~/.cache/bstack/` on Linux. One subfolder per target, keyed by a hash of its real path, and one per run |
| Audit record | The project's existing audit record, otherwise `docs/repo-audit.md` (design "Files the skill maintains") |
| Project contract | `.bstack/project.json`, versioned schema, only when the project has no existing config that can hold it |
| Debt baseline | The native tool's own baseline or suppression feature where one exists. Otherwise `.bstack/baseline.json` |
| Change evidence record | Scratch for local review. A project whose selected delivery path needs portable review evidence commits `.bstack/evidence/<change-id>.json`, or an equivalent existing path, and passes that path explicitly to the checker |
| Checker in a clean checkout | `apply` copies one dependency-free validator into the target repo as `.bstack/bin/bstack-check.mjs`, with the bstack version in its header. Each run, local or in a CI the project selects, passes an explicit repo, base and assessment path to it |
| Fixtures | Built by a script into a temporary folder, with a scripted Git history. No nested Git repos are committed |
| Upstream sources | Raw copies at their pinned commits in `upstream/`, outside the skill folder. Adaptations live in `skills/repo-audit/` and are recorded in `NOTICE` |
| Step format in `SKILL.md` | Each step is a `### Step N: <name>` heading followed by a line that starts `Done when:` |
| Skill install folders | Claude Code: `~/.claude/skills/` and `.claude/skills/`. Codex and Pi: `~/.agents/skills/` and `.agents/skills/` |

### Shared command and input contracts

The [command contract](command-contract.md) owns the implemented shared contracts, starting with C4a.
The contracts below define the pending work for later slices.
Each command's owning task adds its exact options, schema, valid input and invalid input before implementing it.
Examples and schemas are tested through the public command.
Unsupported schema keywords and unknown input fields fail closed, with a named problem and fix.

**Target and workspace.**
See [arguments and targets](command-contract.md#arguments-and-targets) and [scratch](command-contract.md#scratch).

**Result envelope.**
See [results](command-contract.md#results).

**Child command.**
See [child commands](command-contract.md#child-commands) for the implemented execution contract and Windows launcher constraint.

Tests must cover paths with spaces, Unicode, metacharacters and arguments that must remain literal on all three operating systems.

**Hashes.**
Write preconditions use SHA-256 of exact file bytes, without line-ending normalisation.
Record both original and proposed hashes, including explicit absence for a new or removed file.
See [fingerprints](command-contract.md#fingerprints) for the implemented hashing and local evidence identity contract.

**Named input formats.**
Every structured input declares `schemaVersion: 1`.
Use IDs to join records and reject missing or duplicate IDs.
Portable committed assessments instead identify the project and Git object state, with repo-relative paths.
The checker validates the local root separately, so cloning into a different directory does not invalidate otherwise identical reviewed inputs.

| Format | Required contents | Owner |
|---|---|---|
| Findings | Target, stated next change, scope, evidence sources, finding IDs and selections | T2.5 |
| Change set | Target, selected findings, reviewed scope, edits, original and proposed hashes, plan digest | T2.6 |
| Check plan | Change kind, acceptance sources, child command objects, required flags, input scopes and prerequisite evidence | T2.7 |
| Overlap plans | Planned write paths and changed contract IDs, with documented glob semantics | T2.4 |
| Board inputs | Draft revision, proposal IDs and verdicts tied to that revision | T1.6 |
| Project contract | Document pointers and scopes, rules, leaf check IDs, generators and acceptance-source pointers | T3a.1 |
| Assessment | Resolved base, complete changed paths, document assessments, decisions, coverage and execution evidence | T3a.3 |
| Resume state | Run ID, plan digest, per-edit original and proposed hashes, backups and affected checks | T2.6 |

For example, a check plan's command is an object rather than `"npm test"`.

```json
{
  "schemaVersion": 1,
  "checks": [{
    "id": "journey",
    "command": {
      "executable": "node",
      "args": ["scripts/journey.mjs"],
      "cwd": ".",
      "timeoutMs": 120000,
      "versionArgs": ["--version"]
    },
    "required": true,
    "acceptanceCases": ["AC-27"],
    "inputScopes": ["src/**", "scripts/journey.mjs"]
  }]
}
```

This fragment illustrates a command field, rather than a complete approved check plan.
Its owning task supplies the complete validated examples and the acceptance authority.

### Integration checkpoints

Phase 1 proves intent and vision in scratch, without relying on protected writes built in Phase 2.
T2.5 renders to scratch, and T2.6 applies that output after review.
T2.8 and T2.9 use current native checks, without claiming that later enforcement or maintenance exists.
T3.1 supplies the enforcement and architecture references before T2.8 recommends principles, without claiming that rule-proof exists.
T3.4 proves the maintained local check command in disposable copies, and T3a.6 proves maintenance validation in a clean checkout.
T4.3 reruns both full paths and verifies a representative extension against the completed package.
Earlier checkpoint runs are labelled with their stage and cannot substitute for final acceptance evidence.

### Repo layout

```text
bstack/
  AGENTS.md                      instructions for agents working on bstack itself
  README.md                      what bstack is, install, use
  LICENSE                        MIT (design D1)
  NOTICE                         upstream pins and adaptations
  package.json, package-lock.json   private, "type": "module", engines node >=24, scripts: check, test, eval
  .no-mistakes.yaml              delivery gate config, no_ci (no hosted CI workflows)
  docs/
    design.md                    the design of record, migrated from the private source
    implementation-plan.md       this file
    command-contract.md          command grammar and examples, extended by each owning task
    examples/                    worked examples (T5.1)
  upstream/                      raw pinned upstream files, not installed
  install/install.mjs            the installer
  scripts/
    check-package.mjs            the package check
    eval.mjs                     the evaluation runner
    test.mjs                     explicit test discovery, excluding fixture sources
    acceptance.mjs               validates case registry and completed release evidence
  skills/repo-audit/             the only installed folder
    SKILL.md
    agents/openai.yaml
    package.json, package-lock.json   pins lavish-axi only
    references/
      intent-interview.md  grilling.md  domain-language.md  vision.md
      enforcement.md  architecture.md  research-briefs.md  maintenance-contract.md
    assets/vision/               board template and stylesheet
    schemas/                     JSON schemas for every structured file
    scripts/
      repo-audit.mjs             the one command entry point
      lib/                       shared helpers
      bstack-check.mjs           the dependency-free validator copied into target repos
  tests/
    scripts/                     node:test suites for every command
    package-check/               seeded broken skill folders
    fixtures/                    fixture sources and build.mjs
    inputs/                      valid and invalid command inputs
    acceptance/cases.json        all design acceptance IDs and their evidence procedures
    eval/scenarios/              evaluation scenarios
    eval/results/                recorded runs
```

### Delivery gate

bstack has no hosted CI, no GitHub Actions workflows and no release automation (design "Commissioning decisions (2026-10-07)").
Every shipping slice goes through the no-mistakes pipeline configured in `.no-mistakes.yaml`, which declares `no_ci: true`.
Green work merges unattended.
[The gate configuration](../.no-mistakes.yaml) owns automatic repair budgets and the build's review focus.
Required validation after a change still runs, and no further autonomous repair round follows once the configured budget is spent.
Recorded local runs and clean-checkout runs, as each task defines, supply the execution evidence that hosted CI would otherwise provide.
These runs do not prove support on an operating system they did not run on.

### Commissioning slices

The build runs as these slices, in order, with Phase 0 first.
Task IDs stay stable, and a slice maps to a task or a subtask of one.
A slice's done evidence adds to its tasks' "Done when" checks rather than replacing them.
A parent task is complete only after all its slices pass.
Target roughly 200 to 400 lines of authored implementation, reference or test change per slice, excluding copied plans, raw upstream files, assets, generated checker bytes and lockfiles.
That is a review-size target, not a code-length requirement.
Split a slice again when its observable behaviour needs more, rather than compressing error handling or tests.

Every slice records its task IDs, the original user intent and approved amendments, tested revision, commands, output artifacts, tool and OS versions, case IDs and limitations, using the T0.1 record format.

| Slice | Task mapping and behaviour | Prerequisite | Done evidence |
|---|---|---|---|
| C0 | Amend copied design/plan for commissioning, preserve existing config | Captain commissioning ruling | All conflicts above resolved explicitly, IDs/cases retained or approved revisions recorded, no workflow added |
| C1 | T0.1 skeleton, lock, explicit test discovery, evidence schema | C0 | Node 24, npm clean install, bootstrap executed, fixture test excluded, unknown task/zero suite fails, migrated links resolve |
| C2 | T0.2 skill resources and no-arg command | C1 | Correct user-only metadata, all eight local paths, documented exit 3/help |
| C3 | T0.3 pinned fetch and NOTICE | C2 | Exact manifest paths and pins, fetch check, missing-file failure, adaptation inventory |
| C4a | T0.4 target/path/scratch and result/arg contracts | C3 | Draft/Git/no-commit paths, JSON envelope, unknown inputs, escaping parents/links rejected |
| C4b | T0.4 child commands and fingerprints | C4a | Literal arguments, timeout/cancel cleanup, version/output capture, changed bytes invalidate fingerprints |
| C4c | T0.4 minimal schema contract and real command wiring | C4b | Valid data, unknown fields/keywords, duplicate/missing IDs rejected through public interface |
| C5a | T0.5 metadata/loading/resource closure | C4c | Valid skeleton and seeded missing/nested/oversized/host-metadata failures |
| C5b | T0.5 script/import/step policy and rewritten T0.6 | C5a | Declared runtime checks and syntactic controls, local Node 24/26 logs, no-mistakes gate, zero Actions |
| C6a | T1.1 isolated idea/clear-goals fixtures and builder | C1 and relevant C4 contracts, amended dependency | Deterministic temp builds, non-Git idea, scripted local identity/history, source unchanged |
| C6bc | T1.1 TS and Python seeds/native setup, rule-proof and dirty/refactor/history/installer variants | C6a | Each native sanity check executes and confirms its valid/invalid seeds; deterministic seeds, clean proof variants, independent alias/cycle switches |
| C7a | T1.2 registry and manual evaluation interface | C5b, C6bc | 75 owned case IDs, invalid registry/manual result blocked, explicit transcript scoring |
| C7b | T1.2 one current-host adapter, isolation and baseline | C7a | Fresh sessions, no-skill discovery absence, unique transcripts, comparable model/revision/criteria |
| C8 | T1.3 baseline-backed SKILL procedure | C7b | Gap map and package check, hard safeguards retained, unavailable later steps labelled |
| C9a | T1.4 interview/domain references | C8, C3 | Flattened resources, no external skill calls, glossary and confirmed-intent rubric |
| C9b10a (C9b + C10a) | T1.5 VISION reference/assets and T1.6 runtime probe, exact pin, board build | C9a | Package check and recorded asset/NOTICE diff, clean nested install, runtime observation, safe inserted text, unique IDs |
| C10b | T1.6 launch/verdict/resume and T1.7 intent checkpoint | C9b10a | Live roundtrip, stale verdict refused, approved scratch draft, ambiguous decision blocked, workspace unchanged |
| C11a | T2.1 research briefs/citation validation | C10b | Correct/wrong/stale citations, no-web limits, discovery-only transcripts in available modes |
| C11b | T2.2 inspect | C11a | Read-only fingerprint and exact missing-prerequisite result |
| C11c | T2.3 inventory | C11b | Equivalent standards and scoped instruction candidates, absent documents tolerated |
| C12a | T2.4 history measurement | C11c | Rename/range/exclusion evidence, signal commits, no semantic violation inferred |
| C12b | T2.4 overlap | C12a | Declared glob semantics, shared path/contract controls |
| C13 | T2.5 findings schema/render | C12b | Principle/source/selection validation, scratch-only output, stage-specific readiness controls |
| C14a | T2.6 dry-run and exact reviewed payloads | C13 | All invalid plans/preconditions rejected with zero project changes |
| C14b | T2.6 write/journal/resume, including selected delete | C14a | Injected interruption points, backups, original/proposed/conflict states, repeat and dirty-user protection |
| C15a | T2.7 check plans/capture/prior protection | C14b | Failed journey despite passing units, failed/skipped/stale/timeout checks rejected, prior refactor proof |
| C15b | T2.7 live probe pair | C15a | Same endpoint/command/environment before and after, local stand-in mismatch, specific side-effect approval refusal |
| C16 | T3.1 enforcement and architecture references | C8, C3, before C17 | Reviewed enforcement/architecture guidance, package check and two-stack relevance rubric |
| C17 | T2.8 existing foundation integration | C15b and C16 | Audit before interview, clear-goals loading trace where observable, reviewed vision delta, different project recommendations, current native journey preserved |
| C18 | T2.9 protected creation | C17 | Approved minimal journey, destination collision/no-write controls, directory/Git journal and interruption recovery |
| C19 | T3.2 rule-proof, resulting T3.1 reference revisions and T3.3 baseline | C18 | Valid/private/alias/cycle proof with native tools in both clean stacks; existing debt visible, new debt/unauthorised refresh rejected, fixed entry removal |
| C20 | Rewritten T3.4 maintained local integration | C19 | Exact same command passes/fails disposable controls, web/core scoping, no swallowed failures |
| C21 | T3a.1 contract and T3a.2 collect | C20 | Valid pointers/leaf graph, full Git path inventory and explicit absent base blocked. Split contract and collector if needed |
| C22a | T3a.3 assessment/freshness validation | C21 | No-impact/updated/decision cases, forged inventory and stale review rejected |
| C22b | T3a.3 previous-policy/acceptance-source controls | C22a | Removed scope/config/checker cannot erase prior coverage, initial-contract provenance and approved acceptance changes |
| C23a | T3a.4 generated facts | C22b | Stale bytes rejected, scratch regeneration/protected apply, mutation-free check |
| C23b | T3a.5 docs/term context/rule relocation | C23a | Broken pointers, within-context duplicate, cross-context valid, one authoritative rule after move |
| C24a | T3a.6 standalone generation/freshness | C23b | Same source validators/schemas, generated checker current, no skill dependency |
| C24b | Rewritten T3a.6 clean-checkout execution | C24a | Different-root clean clone, fresh leaf execution, unchanged assessment, missing/shallow base and old-policy controls |
| C24c | T3a.7 maintenance guidance | C24b | Maintenance-only transcript, no interview/full audit |
| C25a | T4.1 install preview/copy/ownership | C24c | Isolated homes, source closure, no-op dry run, occupied-unowned collision and nested runtime failure |
| C25b | T4.1 update/uninstall/interruption | C25a | Edited/unowned preservation, obsolete-owned removal, accurate mixed version, resume |
| C25c | T4.1 links and OS executions | C25b | Owned symlink/junction only, target survives removal, recorded Windows/macOS/Linux runs |
| C26 | T4.2 current-agent invocation/loading | C25c | Fresh plain vs explicit sessions, observed load conditions, no router/support skill required |
| C27 | T4.3 final full paths/repeat/extension | C26 | Fresh complete installed paths, extension via public boundary/journey, clean-checkout evidence, fresh case selection |
| C28 | T5.1 examples/limits | C27 | Examples tied to recorded results, reproducible install/use, accurate actual test scope |
| C29 | T5.2 final evidence and manual release | C28, final release approval | All revised case evidence complete, baseline comparisons, final no-mistakes gate, exact approved tag/release |

C0's "conflicts above" are the hosted-CI and release conflicts that the commissioning review listed, now resolved in this plan and the design.
Execute one slice at a time, as approved by the owner.
Listed prerequisites do not authorise parallel execution.
Keep root manifests, lockfiles, command dispatch, shared schemas, `SKILL.md`, `NOTICE`, the case registry and task progress under one integration owner.

## Progress

Tick each task when its "Done when" commands pass.

- Phase 0: Package contract
  - [x] T0.1 Create the repo skeleton
  - [x] T0.2 Create the skill skeleton
  - [x] T0.3 Pin upstream sources and start NOTICE
  - [x] T0.4 Build the shared script library
    - [x] C4a Target/path/scratch and result/argument contracts ([evidence](../tests/eval/results/tasks/T0.4.C4a.json))
    - [x] C4b Child commands and fingerprints ([evidence](../tests/eval/results/tasks/T0.4.C4b.json))
    - [x] C4c Minimal schema contract and real command wiring ([evidence](../tests/eval/results/tasks/T0.4.C4c.json))
  - [x] T0.5 Build the package check
    - [x] C5a Metadata/loading/resource closure ([evidence](../tests/eval/results/tasks/T0.5.C5a.json))
    - [x] C5b Script/import/step policy and rewritten T0.6 ([evidence](../tests/eval/results/tasks/T0.5.C5b.json))
  - [x] T0.6 Establish local validation and no-mistakes gate ([evidence](../tests/eval/results/tasks/T0.6.json))
- Phase 1: Intent and vision
  - [x] T1.1 Build the test fixtures
    - [x] C6a Isolated idea/clear-goals fixtures and builder ([evidence](../tests/eval/results/tasks/T1.1.json))
    - [x] C6bc Native stacks, boundary proofs and state variants ([evidence](../tests/eval/results/tasks/T1.1.json))
  - [x] T1.2 Build the evaluation runner and record the baseline
    - [x] C7a Acceptance registry and manual evaluation interface ([contract](evaluation.md), [evidence](../tests/eval/results/tasks/T1.2.json))
    - [x] C7b Current-host Codex adapter, fresh state and discovery isolation, resumed scripted answers and three human-scored real baselines ([contract](evaluation.md), [evidence](../tests/eval/results/tasks/T1.2.json))
  - [x] T1.3 Write the first `SKILL.md`: bounded checklists, inline safeguards and labelled unavailable tooling ([gap map](../tests/eval/results/gap-map.md), [evidence](../tests/eval/results/tasks/T1.3.json))
  - [x] T1.4 Bundle the interview and domain-language modules - C9a flattens decision rounds, the confirmed-intent rubric, glossary discovery and formats, and separate decision records. Registered packaging search and local checks are recorded in `tests/eval/results/tasks/T1.4.json`. AC-9 and AC-12 agent checks remain assigned to T1.7.
  - [x] T1.5 Adapt VISION and bundle the board assets ([evidence](../tests/eval/results/tasks/T1.5.json))
  - [x] T1.6 Build the VISION board launcher
    - [x] C10a (merged into C9b10a): runtime research/probe, exact nested pin and lock, local/gate setup and revision-bound board build ([partial evidence](../tests/eval/results/tasks/T1.6.json)).
    - [x] C10b: launch, verdict ingestion and resumed-review tests are implemented, with real complete-round verdict ingestion and approved scratch revision now observed in the [C11a prerequisite run](../tests/eval/results/intent-C11a/full-capture/summary.md).
  - [x] T1.7 Complete the intent and vision review - the [fresh scored intent checkpoint](../tests/eval/results/intent-C11a/full-capture/summary.md) records real board review, domain-only glossary, explicit approval of the saved revision and an unchanged non-Git workspace ([task evidence](../tests/eval/results/tasks/T1.7.json)).
    - [Phase 1 E2E observations](../tests/eval/results/phase1-check/summary.md) record the scenario and adapter fixes and the supported board attempt.
      The C11a prerequisite run completes the previously blocked board and scratch-approval evidence without claiming protected project creation.
- Phase 2: Audit and foundation
  - [x] T2.1 Write the research briefs and the citation check - five bounded read-only briefs, common report schema and exact-byte citation validation; [real discovery checkpoints](../tests/eval/results/discovery-C11a/summary.md) record sequential TypeScript/Python fallback and parallel subagent execution, checked citations, no-web limits and unchanged fixtures.
  - [x] T2.2 Build `inspect`. C11bc records read-only Git state, manifest hashes and prerequisite versions, with fixture fingerprint, missing-tool and unreadable-history tests in `tests/eval/results/tasks/T2.2.json`.
  - [x] T2.3 Build `inventory`. C11bc records equivalent document sources, absent kinds and scoped instruction candidates, with native fixtures and root, nested, local and ancestor cases in `tests/eval/results/tasks/T2.3.json`.
  - [x] T2.4 Build `measure` and `overlap`
    - C12 implements revision-bound byte sizes, change and co-change commits, rename lineage, reported lock/generated/declared-formatting exclusions and shared declared write and contract paths.
      Measurement follows merged ancestry with no fixed Git-output capture limit and excludes historical gitlink events.
      The firstmate-approved scope measures only endpoint files, following detected lineage back through renames to addition.
      The firstmate accepts merged deletion and unrelated path reuse as an attribution limitation: old-lifetime commits and co-change pairs can support the replacement's advisory signals, never violations, without changing the definition of a change.
      Generated-directory exclusions now derive from the shared discovery policy.
      Rename evidence respects the same path exclusions as frequency and co-change signals, while formatting-only exclusions retain rename evidence.
      The [command contract](command-contract.md#measure-and-overlap) owns schemas and glob semantics, and [T2.4 evidence](../tests/eval/results/tasks/T2.4.json) records earlier local checks and named fixture controls.
      C13 refreshed T2.4.json and all five C12 command-output artifacts from fresh runs against landed C12 revision fc953e2ea6a8990c92aa29fe820efe43740b0242.
      Injected Windows/macOS cases run on Linux, while real platform execution and complete agent acceptance remain unverified.
  - [x] T2.5 Build the findings schema and report
      C13 adds the complete findings schema, tested uniqueItems validation, source and selection joins, and scratch-only reports with one stage-specific readiness result.
      Current target, scope, intent and artifact fingerprints gate required outcomes, with verification blocked before decisions needed before ready.
      The [findings contract](command-contract.md#findings) owns audit and foundation inputs, examples and readiness limits.
      [T2.5 evidence](../tests/eval/results/tasks/T2.5.json) records local command controls for AC-8, AC-63 and AC-65, with real Windows/macOS and full agent acceptance still separate.
  - [x] T2.6 Build protected writes and resume state
    - C14a implements steps 1-3: change-set and resume schemas, six mechanical operations with complete reviewed bytes, digest-bound selections and resolved scope, and `apply --plan <file> --dry-run`.
      The complete suite is registered as `npm test -- --task T2.6`; its task evidence is `tests/eval/results/tasks/T2.6.json`.
    - C14b implements steps 4-9: protected writes, flushed originals and journal, per-file atomic replacement, hash-derived resume and repeat, `state show`, selected delete and reviewed whole-file replacement.
      Tests inject failures before replacement and process exits after replacement and before journal completion, plus journal I/O failure, filesystem limits, dirty-user conflicts and T2.5 report application.
      Real Windows/macOS execution remains captain checklist evidence, and affected checks can now run through C15a's explicit check plans.
  - [x] T2.7 Build verification capture and live probes
    - C15a implements steps 1-3, 6-7 and the check-plan portion of step 8: acceptance-source schema and pointers, argument-array command capture, input freshness, explicit user-journey coverage and prior-state bug/refactor prerequisites.
      `npm test -- --task T2.7` covers passing units with a failing ts-shop journey, required failure/skip/cancellation/timeout, changed-input blocking, and protective refactor evidence before structural edits plus compatibility afterward.
      The [task evidence](../tests/eval/results/tasks/T2.7.json) records execution for the complete task.
      The [check-plan contract](command-contract.md#check-plans-and-capture) owns the interface, before/after snapshot rules, scope exclusions and local evidence limits.
    - C15b implements steps 4-5 and the probe-record portion of step 8: schema-defined live captures, matching command/endpoint/environment pairs, freshness checks and approval bound to each side-effecting call.
      `npm test -- --task T2.7` also covers missing and mismatched probes, unavailable reasons and the ts-shop live stand-in disagreement despite passing mocked units.
      Real Windows/macOS execution and full agent acceptance remain separate evidence.
  - [x] T2.8 Complete the existing-repo audit and apply path
    - C17 connects inspect, inventory, cited research, evidence summary, conditional questions, findings, selection, protected apply, native check capture and the reviewed audit record.
      `npm test -- --task T2.8` registers the command integration, evaluation controls and package check suites.
      The integration preserves distinct scoped and local instructions, dirty user work and the native quote journey through a selected root instruction delete and audit-record apply, then refreshes stale final evidence.
      Four real isolated Codex scenarios cover audit-before-interview, clear-goals loading, different TypeScript/Python recommendations and a reviewed two-line candidate delta against an existing approved vision.
      [Checkpoint evidence](../tests/eval/results/foundation-C17/summary.md) distinguishes the scripted candidate review from blocked board interaction and exact-revision approval.
      [Task evidence](../tests/eval/results/tasks/T2.8.json) records final local validation.
      Maintained enforcement, portable maintenance and T4.3's completed-package extension proof remain pending.
  - [x] T2.9 Complete protected new-project creation - versioned reviewed destination/scaffold/command plans reuse the protected-write engine, with scratch exact diffs, no-write validation, directory/file/Git journals and interruption recovery.
    The registered command suite covers collisions, user edits, partial writes and interrupted commands.
    The [foundation checkpoint](../tests/eval/results/foundation-C18/summary.md) records real board verdicts, exact vision/scaffold approvals, the Chromium Rice/reload journey and an unchanged ambiguous-idea workspace.
    The generated full native check failed and remains unverified with the created project kept; its scratch-verified one-line test correction is diagnosis only.
    Skill-quality observation: the agent did not run and repair its own native tests before finishing the scaffold proposal.
    This slice adds no corrective skill guidance for that observation.
    [Task evidence](../tests/eval/results/tasks/T2.9.json) records final local checks; Windows/macOS, later enforcement and maintenance remain pending.
- Phase 3: Enforcement
  - [x] T3.1 Write the enforcement and architecture references (before T2.8)
    - C16 supplies the early enforcement and architecture references, reviewed against both ts-shop and py-ledger using the [relevance rubric](../tests/eval/results/tasks/T3.1.verification.md).
      `npm test -- --task T3.1` reuses package and skill command-interface suites, with package check and routing searches recorded in [task evidence](../tests/eval/results/tasks/T3.1.json).
      This checkpoint claims useful references only.
      C19 adds rule-proof usage, equivalent-resolution coverage limits and debt baseline guidance after native proof in both stacks.
  - [x] T3.2 Build `rule-proof`
    - C19 proves clean public imports and permitted direction, plus independently seeded private, alias/equivalent bridge and cycle violations using the researched TypeScript resolver and Python AST tools.
      `npm test -- --task T3.2` also covers failed clean setup, missing tools, failed versions, wrong diagnostics, passing violations, timeouts and invalid selection.
      [Task evidence](../tests/eval/results/tasks/T3.2.json) retains full-suite native versions, clean controls and independently seeded diagnostics with AC-52, AC-60 and AC-66 links.
  - [x] T3.3 Build debt baseline handling
    - Neither researched fixture tool has a native baseline feature; C19 supplies the baseline schema and `baseline check` with visible retained debt, new-debt rejection, fixed-entry removal and one-entry growth only for a selected unresolved debt finding.
      `npm test -- --task T3.3` covers unauthorized refresh, selection, scope and metadata boundaries and no partial refresh writes.
      [Task evidence](../tests/eval/results/tasks/T3.3.json) retains full-suite baseline checks and the AC-67 link, with Linux-only execution and native-analysis limitations.
      Real Windows and macOS execution remains captain checklist evidence.
  - [x] T3.4 Integrate scoped checks with the maintained local command
    - C20 integrates selected checks through protected `apply` edits with explicit `checkIntegration` command paths and rejects failure-masking selected commands before writes.
      Unrelated reviewed edits and sibling scripts pass through unchanged; selected CI edits use the JSON subset of YAML, retaining the Node-built-ins-only runtime and sole `lavish-axi` runtime dependency.
      `npm test -- --task T3.4` runs the identical `npm run check` in valid and seeded disposable `ts-shop` copies, after selected initial documented debt, with exits 0 and 1 and a permitted core import under the web-scoped rule.
      Individual native rules still run against the clean T1.1 variants.
      [Task evidence](../tests/eval/results/tasks/T3.4.json) binds the final gate run to these local controls; hosted CI adapters remain unverified and real Windows/macOS execution remains captain checklist evidence.
- Phase 3a: Maintenance
  - [ ] T3a.1 Define the project contract
  - [ ] T3a.2 Build `evidence collect`
  - [ ] T3a.3 Build `evidence validate`
  - [ ] T3a.4 Build generated-fact freshness checks
  - [ ] T3a.5 Build document reference checks
  - [ ] T3a.6 Build and prove the standalone checker in a clean checkout
  - [ ] T3a.7 Write the maintenance reference
- Phase 4: Installation
  - [ ] T4.1 Build the installer
  - [ ] T4.2 Run the basic tests in the current agent
  - [ ] T4.3 Prove both complete paths and a representative extension
- Phase 5: Release
  - [ ] T5.1 Write worked examples and limitations
  - [ ] T5.2 Final evaluation and release

## Phase 0: Package contract

Phase evidence from the design: no missing local references or undeclared runtime dependencies.

### T0.1 Create the repo skeleton

**Depends on:** none.

**Inputs and outputs:** Approved repo destination and design source -> skeleton, lockfile, test runner and task record format.

**Verification:** `npm ci` and `npm test`.

**Read:** design "Summary" and "Installation and host contract".

**Steps**

1. Work in the existing public repo `knowttl/bstack`.
   Preserve its `.no-mistakes.yaml` and add no workflow files.
2. Add the MIT licence file, a short README and `.gitignore` for dependencies, scratch outputs and OS files.
3. Add the root package manifest with Node >=24 and scripts `check`, `test` and `eval`.
4. Generate and commit the root `package-lock.json` before any `npm ci` check.
5. Write `scripts/test.mjs` to discover only `*.test.mjs` under `tests/scripts/` and `tests/package-check/`.
   Sort paths and pass explicit file arguments to `node --test`.
   Never discover tests inside fixture sources, installed dependencies or evaluation workspaces.
   Fail when the selected suite has no tests.
   Support `--task <id>` to select that task's registered suites.
6. Add one meaningful bootstrap test that checks manifest commands, lockfile consistency and test-discovery exclusions.
7. Define the task evidence record from "Task evidence contract", with a versioned schema under `tests/eval/`.
8. Done in commissioning slice C0: the design and implementation plan are in `docs/`, with corrected relative links and recorded provenance.
   Preserve the original personal-repo copies as migration references until the owner chooses their retirement.
9. Write a short `AGENTS.md` with pointers to the design, implementation plan and supported check commands.

**Done when**

- `node --version` reports 24 or later.
- `npm ci` and `npm test` exit 0 with the bootstrap test executed.
- A deliberately failing test inside a fixture source is excluded from the bstack test run.
- The copied documents' local links resolve and the local Git history contains the skeleton commit.

The earlier `node --test tests/` command failed in a Windows Node `v24.16.0` probe.
Use the explicit-file runner above rather than passing a directory as a test file.
[npm documents that `npm ci` requires a lockfile](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

### T0.2 Create the skill skeleton

**Depends on:** T0.1.

**Inputs and outputs:** Design host and loading contract -> skill skeleton and command help.

**Verification:** `npm test`.

**Read:** design "Load only what each step needs", "How repo-audit itself is written" and the host table under "Installation and host contract".

**Steps**

1. Create `skills/repo-audit/SKILL.md` with frontmatter `name: repo-audit`, a one-line `description` for a human, and `disable-model-invocation: true`.
2. Write the body as headings only: Scope, New-idea path checklist, Existing-repo path checklist, Verification rules, Write rules, Load when.
   Add the "load when" table from the design with the eight reference files.
3. Create each of the eight reference files with a title and a one-line purpose.
4. Create `agents/openai.yaml` with `policy.allow_implicit_invocation: false`.
5. Create `scripts/repo-audit.mjs`.
   With no arguments, it prints the list of commands and exits 3.

**Done when**

- `node skills/repo-audit/scripts/repo-audit.mjs` prints the command list and exits 3.
- Every file the "load when" table names exists.

### T0.3 Pin upstream sources and start NOTICE

**Depends on:** T0.2.

**Inputs and outputs:** Pinned source list -> fetched raw sources, manifest and NOTICE.

**Verification:** `node upstream/fetch.mjs --check` and `npm test`.

**Read:** design "Bundled sources and runtime" and "Evidence and limitations".

**Steps**

1. Write `upstream/sources.json`.
   Each entry has a source name, repo URL, pinned commit and the list of files to copy.
   Start with these pins from the design:
   - `mattpocock/skills` at `6fd947921b935b7e1e69293a200400f0fdd5c15f`: grill-me, grilling, grill-with-docs, domain-modeling (with GLOSSARY-FORMAT and ADR-FORMAT), setup-matt-pocock-skills/domain.md, codebase-design, improve-codebase-architecture, code-review, retro, writing-for-agents.
   - `kunchenguid/vision` at `7a20c38181151ec67efdf8fa2cb03a60123a7b83`: `skills/vision/SKILL.md` and `skills/vision/assets/`.
   - `cursor/plugins` (pstack) at `9f451cf875ad1239912762f67741e8e5ba6ac0f1`: the architect design red flags and the five principle skills the design cites.
   - `kunchenguid/kun` at `1b2a9c7dd4b2b33eb7161399d7893c39048213be`: `ENTRY.md`.
2. Write `upstream/fetch.mjs`.
   It downloads each listed file at its pinned commit from `raw.githubusercontent.com` into `upstream/<source>/`, and fails if a file is missing.
3. Run it and commit the raw copies.
4. Recheck that each pstack file the design cites exists at the pin.
   If one moved, pin the commit that has it and update the design's links.
5. Start `NOTICE` with one table: source, pinned commit, files adapted, what changed.
   Rows fill in as later tasks adapt files.

**Done when**

- `node upstream/fetch.mjs --check` exits 0 and reports every listed file present at its pin.
- `NOTICE` lists every source in `sources.json`.

### T0.4 Build the shared script library

**Depends on:** T0.3.

**Inputs and outputs:** Shared contracts -> library, command grammar and valid/invalid input fixtures.

**Verification:** `npm test -- --task T0.4`.

**Read:** design "Script contract" and this plan's "Shared command and input contracts".

**Steps**

1. Write `docs/command-contract.md`, defining the shared contracts without repeating command help in `SKILL.md`.
2. Build `args.mjs`, `result.mjs`, `repo.mjs`, `paths.mjs`, `run.mjs`, `fingerprint.mjs` and `scratch.mjs` in `scripts/lib/`.
3. Implement target resolution for Git repos and draft-only workspaces as separate modes.
   Resolve the nearest existing parent when validating a new file path, then reject resolved links outside the target.
4. Build `schema.mjs` with the explicitly supported JSON Schema keywords used by the package.
   Validate schema definitions as well as data, and reject unsupported keywords instead of ignoring them.
5. Implement the shared child-command contract, including the Windows npm adapter, timeouts and cancellation.
6. Wire the command entry point to `scripts/commands/` and provide command-specific help without loading source files.
7. Test helpers through a small public test command, using valid and invalid input files in `tests/inputs/`.

**Done when**

- The task suite covers unknown options, missing targets, a non-Git workspace and a Git repo with no commits.
- Traversal, escaping links and a new path under an escaping parent are refused before a write.
- Unsupported schema keywords and invalid inputs fail with their named problems.
- Child-process tests preserve literal arguments, run npm on Windows, and report timeout and cancellation as non-passing.

### T0.5 Build the package check

**Depends on:** T0.4.

**Inputs and outputs:** Skill skeleton and package rules -> package validator and seeded failures.

**Verification:** `npm run check` and `npm test -- --task T0.5`.

**Read:** design "Load only what each step needs" (rules for loading), "How repo-audit itself is written" and step 3 of "Implementation steps".

**Steps**

1. Write `scripts/check-package.mjs --skill <folder>`, defaulting to `skills/repo-audit/`.
   Check authored package resources, excluding installed dependency contents and local runtime caches.
   Report every problem before exiting.
   It fails on:
   - A local link or path in any skill file that does not exist.
   - A script import that is neither a Node built-in nor declared in the skill's `package.json`.
   - A file in `references/` that the "load when" table does not list.
   - A reference file that links to another reference file.
   - A `SKILL.md` body over 500 lines.
   - A reference file over 100 lines without a table of contents in its first 20 lines.
   - A missing `disable-model-invocation: true` or a missing `agents/openai.yaml` with `policy.allow_implicit_invocation: false`.
   - A top-level constant in a script with no comment on the line above.
   - A `### Step` heading in `SKILL.md` with no `Done when:` line before the next heading.
   - A lint config file, lint preset or list of language tools in the skill folder (design "Language-agnostic by design").
   Use a short deny list of config file names and tool names, and keep it in the check script, not the skill.
2. Add one seeded broken copy of a minimal skill folder per rule in `tests/package-check/`.
   Each must fail with its rule code.
3. Wire `npm run check` to run the check on the real skill.

**Done when**

- `npm run check` exits 0 on the skeleton.
- `npm test` shows each seeded folder failing with its expected rule code.

**Covers:** AC-41, AC-44, AC-45, AC-47.

### T0.6 Establish local validation and no-mistakes gate

**Depends on:** T0.5.

**Inputs and outputs:** Root lockfile and passing local checks -> recorded local Node 24 and Node 26 runs and the no-mistakes gate.

**Verification:** `npm ci --ignore-scripts`, `npm run check` and `npm test` on local Node 24 and Node 26, then the slice's no-mistakes run.

**Read:** design "Commissioning decisions (2026-10-07)", "Build order and release proof" and the Node version default.

**Steps**

1. Check the Node release schedule at nodejs.org and confirm which majors are in LTS.
   Update the Node row in "Defaults this plan sets" if it changed.
2. Run `npm ci --ignore-scripts`, `npm run check` and `npm test` on local Node 24 and on local Node 26.
   Record each command, the full Node version, the OS, the exit code and the output, using the task evidence contract.
3. Confirm that `.no-mistakes.yaml` declares `no_ci: true` and covers the same validation as the local runs without repeating dependency installation or test suites.
   Include T0.5's distinct package check rather than assuming `npm test` covers it.
   Gate the slice through no-mistakes.
4. Add no `.github/workflows/` file and no hosted matrix.
5. No gate command may ignore a failure, for example with `|| true`.

**Done when**

- The Node 24 and Node 26 runs exit 0 with recorded evidence.
- The slice passes the no-mistakes gate with no CI, and the repo has no GitHub Actions workflow.
- The record states that these runs do not prove support on another operating system.

These runs replace the earlier recorded GitHub matrix as commissioning evidence (design "Commissioning decisions (2026-10-07)").
From T1.6 onward, the nested skill runtime joins this local and gate path, as T1.6 defines.

## Phase 1: Intent and vision

Phase evidence from the design: a new idea reaches an approved vision draft and resolved vocabulary in scratch, without project writes.

### T1.1 Build the test fixtures

**Depends on:** T0.1 and T0.4.

**Inputs and outputs:** Design acceptance sources -> isolated repo and non-Git fixtures with sanity checks.

**Verification:** `node tests/fixtures/build.mjs --all` and `npm test -- --task T1.1`.

**Read:** design "Acceptance cases" and "Language-agnostic by design".

**Steps**

1. Write `tests/fixtures/build.mjs`.
   For repo fixtures, copy sources into a temporary folder, initialise Git and replay the declared history.
   For idea fixtures, copy the brief without initialising Git.
   Set fixture-local Git identity and disable signing, without changing global Git configuration.
   Print the folder path and fixture kind.
2. Create these fixture sources.
   Each has a `FIXTURE.md` that lists its seeded problems and the acceptance cases it serves.
   - `new-idea/`: a non-Git workspace with only `brief.md` and no unresolved stack decision.
   - `ambiguous-idea/`: a non-Git workspace whose brief contains one unresolved decision that changes the stack.
   - `ts-shop/`: a TypeScript npm workspace with two packages, `web` and `core`.
   Seed these problems:
     - A UI file that imports the database adapter directly.
     - One file that mixes routes, pricing rules and persistence.
     - An import cycle.
     - A `tsconfig` path alias that bypasses the public interface.
     - A private import and a valid public import for boundary proof.
     - A `CLAUDE.md` that only imports `AGENTS.md`.
     - A `DESIGN.md` principle that says the UI never touches storage.
     - A glossary term with two meanings.
     - Passing unit tests with a failing end-to-end user journey.
     - A mock of an HTTP service that disagrees with a small local server.
     The server stands in for the real service.
   - `py-ledger/`: a Python package with `pyproject.toml` and a lint config.
   Seed a large but cohesive module that must not be flagged, a thin startup file that imports many modules, an import of another module's private `_internal` file, and a `CONTRIBUTING.md` that holds the standards instead of a `CODING_STANDARDS.md`.
   - `clear-goals/`: a small repo with an approved `VISION.md`, a `DESIGN.md`, a glossary and no open decisions.
3. Add clean rule-proof variants for both language stacks.
   Each has valid public imports and independently switchable seeds for private imports, aliases and cycles.
   The Python stack uses its own import mechanisms for the equivalent bypass.
   Valid variants must pass before injecting a violation.
   Keep unrelated debt out of rule-proof variants.
4. Add fixture variants for dirty work, refactors, contract removal, shallow history and installer collisions.
5. Give each fixture a `sanity` script that proves its seeds are present, for example that the `ts-shop` unit tests pass and its end-to-end check fails.
6. Give each native-stack fixture its own lockfile or pinned setup command and declare its native runtime requirements, such as the TypeScript and Python versions its sanity checks need.
   Keep those native development dependencies in the fixtures, not in the installed skill.
   A missing native tool is reported as blocked, rather than as a passing or skipped sanity check.

**Done when**

- `node tests/fixtures/build.mjs --all` builds every fixture and each `sanity` script passes.
- Each native sanity check executes on its real native tools and confirms its valid and invalid seeds before any baseline run.

### T1.2 Build the evaluation runner and record the baseline

**Depends on:** T1.1 and T0.6.

**Inputs and outputs:** Fixtures and acceptance IDs -> adapters, registry, runner and baseline evidence.

**Verification:** `npm test -- --task T1.2` and `node scripts/acceptance.mjs --check-registry, then baseline runs`.

**Read:** design "How repo-audit itself is written" (Testing), "Model-agnostic by design" and "Acceptance cases".

**Steps**

1. Define scenarios with a fixture, opening request, scripted user answers, checkpoint and yes-or-no checks tied to design acceptance IDs.
2. Define a host adapter JSON file with `{ executable, args, invocation, isolation }`.
   Remove the ambiguous `BSTACK_AGENT_CMD` shell string.
   The adapter uses the shared child-command object and documents how it creates a fresh session.
3. `eval --scenario <id> --mode without|with --stage <stage> --adapter <file>` creates a fresh fixture and isolated agent state.
   Record the skill discovery paths and verify the isolation before scoring.
   In `without` mode, no repo-audit skill is discoverable.
   In `with` mode, stage the current skill and its built runtime resources into the isolated host's documented discovery path.
   This temporary staging is a test helper, not the release installer built in T4.1.
4. Ordinary `with` scenarios explicitly invoke the skill using the adapter's host-specific invocation.
   The implicit-invocation scenario installs the skill but sends only "audit this repo".
   Baseline runs use the equivalent user outcome request without the explicit skill command.
5. Deliver scripted answers through a host-supported conversation interface.
   When the host cannot support the interaction or isolation, switch to the documented manual procedure.
   Do not assume a one-shot stdin prompt can answer later questions.
6. For manual runs, print the fixture, request, answer script and checklist.
   Accept `eval score --run <id> --answers <file> --transcript <file>` to finish scoring explicitly.
   Missing answers or transcripts leave the run blocked, rather than waiting indefinitely or assuming success.
7. Save unique run IDs with timestamps, agent, model, OS, tool versions, fixture revision, stage, transcript and case results.
   Keep earlier checkpoint runs as history.
   Final evidence is an explicit selection of one run per case, stage and revision, so repeated execution artifacts are legitimate while duplicate final selections are rejected.
   Baseline and with-skill runs use the same fixture revision, agent, model and scoring criteria.
   Score deterministic checks from artifacts, and identify human-scored checks by reviewer and transcript location.
8. Register every design acceptance ID in `tests/acceptance/cases.json` with its owner task, procedure, criterion source and evidence type.
   Implement `scripts/acceptance.mjs --check-registry` for missing IDs, duplicate IDs, unknown tasks and invalid procedure definitions.
   It permits planned procedures whose implementation is pending, but never treats them as passed.
   Completed procedures must name an existing test or scenario and its evidence artifacts.
9. Add scenarios for a new idea, ambiguous idea, seeded existing repo, clear goals and implicit invocation.
   Add the maintenance and representative-extension scenarios before their owning tasks use them.
10. Run at least three realistic, comparable initial scenarios in `without` mode and record actual results, as the design requires.
    Keep every approved scenario, including those the baseline already passes.
    A passing baseline case stays in the evaluation and must still pass with the skill.
    There is no quota of observed failures.
    Never manufacture a failure, weaken a case or delete a requirement because the baseline passes.

**Done when**

- The runner's tests cover isolation, explicit versus implicit invocation, manual scoring and unique result paths.
- At least three realistic comparable scenarios each have a baseline transcript and scored results, including any that already pass.
- The acceptance registry names all 75 cases with their planned procedures, without claiming pending evidence is complete.

### T1.3 Write the first `SKILL.md`

**Depends on:** T1.2.

**Inputs and outputs:** Observed baseline results and authoring rules -> bounded SKILL.md and gap map.

**Verification:** `npm run check`, then the baseline-to-guidance mapping review.

**Read:** design "repo-audit capability requirements" (all subsections), "How repo-audit itself is written" and the baseline failures from T1.2.

**Steps**

1. Write the scope section: what the skill does, what it refuses (unrelated product work, routing, delivery), and that an unclear scope must be resolved before any write.
2. Write both checklists the agent copies and ticks: the new-idea path and the existing-repo path.
   Each step uses the `### Step N:` format with a `Done when:` line.
3. Inline what every path needs: the review-before-apply rule, the write rule (only through `apply`), the verification rules from design "Verification requirements" including the live-probe rule, and the subagent rule with its fallback.
4. Keep all required hard guardrails and acceptance coverage.
   Remove redundant advice only after an ablation run passes the same cases without that advice.
   A passing baseline does not cancel an approved requirement.
5. State that the skill may edit `AGENTS.md` only through `apply`, after the user approves each change.

**Done when**

- `npm run check` passes.
- Every baseline failure from T1.2 maps to a sentence or step in `SKILL.md`.
Record the mapping in the T1.2 results folder as `gap-map.md`.

### T1.4 Bundle the interview and domain-language modules

**Depends on:** T1.3.

**Inputs and outputs:** Pinned interview and language procedures -> flattened reference files and NOTICE changes.

**Verification:** `npm run check`, then the external-skill-call search below.

**Read:** design "Establish the project intent", "Glossary requirements" and "Keep decisions separate".

**Steps**

1. Write `references/grilling.md` from upstream `grilling`, flattened so it needs no other file.
   Keep the decision-tree method: parent decisions first, a recommendation with each question, small rounds of independent questions.
2. Write `references/intent-interview.md` for the new-idea path.
   It lists what the interview establishes (design "Establish the project intent") and how to finish with a confirmed summary.
3. Write `references/domain-language.md` from upstream domain-modeling, the glossary format, domain document discovery and the ADR format.
   Include glossary rules: one concept per entry, contexts, no implementation detail, drafts until confirmed.
4. Replace every call to another skill with plain instructions.
   Remove host-specific tool names.
5. Add a `NOTICE` row for each adapted file.

**Done when**

- `npm run check` passes.
- A search of `skills/repo-audit/` for `Skill tool`, `invoke the` and upstream skill names as calls finds nothing.

**Covers:** AC-9, AC-12 (checked in T1.7).

### T1.5 Adapt VISION and bundle the board assets

**Depends on:** T1.4.

**Inputs and outputs:** Pinned VISION procedure and assets -> adapted reference, board template and NOTICE changes.

**Verification:** `npm run check`, then the recorded upstream asset diff.

**Read:** design "Establish VISION.md".

**Steps**

1. Write `references/vision.md` from upstream VISION.
   Add the new-idea evidence mode, where confirmed author decisions are the evidence.
   Replace the fixed proposal quota with "one proposal per real unresolved trade-off".
   Add the existing-vision rule: propose a reviewed change, never a competing vision.
2. Copy the board template and stylesheet into `assets/vision/` unchanged where possible.
   Record every change in `NOTICE`.

**Done when**

- `npm run check` passes.
- A diff of the board assets against `upstream/` shows only the changes `NOTICE` records.

### T1.6 Build the VISION board launcher

**Depends on:** T1.5.

**Inputs and outputs:** Board assets and live runtime probe -> pinned launcher, inputs and verdict tests.

**Verification:** `npm ci --omit=dev --prefix skills/repo-audit` and `npm test -- --task T1.6, then the live board procedure`.

**Read:** design "Bundled sources and runtime".

**Steps**

1. Research `lavish-axi`: the package name, the current version, how to start it and how verdicts come back.
   Find out how a host with only a terminal gets verdicts back, for example by opening a local URL in a browser or by writing a verdict file.
   Record the findings in `docs/design.md` "Evidence and limitations".
2. Pin the exact version in `skills/repo-audit/package.json` and commit the lockfile.
   Run `npm ci --omit=dev --prefix skills/repo-audit` now, and add that setup step to the local validation and no-mistakes gate path from T0.6.
   Make the gate's nested setup conditional only until the nested manifest exists, then validate both lockfiles and the runtime closure.
   Prove the setup with a fresh disposable install that has no globally installed support skills.
   Add no workflow file.
   Record a live launcher probe before adapting outside runtime behaviour.
3. Add the `vision-board` command with three subcommands:
   - `build --draft <file> --proposals <file>` fills the template.
   Follow the [board build contract](command-contract.md#vision-board-build) for inputs and scratch metadata.
   Escape every inserted value for HTML and for any script context.
   Validate that card IDs are unique.
   - `launch` starts the board.
   On failure, it reports the missing prerequisite and the fix, and keeps the draft in scratch.
   - `verdicts` reads returned verdicts tied to a run and draft revision.
    Reject unknown, duplicate or missing card IDs and verdicts from an incompatible draft.
    Apply approved verdicts to a new draft in scratch and preserve the previous draft for resume.
    Follow the semantic editing boundary in the design's [VISION runtime section](design.md#vision-runtime-observation-c9b10a).
4. Test escaping with quotes, backticks, `<script>`, `&` and Unicode.
   Test a resumed review that reads an earlier run's verdicts.

**Done when**

- `npm test` passes the escaping and resume tests.
- A clean nested runtime install succeeds through the local and gate setup path.
- A manual run opens the board, returns a verdict and updates the matching proposal in the draft.
- A resumed review preserves prior decisions and rejects verdicts from a different draft revision.

**Covers:** AC-3.

### T1.7 Complete the intent and vision review

**Depends on:** T1.6.

**Inputs and outputs:** Non-Git idea fixtures and scripted answers -> approved scratch drafts and intent-stage evidence.

**Verification:** Intent-stage new-idea and ambiguous-idea procedures from T1.2.

**Read:** design "New-project path" and "Integration checkpoints" in this plan.

**Steps**

1. Complete only the intent and vision steps in `SKILL.md`: interview, glossary draft, vision draft, board review and confirmed summary.
2. Use a non-Git `--workspace` and keep every draft and verdict in scratch.
   Name the later protected-creation step, but do not run an unavailable `apply` command or write project files.
3. Run the new-idea and ambiguous-idea scenarios with `--stage intent`.
4. At an unresolved decision, stop dependent work and continue only work that cannot pre-empt that decision.

**Done when**

- The new-idea run has an approved vision draft and a glossary with a resolved term and no implementation detail.
- The ambiguous run records the blocked decision without choosing a stack.
- Both source workspaces remain unchanged and neither gains a Git repo.
- Records name the intent checkpoint, rather than claiming complete repo creation.

**Covers:** AC-2, AC-9, AC-12.
Final AC-1 evidence is collected in T2.9 and T4.3.

## Phase 2: Audit and foundation

Phase evidence from the design: the existing repo is unchanged during review, findings cite authoritative sources, and chosen changes preserve user edits.

### T2.1 Write the research briefs and the citation check

**Depends on:** T1.7.

**Inputs and outputs:** Repo fixtures and research scopes -> cited briefs and citation validator.

**Verification:** `npm test -- --task T2.1`, then discovery-only procedures in both available modes.

**Read:** design "Delegate research to subagents" and "Language-agnostic by design".

**Steps**

1. Write `references/research-briefs.md` with these briefs.
   Each states the question, the paths in scope, the report format and a word limit:
   - Document inventory.
   - Code and architecture evidence.
   - Existing checks and toolchain.
   - Language research: repo configs first, then official docs, then established community guides.
   Each recommendation cites its link and the read date.
   Without web access, mark recommendations "not researched" with the reason.
   - Outside research for a third-party service.
2. Use repo-relative `path:line` for file citations.
   Web citations use the source URL and read date.
   Record which revision or file hash the file citation describes.
3. Add the `cite-check --report <file>` command.
   It fails on any cited path that does not exist or any line number past the end of the file.
4. Add to `SKILL.md`: subagents are read-only, run independent briefs in parallel, check citations before a finding uses them, name the mode that ran.

**Done when**

- `npm test` shows `cite-check` failing on a report with a wrong path and a wrong line.
- A discovery-only checkpoint runs the research briefs in the main thread, and with subagents where the current host has them.
  When the host has no subagents, the subagent-mode case stays blocked rather than passing on main-thread evidence.
- Each checkpoint record contains the same report format, verified citations, the mode that ran, the host, its available capabilities and what was actually observed.
- These checks do not require the later complete audit path.

**Covers:** AC-34, AC-35, AC-36, AC-37, AC-48.

### T2.2 Build `inspect`

**Depends on:** T2.1.

**Inputs and outputs:** Repo target and system prerequisites -> read-only starting-state envelope.

**Verification:** `npm test -- --task T2.2`.

**Read:** design "Existing-repo path" and the first row of "Required scripted safeguards".

**Steps**

1. `inspect` reports the repo's real path, revision or "no commits", working-tree changes, detected manifests, and prerequisites with their found versions.
2. A missing tool or unreadable history is a specific limitation in `problems`, never a pass.
3. `inspect` writes nothing to the repo.

**Done when**

- A test fingerprints a fixture before and after `inspect` and finds no change.
- A test with `git` hidden from `PATH` returns `blocked` with a named limitation.

**Covers:** AC-4, AC-68.

### T2.3 Build `inventory`

**Depends on:** T2.2.

**Inputs and outputs:** Repo instruction and document sources -> authoritative inventory and missing-source limits.

**Verification:** `npm test -- --task T2.3`.

**Read:** design "Existing-repo path" and "Files the skill maintains".

**Steps**

1. `inventory` finds instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`), vision, design, glossary and context maps, standards and `CONTRIBUTING.md`, decision records and earlier audit records.
2. It matches equivalent names, not only the exact file names, and reports each file's path, hash and kind.
3. A missing file is reported as absent, not as a failure.
4. When a repo-owned `CLAUDE.md` exists, including a stub that only imports `AGENTS.md`, `inventory` returns a candidate finding: merge its equivalent content into `AGENTS.md`, with the Claude Code version limit from the design.
5. Report each instruction file's scope, its directory and whether it is inside the selected repo.
   A nested instruction file with distinct scoped guidance is reported as scoped, not as a merge candidate to flatten into the root file.
   `CLAUDE.local.md` and instruction files in ancestor directories outside the repo are reported as possible shadowing of `AGENTS.md`, never as files to modify.

**Done when**

- On `py-ledger`, `CONTRIBUTING.md` is reported as the standards source and no failure is raised for a missing `CODING_STANDARDS.md`.
- On `ts-shop`, the `CLAUDE.md` stub produces the merge candidate.
- Representative root, nested, local-only and outside-repo instruction files produce a merge candidate, a preserved scope, a shadowing report and an out-of-scope shadowing report respectively.

**Covers:** AC-10, AC-11, AC-49.

### T2.4 Build `measure` and `overlap`

**Depends on:** T2.3.

**Inputs and outputs:** History range and planned path sets -> repeatable signals and overlap report.

**Verification:** `npm test -- --task T2.4`.

**Read:** design "What the audit must inspect", "Make the measurements repeatable" and "Evidence for refactoring and parallel changes".

**Steps**

1. `measure` collects file sizes, change frequency and pairs of files that change together, from `git log` with rename detection over a stated revision range.
2. It excludes lockfiles, generated files and broad formatting commits, and reports the exclusions it used.
   Each signal lists its supporting commits.
3. `measure` reports signals, not violations.
   Import and dependency analysis is not its job.
   It comes from the native tool the language research selects.
4. `overlap --plans <file> <file>` compares the declared write paths of two planned changes and reports shared paths and shared contract files.

**Done when**

- On `ts-shop`, the mixed-responsibility file and the coupled cluster appear as signals with commits.
- On `py-ledger`, the cohesive module and the startup file appear only as signals with no violation status.
- `overlap` reports the shared file on two seeded plans.

**Covers:** AC-50, AC-51, AC-53.

### T2.5 Build the findings schema and report

**Depends on:** T2.4.

**Inputs and outputs:** Cited findings and reviewed scope -> schema, validated findings and scratch report.

**Verification:** `npm test -- --task T2.5`.

**Read:** design "Existing-repo path" (finding contents) and "Project-specific foundation".

**Steps**

1. Write `schemas/findings.schema.json`.
   Each finding has these fields:
   - An ID such as `F-001`.
   - The problem, and the files or failing command.
   - The principle, the consequence, the fix, the scope and the verification method.
   - Whether it blocks the intended change.
   - A category: `debt`, `missing-protection` or `decision`.
   - A status: `proposed`, `selected` or `rejected`.
   - A flag that marks a proposed new principle.
   - Evidence source pointers and whether each source describes documented, observed or inferred intent.
   - Reviewed target identity, scope and the stated next change.
2. Extend the shared schema validator from T0.4 with tested keywords only.
   Define the findings schema and complete examples before writing report logic.
3. Add `findings validate --findings <file>` and `findings render --findings <file>`.
   `render` writes the proposed record to scratch and returns its path.
   T2.6 writes that reviewed output to the existing audit record or `docs/repo-audit.md` through `apply`.
4. The report states one result: ready for the stated next change, decisions needed, or verification blocked.
   It has no score.
   Define the verdict inputs and their precedence for each stage.
   A structurally valid findings set without current evidence for its required outcomes cannot claim ready.

**Done when**

- `npm test` shows `findings validate` rejecting a finding with no principle and one with an unknown status.
- `render` on a sample finding set produces a record that separates documented intent, observed behaviour and inferred intent.
- A valid findings set with a failed journey, an unresolved decision or missing evidence does not render as ready.

**Covers:** AC-8, AC-63, AC-65.

### T2.6 Build protected writes and resume state

**Depends on:** T2.5.

**Inputs and outputs:** Selected findings and exact proposed bytes -> protected edits, backups and resume journal.

**Verification:** `npm test -- --task T2.6`.

**Read:** design "Script contract", "Keep automation honest" and this plan's hash and input contracts.

**Steps**

1. Define the change-set and resume schemas before implementing writes.
   Every edit includes a selected finding ID, target path, original hash, proposed hash and supported operation.
   Bind selections, target identity, resolved scope and edit payloads into the plan digest.
   An unresolved scope or changed reviewed plan requires renewed review before execution.
2. Support create, replace, delete, set a heading section, set a JSON key and append a line once.
   A selected delete records the original hash, keeps a recoverable backup and has an explicit absent proposed state.
   An empty replacement is not a deletion.
   Reject ambiguous headings, duplicate keys, overlapping edits and unsupported formats.
   Stage complete proposed file bytes before writing any target.
3. `apply --plan <file> --dry-run` validates all inputs, selections, targets and original hashes, then prints the exact diff.
   Validation failure leaves all project files unchanged.
4. `apply --plan <file>` revalidates the reviewed plan and all target files before the first write.
   Save originals and a durable journal in scratch before replacing a target.
   Use atomic replacement per file where supported, and report the filesystem limitation where it is not.
   Do not claim atomic replacement of the entire multi-file change set.
5. Journal each edit's original and proposed hash before replacement, then record completion after replacement.
   If the process stops between replacement and journal completion, resume derives the state from the actual target hash.
6. Implement hash-derived resume and user-change protection according to the [apply recovery contract](command-contract.md#apply-dry-run), preserving completed edits and recoverable backups.
7. Verify completed-plan repetition and pending journal recovery against that same contract.
8. `state show --run <id>` reports pending, applied and conflicting edits plus affected checks that must rerun.
   On an I/O failure, stop, preserve the journal and report applied and pending files accurately.
9. For unsupported edits, the agent proposes a reviewed whole-file replacement using the same preconditions and checks.
   Apply the rendered audit record from T2.5 through that interface.

**Done when**

- Invalid schema, unresolved scope, unselected finding, traversal, escaping links and changed preconditions produce no project writes.
- Fault injection before a write, after replacement and before journal completion preserves a recoverable state.
- Resume and repeated execution recognise proposed hashes and do not duplicate content.
- A user edit to a pending or completed file blocks resume, preserving that edit and all other files.
- A selected delete passes dry run, collision, interrupted deletion and repeat controls, and a file the user recreates after deletion blocks resume.
- Unrelated uncommitted work remains untouched, and selected edits preserve the existing user journey.

**Covers:** AC-54, AC-57, AC-69, AC-70, AC-72.

### T2.7 Build verification capture and live probes

**Depends on:** T2.6.

**Inputs and outputs:** Approved check plan and change kind -> captured checks, prior protection and probe pairs.

**Verification:** `npm test -- --task T2.7`.

**Read:** design "Verification requirements" and "Script contract".

**Steps**

1. `run-checks --plan <file>` runs each declared command with an argument array.
   It records each command's exit code, output tail and tool version, with one fingerprint of all declared inputs before and one after the run.
2. A required check that fails or is skipped makes the overall result `failed` or `blocked`, never `passed`.
   Any difference between the run's input fingerprints makes the entire capture `blocked: inputs changed during run`.
3. Each check names the acceptance cases it covers. A result that covers no user journey is reported as such, and user-flow checks that could not run stay "unverified".
4. Record and compare live probes using the [live-probe command contract](command-contract.md#live-probe-pairs).
   Comparison fails when a change that depends on outside behaviour has no `before` probe, or no `after` probe that repeats it.
5. A probe marked as having side effects needs `--approved-by-user`.
   Without it, `probe record` refuses.
6. A bug fix needs a recorded reproduction against the pre-change state.
7. A refactor needs passing protective checks against the pre-change state, and compatibility checks after structural changes.
   Record the original state and execution order so a post-change result cannot pretend to be prior protection.
8. Define the check-plan schema, source acceptance pointers and probe records before implementing these commands.
   A before-and-after probe pair must identify the same command, endpoint and relevant environment.
   Approval is recorded for the specific side-effecting call, not assumed from an unrelated flag.

**Done when**

- On `ts-shop`, unit tests pass but the end-to-end check fails, and the overall result is not ready.
- On `ts-shop`, a probe against the local stand-in server disagrees with the mock, and the result is not ready.
- The task suite refuses a side-effect probe without approval and marks an unavailable probe unverified with its reason.
- A refactor without prior protective evidence is rejected.
- A protected refactor passes only after compatibility checks run against the changed state.
- Failing, skipped, cancelled, timed-out and stale required checks cannot produce a passed result.

**Covers:** AC-26, AC-27, AC-29, AC-30, AC-31, AC-32, AC-33, AC-71.

### T2.8 Complete the existing-repo audit and apply path

**Depends on:** T2.7 and T3.1.
T3.1 supplies the enforcement and architecture references that recommendations load (design "Load only what each step needs").

**Inputs and outputs:** Existing repo fixtures and approved findings -> audited, selected and verified foundation changes.

**Verification:** Existing-repo and clear-goals foundation-stage procedures from T1.2.

**Read:** design "Existing-repo path", "Establish VISION.md" (existing repo) and "Files the skill maintains".

**Steps**

1. Complete the existing-repo steps in `SKILL.md` in this order: `inspect`, `inventory`, research briefs, `cite-check`, evidence summary, a targeted interview only for gaps that change a recommendation, findings, user selection, `apply`, `run-checks`, and the audit record.
2. When the repo already has an approved vision, the steps propose a reviewed change to it only when the audit found a real gap.
3. A selected instruction merge moves equivalent repo-owned `CLAUDE.md` content into `AGENTS.md` and removes the `CLAUDE.md` only through `apply`, using the selected delete from T2.6.
   Scoped, local and ancestor instruction files are reported as `inventory` classified them and are never modified.
4. Run the existing-repo and clear-goals scenarios in `with` mode.

**Done when**

- On `clear-goals`, the agent reaches recommendations without asking about goals the repo states, and, where the agent shows which files it opened, never opens the VISION, interview or domain-language references.
- A reviewed existing-vision delta scenario proposes a change to the approved vision instead of replacing it, scored against a written rubric.
- On `ts-shop`, discovery runs before any question, and each question names the recommendation it affects.
- `ts-shop` and `py-ledger` receive different recommendations that fit their own goals.
- The reviewed audit record is applied safely and current native user-flow checks preserve the existing journey.
- The checkpoint names later enforcement and maintenance as pending.
- T4.3 owns the representative-extension proof against the completed package.

**Covers:** AC-5, AC-6, AC-7, AC-38, AC-55, AC-62.

### T2.9 Complete protected new-project creation

**Depends on:** T2.8.

**Inputs and outputs:** Approved scratch intent and selected destination -> minimal repo and first-journey evidence.

**Verification:** `npm test -- --task T2.9`, then new-idea foundation-stage procedures.

**Read:** design "New-project path", "Project-specific foundation" and this plan's workspace contract.

**Steps**

1. Complete the foundation proposal and user selection after the intent checkpoint.
   The owner selects the destination, stack, minimal scaffold and first user journey before target creation.
2. Add `project create --workspace <path> --plan <file> --dry-run` and its versioned input schema.
   The plan contains the approved destination, selected findings, complete generated file payloads and declared setup commands.
   Resolve the existing parent and require an absent destination, or an explicitly selected empty directory.
3. Build the proposed scaffold in scratch and show its exact file diff before the approved creation call.
   Validate links, payloads and required prerequisites before creating any destination files.
4. `project create --workspace <path> --plan <file>` uses the protected-write engine from T2.6.
   Journal directory creation and files, then run `git init` only at the reviewed destination.
   Never adopt an existing nonempty directory or set global Git options.
   Interruption leaves a recoverable run under the [creation recovery contract](command-contract.md#protected-project-creation).
5. Write the approved vision, confirmed glossary and selected foundation through that same plan.
   Record setup or first-journey failures as unverified, retaining the created project for recovery.
6. Run the new-idea and ambiguous-idea scenarios with `--stage foundation`.
   Finish the selected first user journey using the new project's native commands.

**Done when**

- The approved new idea produces a minimal Git repo at the reviewed destination, with an approved `VISION.md`.
- Malformed input, an unresolved decision and a destination collision cause no target changes.
- Interrupted creation resumes without duplication or loss of user edits.
- The first user journey passes, and the record identifies later enforcement and maintenance as pending.

**Covers:** AC-1, AC-2, AC-9, AC-12.

## Phase 3: Enforcement

Phase evidence from the design: valid cases pass, and seeded violations fail through the maintained command in disposable local copies.

### T3.1 Write the enforcement and architecture references

**Depends on:** T1.3 and T0.3.
Complete it before T2.8, which loads these references when it recommends principles and boundaries.
This early checkpoint demonstrates useful references only, without claiming that rule-proof or maintenance exists.
Native rule implementation stays in T3.2 to T3.4, and any reference revision that rule-proof results require lands with T3.2 in merged slice C19 alongside T3.3.

**Inputs and outputs:** Approved principles and architecture sources -> enforcement and architecture references.

**Verification:** `npm run check`, then the prohibited-routing and tool-preset searches below.

**Read:** design "Principles that become checks", "Architecture for independent changes" and "Coding standards without duplicate rules".

**Steps**

1. Write `references/enforcement.md`: the principle record (reason, scope, source, enforcement, exception policy), the example mappings, the proof rule, debt control, and one source per rule.
2. Write `references/architecture.md`: the principles table, what the audit inspects, the signals that are not violations, and the boundary rules.
   Name no language tools.
   The language research brief selects them.
3. Keep verification guidance as evidence requirements.
   Nothing in the skill dispatches a TDD skill or a development playbook.

**Done when**

- `npm run check` passes, including the tool-list deny rule.
- A search of the skill folder for "red-green", "playbook" as an instruction, and calls to other skills finds nothing.

**Covers:** AC-14, AC-25, AC-47, AC-59.

### T3.2 Build `rule-proof`

**Depends on:** T2.9 and T3.1.

**Inputs and outputs:** Native researched rules and clean variants -> valid and violation proof artifacts.

**Verification:** `npm test -- --task T3.2`, then both native-stack rule-proof procedures.

**Read:** design "Verify enforcement".

**Steps**

1. `rule-proof --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text>` reads a child-command object.
   Start from the clean rule-proof fixture variant.
   Use separate disposable copies for the valid case and each violation.
   Expect exit 0 for the valid case and a non-zero exit with the specific diagnostic for the violation.
   An unavailable tool or setup failure is blocked, not proof that a rule rejected the violation.
2. Run it on both language stacks with the native tools selected by research.
   Cover private imports, alias or equivalent resolution bypasses, and forbidden cycles in each stack.
   Include valid public imports and permitted dependency direction as positive controls.

**Done when**

- Each seeded rule on both fixtures passes `rule-proof`.
- The `py-ledger` rules use Python tools, with no JavaScript lint assumption.

**Covers:** AC-52, AC-60, AC-66.

### T3.3 Build debt baseline handling

**Depends on:** T3.2.

**Inputs and outputs:** Visible existing violations and selected exceptions -> shrinking native or custom baseline.

**Verification:** `npm test -- --task T3.3`.

**Read:** design "Control existing debt".

**Steps**

1. Use the native tool's baseline or suppression feature where the research found one.
2. Otherwise, write `schemas/baseline.schema.json` and the `baseline check` command.
   Each entry has a rule, a path, a key, a reason and a removal condition.
3. A violation not in the baseline fails.
   An entry with no matching violation must be removed, so the baseline only shrinks.
4. Adding an entry needs `--finding <id>` for a selected finding. A plain refresh cannot add entries.

**Done when**

- `npm test` shows a new violation failing, a fixed violation forcing the entry's removal, and a refresh without a finding refusing to add entries.

**Covers:** AC-67.

### T3.4 Integrate scoped checks with the maintained local command

**Depends on:** T3.3.

**Inputs and outputs:** Selected native checks -> scoped maintained command and local disposable-copy evidence.

**Verification:** `npm test -- --task T3.4`, then the disposable local-copy procedure.

**Read:** design "Keep the contract small" (last three paragraphs) and "Commissioning decisions (2026-10-07)".

**Steps**

1. Selected checks go into the project's existing check command through `apply`.
   Mark the selected command paths in each edit's `checkIntegration`; the reviewed digest binds those paths with the proposed bytes.
   When the project selects CI, the same command also goes into its CI config through `apply`, as an optional integration.
   Selected CI edits use JSON syntax, which is valid YAML, with exact `run` or `script` paths; unrelated YAML edits are not parsed by integration validation.
2. `apply` rejects a command or CI edit that ignores a failure, such as `continue-on-error: true` or `|| true` on a check command.
3. In a repo with several packages, rules are scoped to the package they apply to.
4. Set up the initial documented debt baseline through selected findings before expecting an audited fixture to pass new rules.
   Prove each rule separately against the clean variants from T1.1, without treating unrelated existing debt as a new violation.
5. Execute the identical maintained command in separate disposable local copies for the positive and negative controls.
   No external test branch or hosted run is needed.
   Report the behaviour of any CI adapter example as unverified, because bstack does not execute hosted CI.

**Done when**

- On `ts-shop`, the exact same maintained command passes on a valid disposable copy and fails on a seeded violation copy, and the failure propagates to its exit code.
- The `web` package rule does not run against `core`.

The commissioning decisions retired the earlier criterion of a hosted CI run on a pushed test branch.

**Covers:** AC-58, AC-61.

## Phase 3a: Maintenance

Phase evidence from the design: unreviewed or stale input states fail, and relevant documents get an update or a checked no-impact explanation.

### T3a.1 Define the project contract

**Depends on:** T3.4, the maintained local check integration.

**Inputs and outputs:** Existing config capabilities and source pointers -> validated project contract.

**Verification:** `npm test -- --task T3a.1`.

**Read:** design "Keep the contract small".

**Steps**

1. Write `schemas/project.schema.json`, version 1, from the named input contract.
   Include documents, scopes, rules, leaf child commands, generators and acceptance-source pointers.
   Define repo-relative glob matching, rename handling and path case rules.
   The contract location is explicit through `--contract <path>`, defaulting to `.bstack/project.json`.
   Add adapters only for existing config formats that can express this contract without loss.
   An unsupported existing format is a coverage limit requiring a reviewed standalone contract.
2. Add `contract validate`.
3. The contract stores pointers and scope only.
   It never copies glossary definitions or standards text.

**Done when**

- `npm test` shows `contract validate` rejecting an unknown version, a missing path and a check with a shell string instead of a child-command object.
- The task suite rejects duplicate IDs, unknown check IDs, escaping scope paths and recursive aggregate check commands.

### T3a.2 Build `evidence collect`

**Depends on:** T3a.1.

**Inputs and outputs:** Explicit base and project contract -> complete changed paths and assessment skeleton.

**Verification:** `npm test -- --task T3a.2`.

**Read:** design "Change evidence contract".

**Steps**

1. `evidence collect --base <ref>` lists every changed path: committed since the base, staged, unstaged, new, renamed and deleted.
2. A repo with no commits compares against the empty tree. A base that does not exist returns `blocked`, never an empty pass.
3. It maps each path to candidate documents through the contract scopes, and lists unmapped paths.
4. It writes an assessment skeleton to scratch and returns its path.
5. Resolve `--base` to a commit and record that exact ID.
   With no commits, use `--base empty` and record the empty-tree comparison explicitly.
   A shallow clone missing the required base is blocked with the exact fetch prerequisite.
6. Recompute the complete inventory from Git and the working tree during validation, rather than trusting a supplied path list.

**Done when**

- `npm test` covers each kind of change, a repo with no commits and a missing base.

**Covers:** AC-19, AC-20.

### T3a.3 Build `evidence validate`

**Depends on:** T3a.2.

**Inputs and outputs:** Current diff, substantive assessments and previous policy -> fresh validated evidence.

**Verification:** `npm test -- --task T3a.3`.

**Read:** design "Change evidence contract", "What the agent must assess" and this plan's hash contract.

**Steps**

1. Define `schemas/evidence.schema.json` with repo identity, resolved base, inventory, candidate documents, unmapped-path assessments and substantive review inputs.
   Each document has `updated`, `no-impact` or `decision-needed`, with source citations and the changed behaviour identified.
2. `evidence validate --base <ref> --assessment <file> --contract <path>` recomputes the final inventory and candidate documents.
   Refuse missing assessments, omitted changed paths, unsupported comparison bases and stale substantive inputs.
3. An `updated` result needs the actual meaningful document delta.
   A timestamp-only, whitespace-only or comment-only edit does not establish that an asserted definition or rule was updated.
   Structural validation reports the limits of proving semantic correctness.
4. Required automated checks need captured execution records matching their inputs.
   Unresolved dependent decisions produce a blocked result even when every executable check passes.
5. Build fingerprints from the shared hash contract, including substantive assessment data but excluding derived fingerprints and execution fields.
   Editing a no-impact reason invalidates its review binding.
   Generating or replacing execution output does not cause a self-referential hash.
6. Read the previous contract from the comparison base and the proposed contract from the current tree.
   Validate coverage and required checks against both, including deleted scopes, changed config locations and changed check code.
   An initial contract needs an explicit selected foundation finding.
   An unavailable previous contract or unsupported previous version is blocked, with a named prerequisite.
7. Acceptance-source edits need a decision entry naming the source, old case, approved new case and affected work.
   An agent-authored replacement cannot silently redefine the expected result.

**Done when**

- Tests cover every failure above, including a contract that removes its own coverage and a forged incomplete inventory.
- The internal-fix fixture passes with a specific no-impact reason and no cosmetic document edits.
- Editing code, an assessment reason or an acceptance source invalidates affected results.
- A decision-needed result stays blocked and a completed unchanged assessment has a stable fingerprint.

**Covers:** AC-16, AC-17, AC-19, AC-21, AC-22, AC-28.

### T3a.4 Build generated-fact freshness checks

**Depends on:** T3a.3.

**Inputs and outputs:** Registered generators and source commands -> checked generated sections.

**Verification:** `npm test -- --task T3a.4`.

**Read:** design "What machines can check".

**Steps**

1. `docs generate --check` uses generators registered in the project contract.
   Each generator names a child command, document path, unique marker ID and authoritative input scope.
   Find sections between `<!-- bstack:generated <check-id> -->` and `<!-- bstack:end -->`, then compare generated bytes.
   Reject duplicate, nested or unmatched markers.
   A generator that changes project files during a check is a failed read-only contract.
2. Without `--check`, render proposed sections to scratch and apply them through a selected reviewed change set.
   Regeneration does not bypass finding selection, original hashes or exact diff review.

**Done when**

- `npm test` shows a stale section failing and passing after regeneration.

**Covers:** AC-18.

### T3a.5 Build document reference checks

**Depends on:** T3a.4.

**Inputs and outputs:** Document sources and selected relocation -> reference checks and protected rule move.

**Verification:** `npm test -- --task T3a.5`.

**Read:** design "Validate document references" row and "Glossary requirements".

**Steps**

1. `docs check` verifies registered paths and local links, and parses supported glossary formats.
2. It reports duplicate terms within one context only.
   The same word in two contexts is allowed.
3. An unsupported format is a coverage limit, not a failure.
4. Add a `move-rule` operation to `apply`.
   Define an unambiguous source rule, selected destination and exact link replacement.
   Prefer an existing authoritative standards source over creating `CODING_STANDARDS.md`.
   Validate both file changes together before writing either file.

**Done when**

- `npm test` shows a duplicate term in one context failing, the same term in two contexts passing, and `move-rule` leaving one copy and one link.

**Covers:** AC-13, AC-15.

### T3a.6 Build and prove the standalone checker in a clean checkout

**Depends on:** T3a.5.

**Inputs and outputs:** Shared validators, schemas and clean-checkout input policy -> standalone checker and clean-clone evidence.

**Verification:** `npm test -- --task T3a.6`, then the clean-checkout procedure.

**Read:** design "Keep the contract small" and this plan's clean-checkout contract below.

**Steps**

1. Build `skills/repo-audit/scripts/bstack-check.mjs` as one dependency-free file from the same validator sources used by the command interface.
   Include its needed schemas and build version so the installed checker needs no skill folder.
   A freshness check compares the generated file with its source modules and embedded schemas.
2. Install it through a selected `apply` plan at `.bstack/bin/bstack-check.mjs`.
3. Expose `node .bstack/bin/bstack-check.mjs --repo <path> --base <ref> --assessment <file> [--contract <path>]`.
   Repo, comparison base and assessment are explicit, with no search of a developer's cache.
4. Separate validation into input preflight, leaf command execution and result validation.
   Preflight checks the contract, inventory, document assessments, source links and generated facts.
   The checker executes each required leaf check exactly once and captures current evidence.
   Final validation uses those current results and the substantive reviewed assessment.
   An execution record saved earlier cannot substitute for the current clean-checkout run.
5. Use one project aggregate command that calls this checker.
   Contract leaf checks cannot call that aggregate command or the checker again.
   Validate check dependencies for cycles and reject obvious direct self-invocation before execution.
6. Run the checker in a clean checkout using the clean-checkout contract below.
   When a change modifies the checker or its coverage policy, run the checker from the comparison base against the proposed target tree as well.
   Extract that previous standalone checker to clean-checkout scratch and pass the target repo and assessment explicitly.
   Resolve previous contract paths from the base, including a deleted or moved current config.
   An incompatible prior checker requires a recorded migration decision and explicit coverage, rather than silently skipping prior-policy validation.
   Run the same structural validation and leaf checks in the working checkout and the clean checkout.
7. When a target project selects CI, extend its CI configuration from T3.4 through `apply` as an optional integration.
   bstack does not execute hosted CI, so that adapter's hosted behaviour is reported unverified.

**Done when**

- A disposable fixture cloned into a different root, with an isolated home and cache, no installed skill or agent, an explicit base and a committed assessment, passes with a complete assessment and freshly executed leaf checks.
- Seeded stale documents, absent records, missing bases, failed leaf checks, saved earlier successes and recursive commands cannot pass.
- A shallow checkout missing its comparison commit is blocked until the documented fetch step runs.
- A contract-removal change fails under its previous coverage policy, including when it edits the checker source or configuration.
- The generated validator is current, and the clean-checkout run records its own execution results without editing the committed assessment.
- No hosted run is required.

**Covers:** AC-24, AC-58.

### Clean-checkout contract

Select a committed assessment path when the project's selected delivery path needs portable review evidence.
Local-only reviews can keep evidence in scratch, but cannot claim clean-checkout assessment coverage.
The caller passes the assessment path, source revision and comparison base explicitly.
If several records cover the same change, require an explicit selection instead of guessing the newest one.

Use explicit source and base objects.
Compute their merge base, record that computation, and require it to match the assessment's comparison base.
After a rebase or a base-branch change, refresh the assessment before claiming success.
For a new repo, use the explicit empty-tree mode.

Missing base objects, an absent assessment or unsupported prior policy block the run.
The checker does not silently fetch a different base or fall back to an empty passing diff.

Optional CI adapter notes remain for target projects that select CI.
For a GitHub pull request, the adapter checks out the submitted head and fetches the base branch commit before the same merge-base computation.
For push builds, it passes the configured previous commit or comparison policy explicitly.
Other CI systems document the equivalent source refs in their adapter.
Required merge checks remain a separate owner-approved shared-system setting.
A changed workflow can omit its own checker, so the helper alone cannot guarantee that every change runs the gate.
Report that execution boundary as unverified, and never claim enforced forge protection.

For bstack itself, the chosen delivery gate is the no-mistakes pipeline described under "Delivery gate".

### T3a.7 Write the maintenance reference

**Depends on:** T3a.6.

**Inputs and outputs:** Completed maintenance commands -> maintenance guidance and isolated scenario evidence.

**Verification:** `npm run check`, then the maintenance-only procedure from T1.2.

**Read:** design "Keeping project guidance current".

**Steps**

1. Write `references/maintenance-contract.md`: when to collect evidence, how to assess each candidate document, what counts as a no-impact reason, and when a decision is needed.
2. State that routine maintenance does not repeat the goal interview or the full audit.
3. Describe local and standalone checker validation, and how to supply its evidence to the project's selected delivery gate, without assuming a CI.

**Done when**

- `npm run check` passes.
- A maintenance scenario on `ts-shop` in `with` mode completes without an interview or a full audit.

**Covers:** AC-23.

## Phase 4: Installation

Phase evidence from the design: a clean install runs in the current agent and protects user edits.

### T4.1 Build the installer

**Depends on:** T3a.7.

**Inputs and outputs:** Complete skill and pinned runtime -> tested installer, ownership and recovery records.

**Verification:** `npm test -- --task T4.1` and `node scripts/check-package.mjs --skill <installed-folder>`.

**Read:** design "Installation and host contract" and this plan's child-command contract.

**Steps**

1. Define install, update and removal inputs before writing `install/install.mjs`.
   Options are `--scope user|project`, `--project <path>`, `--host claude|agents|all`, `--link`, `--dry-run` and `--uninstall`.
2. Validate prerequisites, destination paths and source package closure before mutations.
   Read the exact Git tag, and label an untagged development checkout explicitly.
3. `--dry-run` prints all file and link changes without writing files, installing dependencies or altering ownership records.
4. A first install into an occupied unowned skill folder is blocked.
   Never adopt or overwrite unrelated files merely because their names match package files.
5. For copy mode, stage the complete skill outside the destination and run the pinned runtime install there.
   Use the Windows npm adapter from T0.4.
   Validate the staged package, then apply the installation with a recoverable journal.
6. Record mode, source version, destination and exact owned file hashes in `.bstack-install.json` outside the installed skill folder.
   Do not include mutable caches, backups or installed dependency contents in the authored-file ownership list.
   Track the created dependency directory separately so removal cannot adopt a pre-existing directory.
7. Updates replace unchanged owned files and remove obsolete owned files only when their hashes still match.
   For edited or newly conflicting files, preserve them, show the diff and request the specific replacement decision.
   Without an interactive terminal, preserve conflicting files and return `blocked` with a partial-install report.
   Record the actual mixed state and do not claim that every file has the new version.
8. Uninstall removes unchanged owned files and the runtime directory created by the installer.
   Preserve edited files and unowned content, reporting retained paths.
   Keep enough ownership data for a later explicit cleanup decision.
   A removal with retained owned files is blocked rather than reported as complete.
9. For `--link`, install a directory symlink or Windows junction to the source skill folder.
   Initialise its pinned runtime before activating the link, with the source mutation stated in the preview.
   A repeated link install verifies the same source and destination without changing source files unnecessarily.
   Removal unlinks only the owned link, never recursively deletes its target.
   Updating a linked checkout is an explicit developer action and is reported as link mode, rather than a copied release.
10. Interrupted installation resumes from verified actual hashes, preserving unrelated destination content.
    Build isolated release snapshots for install tests without requiring the real release tag to exist.

**Done when**

- Tests cover copy and link modes, first-install collisions, dry run, repeat, update, obsolete files and removal.
- Edited files, unrelated content and link targets survive update and uninstall.
- Runtime-install failure and interrupted installation leave recoverable state and a non-passing result.
- The same tests pass in isolated homes in one recorded real local or manual run on each of Windows, macOS and Linux, without GitHub Actions.
  Local Node 24 and Node 26 runs supplement these, and a Linux run does not substitute for another operating system.
- `node scripts/check-package.mjs --skill <installed-folder>` validates a clean copy installation.

**Covers:** AC-73, AC-74.
AC-74 stays blocked until all three operating-system runs are recorded, unless the owner explicitly changes the support scope.

### T4.2 Run the basic tests in the current agent

**Depends on:** T4.1.

**Inputs and outputs:** Installed package and current host -> invocation and file-loading evidence.

**Verification:** Fresh explicit and implicit invocation procedures from T1.2.

**Read:** design "Installation and host contract" and "Load only what each step needs".

**Steps**

1. Install into a fixture project with the installer.
2. Ask "audit this repo" without the explicit command.
   Then start the skill with the explicit command.
3. Where the agent shows which files it opened, compare them to the "load when" table.
   Record the host, its available capabilities and what was actually observed.
   Never infer a loading trace from prose compliance.
4. Confirm the run needs no router, akashic or no-mistakes.

**Done when**

- The plain request does not start the skill, and the explicit command does.
- Where the host shows which files the agent opened, every opened file matches a "load when" condition, and no script source or board asset was read.
  Where it does not, the loading cases stay blocked with that limitation recorded.
- The results are recorded in `tests/eval/results/` with the agent and model.

**Covers:** AC-39, AC-40, AC-42, AC-43, AC-56, AC-75.

### T4.3 Prove both complete paths and a representative extension

**Depends on:** T4.2.

**Inputs and outputs:** Complete installed package and scenarios -> final full-path and extension evidence.

**Verification:** Final-stage full-path, repeated-audit and extension procedures from T1.2.

**Read:** design "New-project path", "Existing-repo path", "Reusable guidance for future changes" and "Acceptance cases".

**Steps**

1. Run both full paths through the release installer in fresh isolated fixtures, with `--stage final`.
   Complete intent, findings, selection, protected writes, native enforcement and maintenance evidence.
2. Re-audit a previously maintained fixture and verify that approved guidance remains authoritative without duplicates or lost user edits.
3. Run a representative extension on `ts-shop` using only the target repo's resulting guidance and checks.
   The extension must locate the approved example, use intended interfaces and exercise the agreed user journey.
4. Run a maintenance-only scenario without the interview or full audit.
5. Record script tests, agent transcripts, manual verdicts, completed installer transcripts and fresh clean-checkout checker artifacts under their acceptance IDs.
   A final result cannot cite a partial checkpoint as proof that a full path works.

**Done when**

- Both complete paths pass in the current agent using the complete installed package.
- The extension passes maintained constraints and the user journey using the intended interface.
- Repeat audit preserves user changes, and routine maintenance avoids the full audit and interview.
- All final agent procedures have fresh scored transcripts and named evidence artifacts.

**Covers:** AC-1, AC-3, AC-23, AC-54, AC-64, AC-69, AC-75.

## Phase 5: Release

Phase evidence from the design: release evidence covers every acceptance case.

### T5.1 Write worked examples and limitations

**Depends on:** T4.3.

**Inputs and outputs:** Verified fixture results -> worked examples, installation instructions and limits.

**Verification:** `npm run check` and `npm test, then example-to-result review`.

**Read:** design "Evidence and limitations".

**Steps**

1. Run the skill on each fixture and save a short worked example in `docs/examples/`: the request, the findings, the selection and the result.
2. Write the limitations in `README.md`: what scripts cannot prove, the Claude Code version limit for `AGENTS.md`, and that tests ran in one agent and model.
   State the actual operating system, Node and agent runs behind the evidence, and that hosted CI behaviour is unverified.
3. Write the install and use instructions in `README.md`.

**Done when**

- Each fixture has a worked example.
- `npm run check` and `npm test` pass.

### T5.2 Final evaluation and release

**Depends on:** T5.1.

**Inputs and outputs:** All case evidence and comparable agent runs -> validated release evidence and approved tag.

**Verification:** `npm run check` and `npm test` and `node scripts/acceptance.mjs --results tests/eval/results --require-complete`.

**Read:** design "Acceptance cases" and "Model-agnostic by design".

**Steps**

1. Run every scenario in `with` mode at its final stage.
   Each must pass under the design's pass rule.
   Ensure each scenario also has a comparable baseline from the same scoring criteria and fixture revision.
2. Run `node scripts/acceptance.mjs --results tests/eval/results --require-complete`.
   Require passing evidence for all 75 design cases as amended by the commissioning decisions, including AC-24 as a clean-checkout case and AC-74 with three real operating-system runs.
   Require baseline and final comparisons for every evaluation scenario.
   Cases that already passed without the skill must still pass with it.
   Fill the coverage table with actual evidence paths.
   A blocked, skipped or missing procedure cannot be waived by ticking a task.
3. Ship the final evidence through the no-mistakes gate, and include that gate run and the landed commit in the release evidence.
4. Ask the owner to approve the tag `v0.1.0` and a GitHub release.
   Then create the tag and the GitHub release manually.
   No tag-triggered workflow runs, and nothing is published to npm.

**Done when**

- Every acceptance case has a passing result in the coverage table.
- The owner has approved, and the tag and its GitHub release exist on GitHub.

**Covers:** AC-46.

## Acceptance case coverage

Every acceptance case in the design has an owner task.
The design remains the source of each expected outcome.
The table below assigns procedures, rather than asserting that evidence already exists.

For each ID, `tests/acceptance/cases.json` names a concrete test or scenario check, its fixture and its expected result source.
Automated procedures name the test title and file, with positive and negative controls where relevant.
Agent and manual procedures name the scenario check and the transcript or board artifact needed to score it.
The runner verifies that a named test actually executed, rather than accepting a zero-test exit code.
Every result records passed, failed or blocked, its relevant input revision and an existing artifact path.
T5.2 will add `scripts/acceptance.mjs --require-complete` to reject missing case records, duplicate final evidence selections and unsupported success claims.
See the [evaluation contract](evaluation.md#registry-and-final-selections) for the available registry and selection validation.
Repeated execution artifacts with unique run IDs are legitimate history, and the validator prefers the explicitly selected fresh final evidence over stale earlier runs.

Fill in the "Evidence" column in T5.2.
Registry completeness is a structural check, while final case evidence proves execution.

| Task | Acceptance cases | Required procedure | Evidence |
|---|---|---|---|
| T0.5 | AC-41, AC-44, AC-45, AC-47 | Seeded package failures, valid package and installed-package closure | |
| T1.6 | AC-3 | Board launch, verdict-to-draft update and resumed review | |
| T1.7 | AC-2, AC-9, AC-12 | Intent-stage transcripts, blocked decision and confirmed term review | |
| T2.1 | AC-34, AC-35, AC-36, AC-37, AC-48 | Discovery-only briefs in both modes, wrong citations and no-web run | |
| T2.2 | AC-4, AC-68 | Read-only inspection and unavailable prerequisites | |
| T2.3 | AC-10, AC-11, AC-49 | Authoritative source discovery, equivalent names and instruction merge candidate | |
| T2.4 | AC-50, AC-51, AC-53 | History-backed signals, false-positive controls and shared-write plans | |
| T2.5 | AC-8, AC-63, AC-65 | Findings schema tests and principle-conflict report review | |
| T2.6 | AC-54, AC-57, AC-69, AC-70, AC-72 | Invalid plans, dirty work, interrupted writes, resume and repeat | |
| T2.7 | AC-26, AC-27, AC-29, AC-30, AC-31, AC-32, AC-33, AC-71 | Bug reproduction, pre-refactor protection, user flows and probe pairs | |
| T2.8 | AC-5, AC-6, AC-7, AC-38, AC-55, AC-62 | Audit-before-interview and project-specific findings in both stacks | |
| T2.9 | AC-1, AC-2, AC-9, AC-12 | Approved creation, unresolved decision and destination-collision controls | |
| T3.1 | AC-14, AC-25, AC-47, AC-59 | Authority reuse and absence of tool presets or development routing | |
| T3.2 | AC-52, AC-60, AC-66 | Valid and private-import, alias-bypass and cycle cases in both stacks | |
| T3.3 | AC-67 | New debt rejection, removed debt and unauthorised baseline growth | |
| T3.4 | AC-58, AC-61 | Same maintained command on valid and violation disposable local copies, failure propagation and package-scope controls | |
| T3a.2 | AC-19, AC-20 | Complete Git change inventory and invalid-base controls | |
| T3a.3 | AC-16, AC-17, AC-19, AC-21, AC-22, AC-28 | Before/after impact, no-impact, stale input and prior-policy bypass controls | |
| T3a.4 | AC-18 | Stale generated sections and checked regeneration | |
| T3a.5 | AC-13, AC-15 | Context-specific terms and reviewed rule relocation | |
| T3a.6 | AC-24, AC-58 | Different-root clean clone, missing evidence, shallow base and fresh leaf execution | |
| T3a.7 | AC-23 | Maintenance-only transcript without interview or full audit | |
| T4.1 | AC-73, AC-74 | Copy/link lifecycle and conflict preservation, with one recorded real run on each of the three operating systems | |
| T4.2 | AC-39, AC-40, AC-42, AC-43, AC-56, AC-75 | Fresh explicit/implicit invocation and observed file-loading trace | |
| T4.3 | AC-1, AC-3, AC-23, AC-54, AC-64, AC-69, AC-75 | Final full-path transcripts, repeated audit and independent extension | |
| T5.2 | AC-46 | Comparable baseline/final results and all-case evidence validation | |
