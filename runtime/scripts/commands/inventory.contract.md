`inventory` returns `data.root`, `files`, `absent`, `candidates` and `shadowing`.
Every file has `path`, exact-byte SHA-256 `hash` and `kind`.
Names are case-insensitive for documents with Markdown, reStructuredText or text extensions.
Name families accept hyphens, underscores or spaces between words where shown below.

| Kind | Names |
|---|---|
| vision | vision, goals, purpose, product requirements, requirements, prd |
| design | design, architecture, technical design, principles |
| glossary | glossary, vocabulary, domain language, domain vocabulary, terms |
| context-map | context map, contexts |
| standards | coding standards, code standards, review standards, contributing, contribution guidelines, style guide |
| decisions | decisions, adr, architecture decisions, decision log, or documents under adr, adrs, decisions or architecture-decisions directories |
| audit | repo audit, audit, audit record, audit findings, technical debt, known debt |
| context | readme |

Instruction names are exact: `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` and `CLAUDE.local.md`, at the root or in nested scopes.
Instruction entries also contain `directory`, `scope`, `insideRepo`, `scoped` and `local`.
`.claude/CLAUDE.md` governs its parent scope, not the `.claude` folder alone.
Other instruction names inside `.claude` keep that folder as their scope.
Paths and directories inside the repo are repo-relative, using forward slashes, and the root scope is `.`.
Instruction discovery is limited to files inside the selected repo, with `insideRepo: true`.
Ancestor-directory and user-profile instruction files are neither inspected nor reported.
Missing repo-owned source kinds appear in `absent`, without failure or an invented fallback document.
Discovered sources require content review to establish authority.

Root repo-owned `CLAUDE.md` yields a `merge-claude-instructions` candidate, including import-only stubs.
Candidates carry `path`, `destination`, `scope`, `requiresEquivalentContent`, a review message and the design's Claude Code version limit.
They require equivalent-content review, a fresh official documentation and runtime check, author approval and protected edits before removal, which the [agents-md skill](../skills/agents-md/SKILL.md#step-3-decide-the-merge) owns.
Distinct nested guidance stays scoped and produces no root consolidation candidate.
An exact-byte equivalent nested file or a lone import of the same scope's existing `AGENTS.md` yields only a candidate targeting that scope's `AGENTS.md`.
Local variants inside the repo are possible shadowing reports with `modifiable: false`, never consolidation candidates.

Paths matching a glob in `instructions.exclude` of `.bstack/project.json` are left out of `inventory` and `instructions measure`, so fixture trees can be configured out of scope.
That file is read only when it exists and is checked against the [project schema](../runtime/schemas/project.schema.json), and a schema violation fails the command.
Nothing is excluded by default.
