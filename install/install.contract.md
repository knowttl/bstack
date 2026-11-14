## Installer copy and preview (C25a)

`node install/install.mjs --scope user|project [--project <path>] --host claude|agents|all [--skill <name>]... [--link] [--dry-run] [--uninstall] [--replace <host>:<path>:<actual-hash|absent>] [--adopt-runtime <host>:<displayed-hash>] [--json]` installs, updates or removes the skill folders beside the installer.
Without `--skill` it handles every folder under `skills/` that holds a `SKILL.md`, one skill at a time and each on its own records; repeated `--skill` selects some, and an unknown name is a usage error that lists the available skills.
The scope and host are required, project scope requires an existing project directory, and user scope rejects `--project`.
Unknown, repeated or missing arguments return usage error before dependency calls, except that `--skill`, `--replace` and `--adopt-runtime` can repeat for distinct values.
`--help` prints the supported interface.
`--link` selects the developer-checkout link lifecycle described below.
C25c and AC-74 use Linux-only installer acceptance under the owner's 2026-10-10 scope amendment.
Windows and macOS execution remains unverified and is outside this acceptance scope.

Claude uses `.claude/skills/<skill>`, and agents uses `.agents/skills/<skill>`, beneath the selected real home or project root.
For each skill, `all` selects both, deduplicates their canonical destinations and checks every destination before staging any copy for that skill.
Escaping destination links are rejected through the shared path resolver.
An occupied folder without matching external ownership is always blocked, including an empty folder or one containing files identical to source.
The installer never adopts an existing dependency directory.

Preflight requires Node 24+, Git, npm and the root package-checker dependencies installed by `npm ci`.
It validates authored package closure and matching manifest/lock dependencies with an exact lavish-axi pin.
The source version is a clean exact `v<major>.<minor>.<patch>` tag, otherwise `development:<commit>[:dirty]` or `development:unversioned`.
Untracked installer-created skill contents and ownership records are excluded from source dirtiness at both canonical host destinations, independently of the selected host.
Tracked changes and unrelated untracked source content still make the source dirty.
No tag or release is created.
`--dry-run` returns every authored destination path and exact-byte hash, runtime installation and ownership/journal paths.
It creates no directories, stage, dependencies or records.
No-op repeats have no changes after verifying source version, exactly the recorded authored paths and hashes, and the installed pinned runtime.
Rerunning against a different source version or changed installation plans an update.
Updates replace unchanged owned files and remove obsolete owned files only when their recorded hashes still match.
Missing owned files, edited files and newly conflicting unowned files are preserved until a specific decision.
Preview lists replacements, removals, runtime changes and preserved conflicts without applying decisions.
Unowned extra content, including symlinks, remains untouched on a no-op repeat.
Owned files must remain regular files, and source and staged authored inventories reject symlinks.

Copy installation stages only authored files in a unique `.bstack-stage-*` sibling of the destination.
Git data, node_modules, caches and scratch are excluded.
For a skill with a pinned runtime, the shared child runner executes `npm ci --omit=dev --no-audit --no-fund` in the stage, including the Windows npm adapter and bounded command capture.
The package checker, authored hashes and any pinned lavish-axi version must pass before activation.
Dependency scripts that alter authored files cannot activate a copy.
The source skill and its runtime are never changed by copy installation.

Each host skills parent holds one ownership file per skill: `.bstack-install.json` for repo-audit, which predates multi-skill installs, and `.bstack-install-<skill>.json` for every other skill.
It records schema version 1, copy mode, source version, absolute destination, exact authored `files` hashes and a separate `runtime` record with path, version and `created: true`.
A skill without a `package.json` pins no runtime, runs no npm install, and records `runtime: null`.
When an update retires a previously pinned runtime, preview reports `runtime-remove`, and application removes only the installer-owned runtime directory after verifying its identity.
A replaced or unverifiable runtime is preserved and reported as a conflict; interrupted retirement resumes through the same journal and ownership checks as other lifecycle operations.
Mutable caches, backups and dependency contents are absent from `files`.
Lifecycle records also retain `fileVersions`, preserving the source provenance of each owned hash.
An incomplete update records `sourceVersion: "mixed"`, retains the last owned hashes of edited files, and reports actual installed hashes separately under `data.installations[].files`.
The report includes file versions, runtime state, conflicts, backup location and retained paths where applicable.
The top-level `sourceVersion` identifies the requested source, while each installation report identifies its actual state.

