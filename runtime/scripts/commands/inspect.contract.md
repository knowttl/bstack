## Inspect and inventory

```sh
node skills/repo-audit/scripts/repo-audit.mjs inspect --repo <path> --json
node skills/repo-audit/scripts/repo-audit.mjs inventory --repo <path> --json
```

Both commands accept `--repo` and optional `--json`, with the shared argument and result contracts.
With `--repo`, they resolve the Git root even when the selected directory is nested, and do not create scratch or write target files.
`inventory` also accepts `--workspace` instead of `--repo` to inspect an existing directory without Git discovery.
For `inspect`, non-Git targets are blocked and `--workspace` is a usage error.
They recursively discover regular files, excluding `.git`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist`, `build` and `.cache` directories.
Directory and file symlinks are not followed during recursive discovery.
Unreadable filesystem sources block the command.
Discovery is bounded by these traversal and name rules, rather than a semantic judgement of every repository file.

`inspect` returns `data.root`, `revision` (a Git object ID, "no commits" for an unborn branch, or null when HEAD cannot be resolved), `changes`, `manifests` and `prerequisites`.
Each change contains the two-character porcelain status and literal repo-relative path, plus `originalPath` for a rename or copy.
Manifest entries contain the path and exact-byte SHA-256 `hash`.
Known manifests include Node package and npm, pnpm, Yarn and Bun locks, Python pyproject, requirements, Pipfile, uv and Poetry locks, Cargo, Go, Gemfile and Composer files.
Prerequisites contain `tool`, `found` and `version` (null when unavailable).
Git and the running Node are always checked.
Node manifests select their named npm, pnpm, Yarn or Bun package manager, defaulting to npm.
Python manifests select `python3` on Unix or `python` on Windows, and lockfiles also select uv, Poetry or Pipenv.
Other recognised stacks select Cargo, Go, Bundler or Composer.
Version probes use argument arrays, the shared launcher resolver and a ten-second timeout per tool.
Missing tools yield `prerequisite-unavailable` with the tool name, malformed package JSON yields `manifest-unreadable`, and unreadable available Git history or working-tree state yields `history-unreadable` or `working-tree-unreadable`.
These limitations return blocked, preserving any state already observed.
Git discovery failure yields the shared `git-unavailable` problem before inspection.
Available history is read, including shallow history as stored locally, without fetching missing ancestors.
Tool version discovery does not prove native checks ran or all project-specific prerequisites are available.
