## Research citation check

`node skills/repo-audit/scripts/repo-audit.mjs cite-check --repo <path>|--workspace <path> --report <file> [--json]` checks a scratch research report without target writes.
The report follows `skills/repo-audit/schemas/research-report.json`, version 1.
It requires the actual mode, host, observed subagent and web capabilities and one or more uniquely identified briefs.
The [shared report schema](../runtime/schemas/research-report.json) defines the allowed brief IDs.
Each brief records its actual scope, concise findings, limitations, file citations and web citations.
The [research briefs reference](../skills/repo-audit/references/research-briefs.md#execution-and-report-contract) owns the documents and history briefs that repo-audit runs and their execution guidance; the schema keeps the other brief IDs for the skills that research them.

Each file citation has a repo-relative `location` in `path:line` form and a `state` with kind sha256 or revision and its lowercase hex value.
Use forward slashes for portable repo-relative paths.
SHA-256 values have 64 digits and bind exact file bytes, including line endings.
Revision values have 40 digits and identify the Git commit whose cited file bytes were read.
The checker compares current bytes with the file object at that revision, so unrelated later commits do not invalidate an unchanged citation.
Changed working-tree bytes, unavailable revisions, missing or unreadable files and out-of-range lines fail.
Line numbers are positive and one-based, with LF, CRLF and CR separators supported.
An empty file has zero lines and a final separator does not add a phantom line.
Use SHA-256 for uncommitted files and non-Git workspaces.

Each web citation records an HTTP(S) URL, a real YYYY-MM-DD read date and verified or unverified status.
The checker validates these metadata fields without fetching the URL or establishing that its content supports a claim.
The main thread opens and checks each cited source before using a report, including after subagent research.
Without web access, the research report marks language-specific and outside recommendations not researched with the reason.

Unknown fields, malformed report JSON, duplicate brief IDs and invalid citation states fail with exit 1 and named problems.
Missing --report is a usage error, exit 3.
Successful JSON output records mode, filesChecked, webRecorded and webVerifiedByChecker false.
An empty file-citation list is valid for a brief with only unavailable or outside sources, and filesChecked explicitly reports zero.
