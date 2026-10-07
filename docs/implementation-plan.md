# bstack: repo-audit implementation plan

This plan tells a build agent how to build the first release of bstack, the `repo-audit` skill, in order.
The design is [plan.md](plan.md), revision 25.
Implementation review applied on 2026-10-07, with owner approval to apply the recommendations.
This file specifies future build work, not evidence that bstack is implemented.

The design says what to build and why.
This plan says how to build it, in what order, and how each task proves it is done.
When this plan and the design disagree, the design wins.
Stop and ask the owner.

## Start here

Read this section before your first task.

### What you are building

`repo-audit` is one skill that only the user can start.
It audits an existing repo, or interviews the user about a new idea.
It then recommends project-specific principles, rules and checks, and applies the ones the user selects.
Everything it needs ships inside one folder, `skills/repo-audit/`.
The bstack repo also holds a package check, an installer, test fixtures, an evaluation runner and CI.

### How to work through this plan

1. Find the first unticked task whose prerequisites are complete.
   Use its "Depends on" field, not task numbering alone.
2. Read only the design sections that task lists under "Read".
   Do not read the whole design up front.
3. Do the steps in order.
4. Run its verification commands and every "Done when" check.
   Record results using the task evidence contract below.
   A missing prerequisite or unavailable live check leaves the task blocked.
5. Tick the task in "Progress", and commit with a conventional message, for example `feat(scripts): add inspect command (T2.2)`.
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

T0.1 defines this record's versioned format.
Later tasks reuse that format rather than adding separate completion logs.
No build task is complete merely because `npm test` exits zero with no relevant tests.
The final release validator checks actual case evidence, not only task ticks.

### Stop and ask the owner

Stop and ask before you do any of these:

- Create the public GitHub repo, push, create a tag or publish a release.
- Change a design decision in the decisions table at the end of the design.
- Resolve a contradiction between this plan and the design.
- Add a runtime dependency other than `lavish-axi`.

Record the answer in this plan or the design, then continue.

Licensing is out of scope.
Do not check upstream licences or raise licence questions (design R24).

### Conventions

- **Language.** bstack's own scripts are JavaScript ES modules (`.mjs`) on Node 24 or later (design D3).
- **Dependencies.** Scripts use Node built-in modules only.
The one runtime dependency is `lavish-axi` for the VISION board.
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
The package check enforces this.
- **Tests.** Each script has tests in `tests/scripts/` that call it through its command interface, not its internal functions.

### Defaults this plan sets

The design leaves these choices to the implementation plan.
Change one only by editing this table with the reason.

| Topic | Default |
|---|---|
| Node version | Support Node 24 and later. CI tests Node 24 and Node 26. Recheck the Node release schedule in T0.6 |
| Script command | One entry point, `node skills/repo-audit/scripts/repo-audit.mjs <command> --repo <path>`. New-idea draft commands use `--workspace <existing-directory>` instead |
| Result format | One JSON envelope on stdout with `--json`, a short summary otherwise. Envelope in T0.4 |
| Exit codes | 0 passed, 1 failed, 2 blocked, 3 usage error |
| Scratch and resume state | Outside the target repo or new-idea workspace, in the OS cache folder: `%LOCALAPPDATA%\bstack\` on Windows, `~/Library/Caches/bstack/` on macOS, `$XDG_CACHE_HOME/bstack/` or `~/.cache/bstack/` on Linux. One subfolder per target, keyed by a hash of its real path, and one per run |
| Audit record | The project's existing audit record, otherwise `docs/repo-audit.md` (design "Files the skill maintains") |
| Project contract | `.bstack/project.json`, versioned schema, only when the project has no existing config that can hold it |
| Debt baseline | The native tool's own baseline or suppression feature where one exists. Otherwise `.bstack/baseline.json` |
| Change evidence record | Scratch for local review. A project that selects CI assessment validation commits `.bstack/evidence/<change-id>.json`, or an equivalent existing path, and passes that path explicitly to CI |
| Checker in a clean CI checkout | `apply` copies one dependency-free validator into the target repo as `.bstack/bin/bstack-check.mjs`, with the bstack version in its header. CI passes an explicit repo, base and assessment path to it |
| Fixtures | Built by a script into a temporary folder, with a scripted Git history. No nested Git repos are committed |
| Upstream sources | Raw copies at their pinned commits in `upstream/`, outside the skill folder. Adaptations live in `skills/repo-audit/` and are recorded in `NOTICE` |
| Step format in `SKILL.md` | Each step is a `### Step N: <name>` heading followed by a line that starts `Done when:` |
| Skill install folders | Claude Code: `~/.claude/skills/` and `.claude/skills/`. Codex and Pi: `~/.agents/skills/` and `.agents/skills/` |

