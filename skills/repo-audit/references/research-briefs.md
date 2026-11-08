# Research briefs

Research is read-only discovery, not an interview, recommendation approval, live probe or project edit.
The main thread chooses the exact paths and question for the brief from the target and requested area.
Do not expand scope to unrelated files or assume a missing document has a conventional name.
Read relevant repo instructions and indexes first.

## Contents

- Execution and report contract
- Document inventory
- Run history

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
Also ask: Do the documents say the suite or the gate is slow? Cite the statement, or state that none was found.
Do not expand into test sampling, timing a run or a suite audit; `/verification` owns that work.
No incidental instance means test quality was not sampled, not that the suite is clean.
Paths in scope: The main thread's selected instructions, indexes and linked README, vision, design, requirements, glossary, standards, decision and prior audit files under the target, and the user's brief for a new idea.
Report format: State each observed file's purpose, explicit goals and principles, conflicts and absent sources using the common entry format with path:line citations.
Word limit: 250 words.

## Run history

ID: history.
Question: Which classes of mistake recur in this repo's no-mistakes runs, and which of the seven agent-first practices does each belong to?
Run it only for a Git repo, on the `history` command's output kept in scratch.
Read finding text for a class only as the [history reference](no-mistakes-history.md) allows, and read nothing else about the runs.
Report the runs read versus the total and every limitation the output names; when the output shows no linked history, report that and no classes.

Group the findings of the runs read into classes by what went wrong, then place each class under one practice:

| Practice | Finding classes that belong to it | Next skill when a class counts |
|---|---|---|
| 1. Write instructions around real damage | Killing processes by name, leaked processes or files, hardcoded absolute paths or origins, destructive file or Git operations | `/verification correct` |
| 2. Turn repeated conventions into executable rules | The same convention broken in several runs, a written rule that findings keep citing | `/verification correct` |
| 3. Treat always-loaded context as a budget | Instruction files that grew, copied text, stale or unused lines | `/agents-md` |
| 4. Isolate real data and live state | Writes to user, shared or live state, tests that reach the network or the host, fixtures too synthetic to show the bug | `/verification correct` |
| 5. Enforce completeness and reversibility | A missed sibling surface, contract drift between producer and consumer, stale documentation, no rollback, resume or reverse operation | `/verification correct`, or `/maintenance` for stale documentation |
| 6. Keep verification focused and deterministic | Flaky, sleep-based or timeout-based tests, duplicated assertions, a slow gate with test or lint time dominating the step time shares | `/verification maintain` for a repo with a kit, otherwise `/verification create` |
| 7. Architecture defaults | Unbounded work, over-fetching, ignored remote or multi-environment modes, competing terms, needless configuration | `/architecture`, or `/glossary` for competing terms |

A class counts once it has two cited occurrences, the same threshold `/verification correct` applies before it proposes a rule.
An occurrence is one finding in one run, identified by run ID and finding ID, so a finding that stays listed across rounds is one occurrence.
Name a class with one occurrence as below the threshold and leave it out of the checklist.
Count an occurrence that recurs despite a written rule as a repeat of its class and name the rule.
Cite each class with its run and finding IDs in the findings text, and with a `path:line` in the current files, where the file still exists, to which the finding applied; run and finding IDs come from the local state store and `cite-check` cannot verify them.

Also report, each with the runs read versus the total:

- The share of findings first raised in round 2 or later and in round 3 or later, for `/no-mistakes-tuning`.
- The files flagged in two or more runs, as the places where a class shows.
- Each step's share of run time, so that a gate dominated by test or lint time is routed to `/verification` and not to `/no-mistakes-tuning`.
- The fix and revert commit counts from Git history, as a cross-check on the classes and never as a class by themselves.

Do not propose rules, configuration values or edits: that is the work of the skills the checklist names.
Paths in scope: The `history` output, the finding text the history reference allows for the classes and the current files the findings name.
Report format: State the coverage, then each counted class with its practice, occurrences and next skill, then the classes below the threshold, using the common entry format.
Word limit: 300 words.
