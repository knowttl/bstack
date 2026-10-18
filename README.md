# bstack

**Agent skills that establish project-specific guidelines, rules and checks, so coding agents follow reviewed rules instead of guessing them.**

[![License: MIT](https://img.shields.io/github/license/knowttl/bstack)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](package.json)
[![Latest release](https://img.shields.io/github/v/release/knowttl/bstack)](https://github.com/knowttl/bstack/releases)

```text
$ npx skills add knowttl/bstack --agent claude-code --yes
◇  Installed 9 skills ────────────────╮
│                                     │
│  ✓ agents-md (copied)               │
│    → ./.claude/skills/agents-md     │
│  ✓ architecture (copied)            │
│    → ./.claude/skills/architecture  │
│  ✓ foundation (copied)              │
│    → ./.claude/skills/foundation    │
│  ✓ glossary (copied)                │
│    → ./.claude/skills/glossary      │
│  ✓ maintenance (copied)             │
│    → ./.claude/skills/maintenance   │
│  ✓ plan (copied)                    │
│    → ./.claude/skills/plan          │
│  ✓ repo-audit (copied)              │
│    → ./.claude/skills/repo-audit    │
│  ✓ verification (copied)            │
│    → ./.claude/skills/verification  │
│  ✓ vision (copied)                  │
│    → ./.claude/skills/vision        │
│                                     │
├─────────────────────────────────────╯
```

[Quickstart](#quickstart) • [Use with your agent](#use-with-your-agent) • [Features](#features) • [Safety](#safety-and-permissions) • [Configuration](#configuration) • [Commands](#commands)

## Why this exists

A coding agent starts every conversation without your project's vision, vocabulary, module boundaries or the commands that prove a change works, so it guesses and the guesses are never reviewed.
Each bstack skill interviews you about one of those areas, cites the repo files behind every finding and writes the result only after you approve the exact bytes.
Plain prompts and hand-written `AGENTS.md` files leave the rules unchecked; bstack also installs the checks that keep them true as the code changes.

### Features

- **Explicit invocation** - every skill sets `disable-model-invocation: true`, so it runs only when you name it, never because a request resembles it.
- **Cited findings** - `repo-audit` and the research reports tie each claim to `path:line` and `cite-check` rejects stale or out-of-range citations.
- **Reviewed writes** - skills render a change set, show the exact diff, and `apply` writes it only after approval, with hash checks, backups of originals and a resumable journal.
- **Proven checks** - `rule-proof` runs a proposed rule against a clean fixture and a seeded violation before it is trusted.
- **Standalone output** - the checker installed by `maintenance` is one dependency-free file that runs without bstack present.
- **Per-skill install** - each folder under `skills/` installs on its own, and only `vision` pins an npm runtime.

## Quickstart

Prerequisites: Node 24 or later and Git.

1. Install every skill into the current project, or add `--skill repo-audit` to install one.
   Use `--agent codex` for Codex (installs to `.agents/skills`) and `--global` for your home directory instead of the project.

   ```sh
   npx skills add knowttl/bstack --agent claude-code --yes
   ```

2. Check that an installed skill's bundled script runs.
   This read-only command (it pipes through `jq`) inventories the repo's documents and prints the document kinds it did and did not find, here for a repo containing only a `README.md`:

   ```sh
   node .claude/skills/repo-audit/scripts/repo-audit.mjs inventory --repo . --json | jq '.data | {files, absent}'
   ```

   ```json
   {
     "files": [
       {
         "path": "README.md",
         "hash": "9138d6aa03d1e7b72818b1a228cb2445cd35652555d5903db811f09865e4ce6f",
         "kind": "context"
       }
     ],
     "absent": [
       "instructions",
       "vision",
       "design",
       "glossary",
       "context-map",
       "standards",
       "decisions",
       "audit"
     ]
   }
   ```

3. Open a fresh agent conversation in the project and invoke the skill by name with the area to assess and the next change:

   ```text
   /repo-audit
   Review this repo at overview level before adding quantity support.
   Use the existing design and acceptance cases; print the checklist with a cited reason per skill.
   ```

`repo-audit` writes nothing.
It prints a checklist of the skills to run next, in order, with one cited reason per line.

To use the `/vision` review board, prepare its pinned runtime once: `npm ci --omit=dev --prefix .claude/skills/vision`.
The [repo installer](#configuration) does this step for you.

## Use with your agent

Start a skill by typing its name; a plain request such as "audit this repo" does not start it.
Claude Code reads skills from `.claude/skills` and Codex from `.agents/skills`.

| Agent | Invocation |
|---|---|
| Claude Code | `/repo-audit` |
| Codex | `$repo-audit` |
| Pi | `/skill:repo-audit` |

<!-- skills-table:start -->
| Skill | What it does |
|---|---|
| [`agents-md`](skills/agents-md/SKILL.md) | Create and maintain one root AGENTS.md of pointers to a project's rules, evidence requirements and check commands, merging equivalent CLAUDE.md content into it. |
| [`architecture`](skills/architecture/SKILL.md) | Propose or audit a project's module boundaries, dependency direction and shared edit targets, record real decisions and design standards, and keep them true as the project grows. |
| [`foundation`](skills/foundation/SKILL.md) | Turn an approved new idea into the smallest working project by choosing the stack, scaffold, setup commands and first user journey, then create it only after the owner approves the exact files and commands. |
| [`glossary`](skills/glossary/SKILL.md) | Find, resolve and write a project's domain terms in GLOSSARY.md or a glossary map, and keep them true as the project's language changes. |
| [`maintenance`](skills/maintenance/SKILL.md) | Register a project's documents, scopes and checks so they stay true as code changes, wire no-mistakes to check them on every change, and sweep the whole repo now and then for drift. |
| [`plan`](skills/plan/SKILL.md) | Write and check one implementation plan from an approved design document, with units that each cite their design, name the boundary they touch and say what proves them done. Never executes the plan. |
| [`repo-audit`](skills/repo-audit/SKILL.md) | Audit a repo at overview level and print which bstack skill to run next, in order, with one cited reason per skill. |
| [`verification`](skills/verification/SKILL.md) | Create a project-local verification kit that launches and drives the real product, keep it true as the product changes, adopt testing and constraint guidance for it, and turn a repeated correction into a proven check. |
| [`vision`](skills/vision/SKILL.md) | Draft or revise a project's VISION.md, stress-test it on a review board, and write it only after the author approves the exact draft. |
<!-- skills-table:end -->

- `repo-audit` is the entry point: for a new idea or an existing repo it lists which of the other skills to run next, and `/plan` always comes last.
- `/verification` runs in `create`, `maintain` or `correct` mode, `/glossary` and `/architecture` in `create` or `maintain`, and `/maintenance` in `create` or `sweep`.
- Skills that write ask you to answer open intent questions, select findings and approve the exact diff before anything is applied.
- `/foundation` is for a new, empty project only and refuses a non-empty directory.

The [worked examples](docs/examples/README.md) show requests, findings, selections and results from recorded runs.

## Safety and permissions

Every skill is read-only until you approve a specific change.

| Capability | Skills | How it is unlocked |
|---|---|---|
| Write files in the target repo | `vision`, `glossary`, `architecture`, `verification`, `maintenance`, `agents-md`, `plan` | `apply` writes the reviewed change set after you approve its exact diff; a changed file hash blocks the write |
| Create a new Git project | `foundation` | `project create` runs after you approve the exact files and commands, only in an empty destination |
| Run project commands | `verification`, `foundation`, `maintenance` | Only the setup, journey and check commands listed in the plan you approved; live probes need `--approved-by-user` on each call |
| Remove a file | `agents-md` (`CLAUDE.md` merge) | Only after you approve and the host's current instruction-loading documentation has been rechecked |

- **Scope**: skills read only the selected repo; instruction files outside it, including ancestor directories and user profiles, are neither inspected nor reported.
- **Scratch**: drafts, evidence and previews stay in scratch outside the target until you approve.
- **Recovery**: `apply` keeps backups of original bytes and a journal, so an interrupted run resumes from verified hashes.
- **Credentials and network**: skills need no credentials or account, and bstack operates no service.
  Scripts send nothing to bstack; the requests they make are the readiness checks `kit prove` runs against the URLs in your approved verification kit, and the `vision` board's local listener for your browser.
  `npx skills add` is a separate third-party CLI with its own network behaviour.
- **Limits**: scripts check structure, citations and hashes; they cannot prove an interview captured your goal or that a citation supports a claim, so review stays yours.
  Installer evidence is Linux-only; Windows and macOS execution is unverified ([evidence limits](docs/development.md#evidence-limits)).

## Configuration

`npx skills add knowttl/bstack` takes these options:

| Option | Meaning |
|---|---|
| `--agent`, `-a` | Agent to install for, such as `claude-code` or `codex`; `*` selects all |
| `--skill`, `-s` | Skill to install; repeat or use `*` for all |
| `--global`, `-g` | Install to your home directory instead of the project |
| `--list`, `-l` | List the available skills without installing |
| `--copy` | Copy files instead of symlinking |
| `--yes`, `-y` | Skip confirmation prompts |

<details>
<summary>Install from a checkout with the repo installer</summary>

The installer in this repository previews changes, repeats as a verified no-op, updates, uninstalls, resumes interrupted runs, links a checkout and prepares the `vision` runtime itself:

```sh
git clone https://github.com/knowttl/bstack.git
cd bstack
npm ci --ignore-scripts
for p in skills/*/package.json; do
  npm ci --omit=dev --prefix "$(dirname "$p")" || exit "$?"
done
node install/install.mjs --scope project --project <project-path> --host all --dry-run
node install/install.mjs --scope project --project <project-path> --host all
```

| Option | Meaning |
|---|---|
| `--scope user\|project` | Install into your home or into `--project <path>` |
| `--host claude\|agents\|all` | Target `.claude/skills`, `.agents/skills` or both |
| `--skill <name>` | Install only this skill; repeatable |
| `--dry-run` | Show the plan and write nothing |
| `--uninstall` | Remove unchanged owned files and the runtime it created |
| `--link` | Link the source skill folder instead of copying |
| `--replace <host>:<path>:<hash\|absent>` | Accept a reviewed conflict decision |
| `--json` | Machine-readable result |

Edited or unowned files are preserved and reported as conflicts with their actual difference.
See the [installer contract](docs/command-contract.md#installer-copy-and-preview-c25a) for ownership, conflict decisions and recovery.

</details>

## Commands

Each skill ships one entry file; `--help` lists its commands and exits 0:

```sh
node .claude/skills/repo-audit/scripts/repo-audit.mjs --help
```

```text
Usage: node skills/repo-audit/scripts/repo-audit.mjs <command> [options]

Available commands:
  inspect
  inventory
  cite-check
  contract-test

Use --help to show this help (exit 0).
Missing or unsupported arguments are a usage error (exit 3).
```

The full command list, with a runnable example per command group, is in [docs/development.md](docs/development.md#command-reference) and the exact syntax and results are in the [command contract](docs/command-contract.md).

## Contributing

Use Node 24 or later, Git and npm.
There is no hosted CI, so run the checks locally before opening a pull request:

```sh
npm ci --ignore-scripts
for p in skills/*/package.json; do
  npm ci --omit=dev --prefix "$(dirname "$p")" || exit "$?"
done
npm run check
npm test
```

`npm run check` verifies the generated skill files, this README's skills table and the package rules.
After editing a `SKILL.md` description, run `node scripts/generate-readme.mjs` to refresh the table.
See [docs/development.md](docs/development.md) for fixtures, evaluation, the shared runtime and the delivery gate.

## License

[MIT](LICENSE)

If this project saved you time or helped your workflow, please consider giving it a ⭐ on GitHub to help others find it!