### Shared command and input contracts

T0.4 establishes these contracts in `docs/command-contract.md`.
Each command's owning task adds its exact options, schema, valid input and invalid input before implementing it.
Examples and schemas are tested through the public command.
Unsupported schema keywords and unknown input fields fail closed, with a named problem and fix.

**Target and workspace.**
Repo commands require `--repo` and resolve a Git top level, including a repo with no commits.
Draft-only commands accept `--workspace` for an existing directory that need not contain Git.
The two options are mutually exclusive.

Drafts and board verdicts go to scratch, not the workspace.
No draft command creates a repo or writes a foundation file.
T2.9 defines the separately selected creation operation.

**Result envelope.**
With `--json`, stdout contains exactly one JSON object and child output goes to captured artifacts.
The versioned envelope is `{ schemaVersion, command, status, problems, data, inputs }`.
Status is `passed`, `failed`, `blocked` or `usage-error`, matching exit codes 0, 1, 2 and 3.
Each problem has `code`, `message`, `fix` and an optional `path`.
Missing prerequisites produce `blocked`, rather than an empty passing result.

**Child command.**
Use `{ executable, args, cwd, timeoutMs, versionArgs }`, with `args` as an array and `cwd` relative to the target.
Resolve the working directory inside the declared target before execution.
Default timeout is 120000 milliseconds, with an explicit override for long checks.
Capture bounded output, duration, exit code, signal, timeout and tool version.

Timeout or cancellation cannot produce a passing result.
Stop managed child processes and close output streams before returning.

Run Node entry points with `process.execPath` and an argument array.
For npm on Windows, resolve npm's JavaScript CLI entry point and invoke it with `process.execPath`.
Do not directly spawn `npm.cmd` or silently switch arbitrary project commands to `shell: true`.
An unsupported command-file launcher is blocked with an actionable prerequisite.

Tests cover paths with spaces, Unicode, metacharacters and arguments that must remain literal on all three operating systems.

