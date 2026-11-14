### Sweep

```sh
node skills/maintenance/scripts/maintenance.mjs sweep --repo <path> [--contract <repo-relative-file>] [--json]
```

`sweep` accepts `--repo` and optional `--contract` and `--json`, writes nothing and creates no scratch.
It returns `passed` when nothing drifted and `failed` (exit 1) with one problem per drifted item, and each problem's `fix` field names the skill mode that repairs it.
A missing contract is a `contract-missing` problem fixed by `/maintenance create`, and an invalid one returns the contract's own problem codes with the same fix.
For an otherwise valid contract, source-pointer problems in registered documents, rules or acceptance sources do not prevent inspection of a readable registered plan; an unresolvable plan retains its source-pointer problem and is not read.
When source-pointer problems exist, sweep skips `docs check` and `docs generate --check`; otherwise it runs both over the registered documents.
Verification kits, formal suites and `AGENTS.md` links are still checked.
Skipped Markdown and unsupported link fragments in registered content or `AGENTS.md` are reported as unchecked scope in `data.coverageLimits`, with a `path` and `reason`.
Coverage limits are never problems or repair items and never fail sweep by themselves; `passed` means no drift was demonstrated in the checked scope.
A broken link or invalid glossary entry in a document is fixed by that document's owner: `/glossary maintain` for a registered glossary, `/architecture maintain` for the document with ID `design`, `/vision` for the one with ID `vision`, and by hand for any other.
A stale generated section is fixed by running `docs generate` in `/maintenance`.
The document registered with the ID `plan` is read as a plan: `plan-finished` is reported when the repo-relative path in its line ``Remove this plan when `<path>` exists.`` (in the "How to read this" section) exists.
`plan-orphaned` is reported when a `path:line` citation in backticks on a `Design:` line names a missing or unresolvable path, or when "How to read this" has no readable removal condition or its condition path cannot be resolved.
Sweep fixes neither: the user approves deleting the plan together with its `AGENTS.md` pointer line, or restoring an orphaned plan's dependencies.
For registered documents, code changes or document age alone never produce a repair item or fail the command.
Formal suites follow the [formal check contract](#formal-verification-skill-commands), including source drift since a property's sync commit.
Each applied verification kit under `.agents/skills/verify-*/` is checked with the `kit check` rules and fixed by `/verification maintain`, each applied formal verification suite under `.agents/skills/formal-*/` is checked with the `formal check` rules and fixed by `/formal-verification maintain`, and a link in the root `AGENTS.md` that does not resolve is fixed by `/agents-md`.
A suite whose pinned tool file is missing is unproven and not drifted, so it appears in `data.coverageLimits` with the tool's path and never fails sweep by itself.
The two prefixes are distinct, so a `verify-` kit is never read as a suite.
The skill judges every registered document against the whole current repo by reading, including glossary terms, design boundaries, README instructions and facts, vision claims and other registered content, as its sweep guide describes.
Staged, unstaged and untracked content is included; history may order the review but never exclude a document or repository area, and no baseline is required.
