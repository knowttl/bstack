# C25c operating-system execution

C25c verifies the copy and link lifecycle through `npm test -- --task C25c` in disposable homes, projects, source snapshots and locally packed fake runtime installations.
These are real local test executions on the recorded operating system, not real-model or current-agent loading acceptance.
No GitHub Actions workflow or remote execution was used.

On 2026-10-10 the owner ruled "only linux is good" and accepted Linux-only lifecycle evidence for C25c/AC-74.
This support/acceptance scope amendment is recorded as R27 in [the design](design.md#commissioning-decisions-2026-10-07).
No Windows or macOS runs will be supplied, and no Windows/macOS acceptance gate remains.
Their execution is unverified and outside the accepted support scope; this ruling does not turn Linux evidence into evidence for either platform.

Linux is the available execution environment.
`uname -s` returned `Linux`.
Local runtime probes returned Node `v24.17.0` and `v26.11.1`, with npm `11.13.0` for Node 24 and Git `2.54.0`.
The task evidence records the final command results and artifacts after completion.
The historical Node 26 copy/link supplement passed all 29 selected tests at `4413302241d7ff890defb69e3742474edf0559c2`, using Node `v26.11.1`, npm `11.20.0` and Git `2.54.0`.
Its [captured output](../tests/eval/results/tasks/C25c.node26-lifecycle.txt) includes no skipped, cancelled or todo cases.
The [task record](../tests/eval/results/tasks/C25c.json) binds the final full-suite capture separately under Node 24.
Development task suites also passed on both Node versions before the final additions; those development runs are not substituted for the final-input capture.

Windows and macOS remain unavailable.
`command -v powershell.exe pwsh sw_vers` found none of those commands on this host.
The task supplied no Windows or macOS execution endpoint or manual capture.
No remote access was inferred or attempted, and no system runtime was installed.
Windows launcher selection and junction branches exercised with portable code cannot substitute for actual Windows execution.

The final Node 24 full-suite capture binds the settled source, including mixed copy/link all-host uninstall and retained failed-stage provenance through interrupted cleanup.
Focused repair verification reproduced the provenance failure in both host orderings and passed all 13 recovery checks after repair.
The task record preserves the historical Node 26 revision separately rather than claiming that supplement covers later repairs.
The commands below describe the isolated Linux procedure and remain useful for future optional platform work.
They are not requests for additional Windows/macOS input under R27.

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
Any future Windows execution claim would need the real junction branch, rather than an injected platform value.
The separate-filesystem regression injects `EXDEV` at the filesystem boundary and does not claim another operating system or an actual separate-volume run.
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
