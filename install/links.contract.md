### Developer checkout links (C25c)

`--link` installs a directory symlink on Linux/macOS or a directory junction on Windows to the source skill folder.
The source remains a developer checkout, and reports use `mode: link` even at an exact tag.
All selected destinations for each skill are checked before that skill's mutation, and occupied unowned destinations or copy-to-link conversions block.
External ownership records identify the absolute source and destination, source directory identity, source hashes and version, and link device, inode, creation time and literal target.
Verification checks the directory entry without following it, then checks source resolution before an install or update.
An identical target reached through a replacement link does not transfer ownership.

Preview creates no directories, dependencies or records.
It lists `source-runtime-install` when the source needs its pin, before the planned link action.
Runtime preparation uses the existing child runner and Windows npm adapter in a stage beside the source skill, then moves the verified runtime into an absent source `node_modules` before activating the link.
Keeping runtime preparation beside its activation path supports a source and destination on different filesystems.
Recorded runtime-stage paths are excluded from source dirtiness, including retained failed-stage content.
A failed stage and its captured runtime result remain available; a retry prepares a fresh stage without erasing failed-stage content.
An occupied source runtime differing from the pin blocks and must be prepared explicitly by the developer.
The installer preserves every existing source runtime and never removes runtime data through a link.
Prepared runtime identity and authored hashes are verified before activation.
Successful preparation removes unchanged staged authored files and empty directories, retaining unrelated stage content.

A repeated link installation verifies the same source, owned entry and pinned runtime with no source changes.
Updating source files is a separate developer action; rerunning `--link` records the current checkout as `linked-checkout-update` without copying or replacing authored files.
An install/update without `--link` against existing link ownership blocks with `link-mode-required`.
`--uninstall` can identify link ownership without repeating `--link` and unlinks only that entry.
It removes the external ownership and journal records and retains the entire target, including edited files, unrelated content and runtime.
Removal does not validate the target manifest or authored package, while the installer still needs its own shared helpers to execute.
Copy replacement and adoption decisions do not apply to links.

The shared durable recovery writer records link operations before mutation.
Prepared links have a recorded identity before rename, so a retry can recognise activation even when the journal save was interrupted.
Recovery rejects changed source bytes during installation and changed link identity or target during every lifecycle operation.
Removal can resume after unlink without touching the target.
Multiple hosts complete sequentially, preserving earlier completed ownership if a later host fails.
Process interruption tests do not establish power-loss recovery.
`npm test -- --task C25c` includes the copy and link lifecycle suites in disposable homes/projects with local fake runtimes.
Real Linux lifecycle execution and the Node 24/26 records satisfy the owner-amended platform scope for AC-74.
No Windows/macOS run is claimed or required under that amendment.
