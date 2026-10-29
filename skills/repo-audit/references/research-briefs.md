# Research briefs

Research is read-only discovery, not an interview, recommendation approval, live probe or project edit.
The main thread chooses the exact paths and question for the brief from the target and requested area.
Do not expand scope to unrelated files or assume a missing document has a conventional name.
Read relevant repo instructions and indexes first.

## Contents

- Execution and report contract
- Document inventory

## Execution and report contract

Use the host's general-purpose read-only subagent for the brief when available.
Subagents do not edit, ask the user questions, run checks with side effects or copy bulk source into their reports.
Keep decisions, recommendations and approvals in the main thread.
When only a few files make delegation wasteful, or subagents are unavailable or fail, run the same brief in the main thread.
Retain a concise formatted report rather than quoted files.
Record the actual mode as main-thread or subagents, the host and its observed subagent and web capabilities.

The brief returns one entry in a version 1 research report.
The entry names its brief ID, actual repo-relative paths in scope, concise findings, limitations, file citations and web citations.
The word limit below applies to findings, excluding citation metadata.
Return candidate observations with uncertainty and source attribution, not selected recommendations or guessed measurements.
For absent or inaccessible sources, state what was unavailable and why.

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
Also ask: Which test-policy files and review instructions exist, and do they state the test-quality rules?
Report whether they address impossible states, copied expectations, unrealistic mocks, private spying and trivial assertions, citing the policy or stating its absence.
If a test instance was incidentally read within the selected scope, report at most one `path:line` with the rule and uncertainty.
Do not expand into test sampling or a suite audit; `/verification` owns that work.
No incidental instance means test quality was not sampled, not that the suite is clean.
Paths in scope: The main thread's selected instructions, indexes and linked README, vision, design, requirements, glossary, standards, decision and prior audit files under the target, and the user's brief for a new idea.
Report format: State each observed file's purpose, explicit goals and principles, conflicts and absent sources using the common entry format with path:line citations.
Word limit: 250 words.