Evidence: a Windows Node `v24.16.0` probe returned `EINVAL` for direct `npm.cmd` execution.
The platform constraint is documented in [Node's child-process guide](https://raw.githubusercontent.com/nodejs/node/v24.0.0/doc/api/child_process.md).

**Hashes.**
Write preconditions use SHA-256 of exact file bytes, without line-ending normalisation.
Record both original and proposed hashes, including explicit absence for a new or removed file.
Evidence fingerprints include repo identity, resolved base commit, path, presence, file mode and content hash.
Include substantive assessment inputs as canonical JSON, omitting only derived fingerprints and execution result fields.
Do not hash the serialized evidence file into its own fingerprint.
Its path remains inventoried, and its substantive fields remain covered through canonical JSON.

**Named input formats.**
Every structured input declares `schemaVersion: 1`.
Use IDs to join records and reject missing or duplicate IDs.
Repo identity in local fingerprints uses the resolved local root.
Portable committed assessments instead identify the project and Git object state, with repo-relative paths.
CI validates the local root separately, so cloning into a different directory does not invalidate otherwise identical reviewed inputs.

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
T3.4 proves native CI checks, and T3a.6 adds maintenance validation to that CI.
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
  .github/workflows/ci.yml
  docs/
    design.md                    copy of plan.md, the design of record
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

## Progress

Tick each task when its "Done when" commands pass.

- Phase 0: Package contract
  - [ ] T0.1 Create the repo skeleton
  - [ ] T0.2 Create the skill skeleton
  - [ ] T0.3 Pin upstream sources and start NOTICE
  - [ ] T0.4 Build the shared script library
  - [ ] T0.5 Build the package check
  - [ ] T0.6 Add bstack's own CI
- Phase 1: Intent and vision
  - [ ] T1.1 Build the test fixtures
  - [ ] T1.2 Build the evaluation runner and record the baseline
  - [ ] T1.3 Write the first `SKILL.md`
  - [ ] T1.4 Bundle the interview and domain-language modules
  - [ ] T1.5 Adapt VISION and bundle the board assets
  - [ ] T1.6 Build the VISION board launcher
  - [ ] T1.7 Complete the intent and vision review
- Phase 2: Audit and foundation
  - [ ] T2.1 Write the research briefs and the citation check
  - [ ] T2.2 Build `inspect`
  - [ ] T2.3 Build `inventory`
  - [ ] T2.4 Build `measure` and `overlap`
  - [ ] T2.5 Build the findings schema and report
  - [ ] T2.6 Build protected writes and resume state
  - [ ] T2.7 Build verification capture and live probes
  - [ ] T2.8 Complete the existing-repo audit and apply path
  - [ ] T2.9 Complete protected new-project creation
- Phase 3: Enforcement
  - [ ] T3.1 Write the enforcement and architecture references
  - [ ] T3.2 Build `rule-proof`
  - [ ] T3.3 Build debt baseline handling
  - [ ] T3.4 Integrate checks with the project's CI
- Phase 3a: Maintenance
  - [ ] T3a.1 Define the project contract
  - [ ] T3a.2 Build `evidence collect`
  - [ ] T3a.3 Build `evidence validate`
  - [ ] T3a.4 Build generated-fact freshness checks
  - [ ] T3a.5 Build document reference checks
  - [ ] T3a.6 Build the checker for a clean CI checkout
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

1. Obtain approval for the public repo and create or clone `bstack`.
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
8. Copy the design and implementation plan into `docs/`, then correct their relative links to the new locations.
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

### T0.6 Add bstack's own CI

**Depends on:** T0.5.

**Inputs and outputs:** Root lockfile and passing local checks -> cross-platform CI workflow.

**Verification:** `npm ci` and `npm run check` and `npm test, then the recorded GitHub matrix run`.

**Read:** design "Build order and release proof" and the Node version default.

**Steps**

1. Check the Node release schedule at nodejs.org and confirm which majors are in LTS.
   Update the Node row in "Defaults this plan sets" if it changed.
2. Write `.github/workflows/ci.yml` for push and pull request.
   Use `ubuntu-latest`, `windows-latest` and `macos-latest`, with Node 24 and Node 26.
   Run root `npm ci`, `npm run check` and `npm test`.
   From T1.6 onward, also run `npm ci --omit=dev --prefix skills/repo-audit` before runtime checks.
3. No step may use `continue-on-error` or `|| true`.

**Done when**

- The workflow passes on all six combinations on GitHub.
Pushing needs the owner's approval the first time.

## Phase 1: Intent and vision

Phase evidence from the design: a new idea reaches an approved vision draft and resolved vocabulary in scratch, without project writes.

### T1.1 Build the test fixtures

**Depends on:** T0.6.

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

**Done when**

- `node tests/fixtures/build.mjs --all` builds every fixture and each `sanity` script passes.

### T1.2 Build the evaluation runner and record the baseline

**Depends on:** T1.1.

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
   Baseline and with-skill runs use the same fixture revision, agent, model and scoring criteria.
   Score deterministic checks from artifacts, and identify human-scored checks by reviewer and transcript location.
8. Register every design acceptance ID in `tests/acceptance/cases.json` with its owner task, procedure, criterion source and evidence type.
   Implement `scripts/acceptance.mjs --check-registry` for missing IDs, duplicate IDs, unknown tasks and invalid procedure definitions.
   It permits planned procedures whose implementation is pending, but never treats them as passed.
   Completed procedures must name an existing test or scenario and its evidence artifacts.
9. Add scenarios for a new idea, ambiguous idea, seeded existing repo, clear goals and implicit invocation.
   Add the maintenance and representative-extension scenarios before their owning tasks use them.
10. Run the initial scenarios in `without` mode and record actual results.
    Keep at least three scenarios from observed failures, as the design requires.
    If fewer fail, add realistic cases drawn from unmet requirements and rerun them.
    If there are still fewer than three, stop for an owner decision on that evaluation requirement.
    Never manufacture a failure, weaken a case or delete a requirement because the baseline passes.

**Done when**

- The runner's tests cover isolation, explicit versus implicit invocation, manual scoring and unique result paths.
- Every initial scenario has a baseline transcript and scored results.
- Three observed-failure scenarios exist, or the task remains blocked pending the recorded owner decision.
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
   Run `npm ci --omit=dev --prefix skills/repo-audit` now, and add that setup step to CI.
   Record a live launcher probe before adapting outside runtime behaviour.
3. Add the `vision-board` command with three subcommands:
   - `build --draft <file> --proposals <file>` fills the template.
   Escape every inserted value for HTML and for any script context.
   Validate that card IDs are unique.
   - `launch` starts the board.
   On failure, it reports the missing prerequisite and the fix, and keeps the draft in scratch.
   - `verdicts` reads returned verdicts tied to a run and draft revision.
    Reject unknown, duplicate or missing card IDs and verdicts from an incompatible draft.
    Apply approved verdicts to a new draft in scratch and preserve the previous draft for resume.
4. Test escaping with quotes, backticks, `<script>`, `&` and Unicode.
   Test a resumed review that reads an earlier run's verdicts.

**Done when**

- `npm test` passes the escaping and resume tests.
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
- A discovery-only checkpoint runs the research briefs with subagents and in the main thread.
- Both checkpoint records contain the same report format, verified citations and the mode that ran.
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
4. When any `CLAUDE.md` exists, including a stub that only imports `AGENTS.md`, `inventory` returns a candidate finding: merge into one `AGENTS.md`, with the Claude Code version limit from the design.

**Done when**

- On `py-ledger`, `CONTRIBUTING.md` is reported as the standards source and no failure is raised for a missing `CODING_STANDARDS.md`.
- On `ts-shop`, the `CLAUDE.md` stub produces the merge candidate.

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

**Done when**

- `npm test` shows `findings validate` rejecting a finding with no principle and one with an unknown status.
- `render` on a sample finding set produces a record that separates documented intent, observed behaviour and inferred intent.

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
2. Support create, replace, set a heading section, set a JSON key and append a line once.
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
6. On resume, an original hash means the edit is pending, and a proposed hash means the edit is already applied.
   Any other hash is a user change and blocks the run without further writes.
   Preflight every remaining file before continuing, preserving completed edits and recoverable backups.
7. A repeated completed plan returns an already-applied result with no writes.
   A changed plan digest or target cannot reuse an earlier run's completion flags.
8. `state show --run <id>` reports pending, applied and conflicting edits plus affected checks that must rerun.
   On an I/O failure, stop, preserve the journal and report applied and pending files accurately.
9. For unsupported edits, the agent proposes a reviewed whole-file replacement using the same preconditions and checks.
   Apply the rendered audit record from T2.5 through that interface.

**Done when**

- Invalid schema, unresolved scope, unselected finding, traversal, escaping links and changed preconditions produce no project writes.
- Fault injection before a write, after replacement and before journal completion preserves a recoverable state.
- Resume and repeated execution recognise proposed hashes and do not duplicate content.
- A user edit to a pending or completed file blocks resume, preserving that edit and all other files.
- Unrelated uncommitted work remains untouched, and selected edits preserve the existing user journey.

**Covers:** AC-54, AC-57, AC-69, AC-70, AC-72.

### T2.7 Build verification capture and live probes

**Depends on:** T2.6.

**Inputs and outputs:** Approved check plan and change kind -> captured checks, prior protection and probe pairs.

**Verification:** `npm test -- --task T2.7`.

**Read:** design "Verification requirements" and "Script contract".

**Steps**

1. `run-checks --plan <file>` runs each declared command with an argument array.
   It records the exit code, output tail, tool version and the input fingerprint for each.
2. A required check that fails, is skipped or has a fingerprint that no longer matches makes the overall result `failed` or `blocked`, never `passed`.
3. Each check names the acceptance cases it covers. A result that covers no user journey is reported as such, and user-flow checks that could not run stay "unverified".
4. `probe record --name <n> --phase before|after -- <command>` records a live probe and its result. `probe compare` fails when a change that depends on outside behaviour has no `before` probe, or no `after` probe that repeats it.
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

**Depends on:** T2.7.

**Inputs and outputs:** Existing repo fixtures and approved findings -> audited, selected and verified foundation changes.

**Verification:** Existing-repo and clear-goals foundation-stage procedures from T1.2.

**Read:** design "Existing-repo path" and "Establish VISION.md" (existing repo).

**Steps**

1. Complete the existing-repo steps in `SKILL.md` in this order: `inspect`, `inventory`, research briefs, `cite-check`, evidence summary, a targeted interview only for gaps that change a recommendation, findings, user selection, `apply`, `run-checks`, and the audit record.
2. When the repo already has an approved vision, the steps propose a reviewed change to it only when the audit found a real gap.
3. Run the existing-repo and clear-goals scenarios in `with` mode.

**Done when**

- On `clear-goals`, the agent reaches recommendations without asking about goals the repo states, and never opens the VISION, interview or domain-language references.
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
   Interruption leaves a recoverable run, and unrelated files block continuation without overwriting them.
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

Phase evidence from the design: valid cases pass, and seeded violations fail locally and in CI.

### T3.1 Write the enforcement and architecture references

**Depends on:** T2.9.

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

**Depends on:** T3.1.

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

### T3.4 Integrate checks with the project's CI

**Depends on:** T3.3.

**Inputs and outputs:** Selected native checks and target CI -> scoped maintained command and actual CI evidence.

**Verification:** `npm test -- --task T3.4`, then the approved disposable-branch CI procedure.

**Read:** design "Keep the contract small" (last three paragraphs).

**Steps**

1. Selected checks go into the project's existing check command and CI file, through `apply`.
2. `apply` rejects a CI edit that ignores a failure, such as `continue-on-error: true` or `|| true` on a check command.
3. In a repo with several packages, rules are scoped to the package they apply to.
4. Set up the initial documented debt baseline through selected findings before expecting an audited fixture to pass new rules.
   Prove each rule separately against the clean variants from T1.1, without treating unrelated existing debt as a new violation.

**Done when**

- On `ts-shop`, the same command fails on a seeded violation locally and in a CI run of a disposable copy pushed to a test branch.
Ask the owner before that push.
- The `web` package rule does not run against `core`.

**Covers:** AC-58, AC-61.

## Phase 3a: Maintenance

Phase evidence from the design: unreviewed or stale input states fail, and relevant documents get an update or a checked no-impact explanation.

### T3a.1 Define the project contract

**Depends on:** T3.4.

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

### T3a.6 Build the checker for a clean CI checkout

**Depends on:** T3a.5.

**Inputs and outputs:** Shared validators, schemas and CI input policy -> standalone checker and clean-clone evidence.

**Verification:** `npm test -- --task T3a.6`, then the fresh-clone CI procedure.

**Read:** design "Keep the contract small" and this plan's clean-CI contract below.

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
   Final validation uses those CI results and the substantive reviewed assessment.
   A local execution result cannot substitute for the current CI run.
5. Use one project aggregate command that calls this checker.
   Contract leaf checks cannot call that aggregate command or the checker again.
   Validate check dependencies for cycles and reject obvious direct self-invocation before execution.
6. Extend the target CI configuration from T3.4 through `apply`, using the clean-CI contract.
   When a change modifies the checker or its coverage policy, run the checker from the comparison base against the proposed target tree as well.
   Extract that previous standalone checker to CI scratch and pass the target repo and assessment explicitly.
   Resolve previous contract paths from the base, including a deleted or moved current config.
   An incompatible prior checker requires a recorded migration decision and explicit coverage, rather than silently skipping prior-policy validation.
   Run the same structural validation and leaf checks in local and CI modes.

**Done when**

- A fresh clone with no installed skill or agent passes with a complete assessment and valid leaf checks.
- Seeded stale documents, absent records, missing bases, failed leaf checks and recursive commands cannot pass.
- A shallow checkout missing its comparison commit is blocked until the documented fetch step runs.
- A contract-removal change fails under its previous coverage policy, including when it edits the checker source or configuration.
- The generated validator is current, and a CI run records its own execution results without editing the committed assessment.

**Covers:** AC-24, AC-58.

### Clean-CI contract

Select a committed assessment path when the project's chosen CI requires review evidence.
Local-only reviews can keep evidence in scratch, but cannot claim clean-CI assessment coverage.
The project's CI adapter passes the assessment path and comparison base explicitly.
If several records cover the same change, require an explicit selection instead of guessing the newest one.

For a GitHub pull request, check out the submitted head and fetch the base branch commit.
Resolve their merge base and require it to match the assessment's comparison base.
After a rebase or a base-branch change, refresh the assessment before claiming success.
For push builds, pass the configured previous commit or comparison policy explicitly.
For a new repo, use the explicit empty-tree mode.
Other CI systems document the equivalent source refs in their adapter.

Missing base objects, an absent assessment or unsupported prior policy block the run.
CI does not silently fetch a different base or fall back to an empty passing diff.
Required merge checks remain a separate owner-approved shared-system setting.
A changed workflow can omit its own checker, so the helper alone cannot guarantee that every pull request runs the gate.
The project's protected CI configuration or independent required check must enforce that execution boundary.
Report that boundary as unverified until the owner-approved CI configuration is checked.

### T3a.7 Write the maintenance reference

**Depends on:** T3a.6.

**Inputs and outputs:** Completed maintenance commands -> maintenance guidance and isolated scenario evidence.

**Verification:** `npm run check`, then the maintenance-only procedure from T1.2.

**Read:** design "Keeping project guidance current".

**Steps**

1. Write `references/maintenance-contract.md`: when to collect evidence, how to assess each candidate document, what counts as a no-impact reason, and when a decision is needed.
2. State that routine maintenance does not repeat the goal interview or the full audit.

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
- The same tests pass in isolated homes on Windows, macOS and Linux.
- `node scripts/check-package.mjs --skill <installed-folder>` validates a clean copy installation.

**Covers:** AC-73, AC-74.

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
4. Confirm the run needs no router, akashic or no-mistakes.

**Done when**

- The plain request does not start the skill, and the explicit command does.
- Every opened file matches a "load when" condition, and no script source or board asset was read.
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
5. Record script tests, agent transcripts, manual verdicts and clean-CI results under their acceptance IDs.
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
   Require passing evidence for all 75 design cases, plus baseline and final comparisons for every evaluation scenario.
   Cases that already passed without the skill must still pass with it.
   Fill the coverage table with actual evidence paths.
   A blocked, skipped or missing procedure cannot be waived by ticking a task.
3. Ask the owner to approve the tag `v0.1.0` and a GitHub release.
   Then tag, push and publish.

**Done when**

- Every acceptance case has a passing result in the coverage table.
- The owner has approved, and the tag exists on GitHub.

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
`scripts/acceptance.mjs --require-complete` rejects missing or duplicate case records and unsupported success claims.

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
| T3.4 | AC-58, AC-61 | Local and real CI violations, with package-scope controls | |
| T3a.2 | AC-19, AC-20 | Complete Git change inventory and invalid-base controls | |
| T3a.3 | AC-16, AC-17, AC-19, AC-21, AC-22, AC-28 | Before/after impact, no-impact, stale input and prior-policy bypass controls | |
| T3a.4 | AC-18 | Stale generated sections and checked regeneration | |
| T3a.5 | AC-13, AC-15 | Context-specific terms and reviewed rule relocation | |
| T3a.6 | AC-24, AC-58 | Fresh clone, missing evidence, shallow base and current CI execution | |
| T3a.7 | AC-23 | Maintenance-only transcript without interview or full audit | |
| T4.1 | AC-73, AC-74 | Copy/link lifecycle and conflict preservation on all three operating systems | |
| T4.2 | AC-39, AC-40, AC-42, AC-43, AC-56, AC-75 | Fresh explicit/implicit invocation and observed file-loading trace | |
| T4.3 | AC-1, AC-3, AC-23, AC-54, AC-64, AC-69, AC-75 | Final full-path transcripts, repeated audit and independent extension | |
| T5.2 | AC-46 | Comparable baseline/final results and all-case evidence validation | |