Conflicts include the installed and proposed hashes, complete replacement diff and the precise `--replace <host>:<path>:<actual-hash|absent>` value.
Regular files and missing paths can be explicitly replaced or removed, but a directory or link cannot be approved through a file replacement decision.
Stale or unmatched replacement decisions return usage error before staging.
An interactive plain-output terminal asks for `yes` separately for each conflicting path, while JSON or noninteractive execution preserves conflicts unless their exact decisions are supplied as flags.
Each accepted destructive decision saves the existing bytes in a unique `.bstack-backup-*` sibling, preserving the authored relative path inside that directory.
Interrupted backup writes resume only when the saved bytes are a prefix of the still-verified approved original; changed backups are preserved and block recovery.
Backups are retained outside the installed skill and never become authored ownership.
Noninteractive unresolved conflicts return blocked exit 2 after applying independent safe changes and saving actual mixed ownership.

`--uninstall` removes unchanged owned files and only the separately recorded runtime directory created by this installer.
Runtime ownership includes the directory's device, inode and creation time, checked before replacement, removal and recovery.
A replacement runtime or a legacy ownership record without directory identity is preserved until reviewed.
For a C25a record, a verified pinned runtime offers `--adopt-runtime <host>:<displayed-hash>` to explicitly confirm its ownership before repeat, update or removal.
The decision binds the canonical path, directory identity, file bytes and link targets; changed or unmatched decisions return usage error before mutation.
Dry run previews adoption without saving it, and application rechecks the decision before persisting directory identity.
An accepted adoption decision is retained with its operation binding until completion, so an interrupted command can be rerun with its original decision flags.
Completion plans, stages and adoption receipts remain available until every selected host finishes, including uninstall ownership for retained unowned content.
Before destructive final cleanup, `.bstack-install-cleanup.json` in the selected home or project records all hosts' verified results and original decisions.
Retries verify those results and resume cleanup directly, retaining command provenance through stage removal, ownership cleanup and per-host journal retirement until the command record is retired last.
The accepted content fingerprint follows an adopted original runtime into the stage and is checked again before recovery and cleanup; changed originals are preserved.
Recovery validates replacement flags against the recorded plan and original or completed file hashes, and rejects adoption replays whose operation or verified runtime preconditions changed.
Recovery rejects a destination whose canonical path changed, including a replacement directory link.
It prunes empty directories without following links and reports every retained path.
Retained owned files keep their original ownership hashes and versions for later explicit cleanup and return blocked.
Unowned retained files alone do not block successful removal, and ownership is removed when no owned file or runtime remains.
A later install into that remaining unowned folder blocks instead of adopting it.
The journal, `.bstack-install-journal.json` for repo-audit and `.bstack-install-<skill>-journal.json` for every other skill, holds the stage, intended ownership and activation state before the directory rename.
The destination is rechecked after runtime installation, then the validated stage is renamed into place and ownership is durably saved through the existing recovery writer.
Successful installation removes its journal.
Skills and their host destinations activate sequentially, so a later failure can leave an earlier skill or host installed and owned.
The operation is not an atomic transaction across skills or hosts.

Runtime or application failure returns non-passing output and retains the stage or activated destination plus its journal, including bounded runtime failure output.
An npm failure never activates or claims ownership of the destination.
Rerunning the original lifecycle command resumes a pending journal from actual hashes.
First-copy recovery supports staging, prepared, activated and completed states, including interruption immediately after directory activation but before its journal save.
Missing authored stage files can be reconstructed from the unchanged source during staging, while changed bytes block and survive.
Staging retries a failed pinned runtime installation and validates the resulting package and hashes before activation.
Prepared recovery verifies the pinned runtime without rerunning an already completed installation.
Updates and removal record per-file original/proposed hashes before mutation and infer completed operations from actual bytes, including a crash between mutation and journal save.
Runtime updates preserve the old owned directory in the stage before activating the validated runtime, allowing recovery between those renames.
Runtime removal records entry identities and contents before deletion; retries accept missing recorded entries but preserve and block on changed, recreated or new content.
Verified recovery-writer temporaries do not change the source version, and failure reports refresh every selected host's actual hashes and runtime while retaining conflict and backup details.
Unrelated destination content survives resume, and unrelated content added to an update stage is retained and reported rather than discarded with the stage.
Switching between install and uninstall while a journal is pending blocks until the original operation is resolved.
Inspect the named journal, actual stage and destination before any explicit cleanup decision.
Filesystem directory-flush limitations come from the shared recovery writer, and power-loss recovery is not established by this slice.
JSON uses the existing result envelope and exit codes 0 passed, 1 failed, 2 blocked and 3 usage error.
Plain output adds the same source version, destinations and planned changes.
`npm test -- --task C25b` runs local/fake dependency snapshots in disposable roots, including update/removal conflicts, mixed versions, hash-bound decisions, runtime failure, interruption boundaries and C25a collision controls.
Real Windows/macOS execution remains unverified.
See the [C26 checkpoint](../tests/eval/results/invocation-C26/summary.md) for current-agent invocation and loading observations.
