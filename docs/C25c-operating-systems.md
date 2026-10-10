# C25c operating-system execution

C25c verifies the copy and link lifecycle through `npm test -- --task C25c` in disposable homes, projects, source snapshots and locally packed fake runtime installations.
These are real local test executions on the recorded operating system, not real-model or current-agent loading acceptance.
No GitHub Actions workflow or remote execution was used.

Linux is the available execution environment.
`uname -s` returned `Linux`.
Local runtime probes returned Node `v24.17.0` and `v26.11.1`, with npm `11.13.0` for Node 24 and Git `2.54.0`.
The task evidence records the final command results and artifacts after completion.

Windows and macOS remain unavailable.
`command -v powershell.exe pwsh sw_vers` found none of those commands on this host.
The task supplied no Windows or macOS execution endpoint or manual capture.
No remote access was inferred or attempted, and no system runtime was installed.
Windows launcher selection and junction branches exercised with portable code cannot substitute for actual Windows execution.

To clear the remaining gate, supply one real local or manual lifecycle run on Windows and one on macOS at the final source revision.
Each environment needs Node 24 or later, Git, npm and root dependencies installed with `npm ci`.
Run `npm run check` and `npm test -- --task C25c` from a disposable checkout, retaining command output, exit codes, source revision, operating-system release, architecture, Node/npm/Git versions and cleanup observations.
The suite creates isolated homes and projects and uses local fake runtimes with offline npm; it does not install into the operator's actual skill directories or use real credentials.
On Windows, confirm the actual junction lifecycle executes through the existing npm platform adapter.
Record any failure truthfully and retain AC-74 as blocked until all three OS records pass or the owner explicitly changes the support scope.
Linux Node 24 and Node 26 supplement these records and do not replace either missing OS.

## Commands for the operator

Use a disposable checkout at the requested source revision and run these commands in its root.
They are Node/npm/Git commands usable from PowerShell, Terminal or a POSIX shell.
The suite creates and removes its own isolated homes, projects and local runtime packages.

```sh
git rev-parse HEAD
node -p "JSON.stringify({platform:process.platform,release:require('node:os').release(),arch:process.arch,node:process.version})"
npm --version
git --version
npm ci
npm run check
npm test -- --task C25c
```

For a separately captured copy journey, run the existing fixture-backed public-command tests:

```sh
node --test --test-name-pattern="copy install validates the complete package|clean .* update removes obsolete ownership|noninteractive update reports actual mixed versions|uninstall retains edited ownership" tests/scripts/install.test.mjs
```

For a separately captured link journey, run:

```sh
node --test --test-name-pattern="link lifecycle|link installation preserves|owned link removal|failed link runtime|interrupted link|tagged checkout link recovery|link runtime preparation" tests/scripts/install.test.mjs
```

The copy journey must validate the complete installed folder, report preview without mutations, preserve edited and unrelated files through update and removal, and retain conflicts until exact replacement decisions with backups.
The link journey must preview runtime preparation before linking, activate only after verification, recognise a no-op repeat, report explicit checkout updates in link mode, refuse occupied or replaced entries and preserve the target through interruption and removal.
On Windows the directory-entry observations must come from the real junction branch, rather than an injected platform value.
All selected tests must pass with no skipped or cancelled cases, and the task suite must exit zero.
After completion, fixture cleanup must have removed its temporary snapshots, homes, projects, fake packages, caches, stages and links, while keeping the disposable checkout and its root dependencies.
Do not install into actual user skill directories to gather this evidence.

Return the full source SHA, OS/platform/release/architecture, Node/npm/Git versions, each exact command and exit code, output artifact paths and SHA-256 hashes, named lifecycle test outcomes, any limitations and observed fixture cleanup.
Use repository-relative artifact paths in the published record and remove private home paths and local account names from captured failure diagnostics.
The existing final-input full-suite capture and `scripts/task-evidence.mjs` attachment remain the task evidence authority; manual OS records supplement that capture.

Fixture teardown removes task-created disposable snapshots, isolated homes/projects, npm caches, fake runtime tarballs, stages, links and backups.
No task-created development stack, image or shared cache needs teardown.
Current-agent invocation/loading remains C26, and real-model acceptance remains C27.
No release, tag, npm publication or hosted CI workflow is part of this slice.
