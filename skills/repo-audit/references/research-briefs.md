# Research briefs

Research is read-only discovery, not an interview, recommendation approval, live probe or project edit.
The main thread chooses the exact paths and question for each brief from the requested area and stated next change.
Do not expand scope to unrelated files or assume a missing document has a conventional name.
Read relevant repo instructions and indexes first.

## Contents

- Execution and report contract
- Document inventory
- Code and architecture evidence
- Existing checks and toolchain
- Language research
- Outside research for a third-party service

## Execution and report contract

Use the host's general-purpose read-only subagents for independent briefs in parallel when available.
Subagents do not edit, ask the user questions, run checks with side effects or copy bulk source into their reports.
Keep decisions, recommendations, approvals, live probes and writes in the main thread.
When only a few files make delegation wasteful, or subagents are unavailable or fail, run the same briefs sequentially in the main thread.
Retain concise formatted reports rather than quoted files.
Record the actual mode as main-thread or subagents, the host and its observed subagent and web capabilities.
An unsupported subagent checkpoint remains blocked and is never represented by main-thread evidence.

Use all five briefs for the discovery checkpoint, and only relevant briefs for later bounded research.
Each selected brief returns one entry in a version 1 research report.
Each entry names its brief ID, actual repo-relative paths in scope, concise findings, limitations, file citations and web citations.
The word limit below applies to findings, excluding citation metadata.
Return candidate observations with uncertainty and source attribution, not selected recommendations or guessed measurements.
For absent or inaccessible sources, state what was unavailable and why.
Language and outside facts not researched without web access must say "not researched" and give the reason.
Repo evidence and general principles remain usable, but memory is not a substitute for external research.

File citations use repo-relative path:line, with a positive one-based line number.
Bind each citation to SHA-256 of exact file bytes, or the full Git revision whose file bytes were read.
Use a hash for uncommitted files and non-Git workspaces.
Web citations record the full URL, actual YYYY-MM-DD read date and verified or unverified status.
Verified means the researcher actually opened the source, not that the citation checker fetched it.
The main thread opens every cited source and checks that it supports the claim before a finding uses the report.
Run cite-check against the selected target and scratch report, and refresh stale sources before relying on them.
The checker validates file existence, line range and bytes, plus web metadata, but cannot judge whether a source supports a claim.

Example report entry inside a report following the installed research-report schema:

```json
{
  "schemaVersion": 1,
  "mode": "main-thread",
  "host": "current host",
  "capabilities": { "subagents": false, "web": false },
  "briefs": [{
    "id": "documents",
    "scope": ["README.md"],
    "findings": "README.md:1 describes the project's purpose.",
    "limitations": [],
    "files": [{ "location": "README.md:1", "state": { "kind": "sha256", "value": "<64 lowercase hex digits from the file bytes>" } }],
    "web": []
  }]
}
```

Replace the hash placeholder with the actual digest before checking.
Run `node scripts/repo-audit.mjs cite-check --repo <target> --report <scratch-report.json> --json` from the installed skill.
Use --workspace instead of --repo for non-Git discovery.

## Document inventory

ID: documents.
Question: Which authoritative documents establish purpose, goals, vocabulary, decisions and standards in this scope, and where do they agree or conflict?
Paths in scope: The main thread's selected instructions, indexes and linked README, vision, design, requirements, glossary, standards, decision and prior audit files under the target.
Report format: State each observed file's purpose, explicit goals and principles, conflicts and absent sources using the common entry format with path:line citations.
Word limit: 250 words.

## Code and architecture evidence

ID: architecture.
Question: What responsibilities, entry points, interfaces and dependencies support the stated next change, and what evidence suggests coupling or shared edit targets?
Paths in scope: The selected entry points, relevant implementation and tests, authoritative architecture documents and supplied measurement outputs.
Report format: Describe responsibilities and candidate findings in the common entry format, separating observation from inference and citing exact files and any supplied deterministic measurement output.
Do not run unavailable measurement helpers or invent fan-in, cycles, history metrics or semantic violations.
Word limit: 300 words.

## Existing checks and toolchain

ID: checks.
Question: Which existing commands and native configurations enforce the project's approved expectations, and what prerequisites or coverage limits remain?
Which important user journeys have direct executable checks, which rely only on unit, mocked or private-implementation tests, and which have none?
Paths in scope: Selected manifests, lockfiles, check scripts, native format, lint, type and test configs, delivery configs and supporting standards.
Report format: Inventory documented commands, versions or pins, config scopes and what they enforce in the common entry format, distinguishing configured checks from checks actually executed.
Only the main thread runs approved checks or probes and supplies their captured results.
Word limit: 250 words.

## Language research

ID: language.
Question: What language-specific practice supports the project's approved goals and existing conventions without replacing its stack?
Paths in scope: The selected repo's language and tool configs, standards, manifests and relevant code, followed by sources for those actual languages and tools.
Research order: Repo configs, documents and existing checks first, then official language and tool documentation, then well-established community guides only for gaps in official sources.
Report format: Use the common entry format to connect each candidate practice to repo evidence and its URL and read date, marking each outside source verified or unverified.
Without web access, mark language-specific recommendations "not researched" with the reason, retaining only repo evidence and general principles.
Do not carry a language rule set, lint preset or universal tool list into another project.
The main thread develops recommendations from checked evidence and obtains user approval before applying them.
Word limit: 300 words.

## Outside research for a third-party service

ID: outside.
Question: Which documented service behaviour and version constraints matter to the stated change, and what still requires a live probe?
Paths in scope: The selected integration boundary, configuration, dependency pin and supplied probe results, followed by that service's official documentation and upstream sources.
Report format: Return relevant documented facts in the common entry format with URL, read date and verified or unverified status, separating documentation from observed live behaviour.
Without web access, report "not researched" with the reason.
When no third-party service is relevant, state that limitation rather than inventing an integration.
The main thread owns any live probe and its required approval, so documentation alone never establishes observed service behaviour.
Word limit: 250 words.
