## Scratch

Drafts, board verdicts and resume state stay outside the selected target.
`createScratch(target)` creates one run directory under the OS cache folder:

| OS | Cache folder |
|---|---|
| Windows | `%LOCALAPPDATA%\bstack\` |
| macOS | `~/Library/Caches/bstack/` |
| Linux | `$XDG_CACHE_HOME/bstack/`, otherwise `~/.cache/bstack/` |

The cache directory must be absolute.
A target subfolder uses SHA-256 of the absolute real target root, and `createScratch` assigns a UUID to each new draft run.
Apply uses the [digest-bound run identity](../commands/apply.contract.md#apply-dry-run) instead.
Existing cache and run-parent links are resolved before creating directories.
A resolved scratch location inside the target is blocked before any write.
Draft review commands use explicit returned scratch paths rather than guessing the newest run.
Scratch is retained for review and resume, with no automatic deletion in C4a.
