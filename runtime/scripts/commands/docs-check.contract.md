## Document references

```sh
node skills/maintenance/scripts/maintenance.mjs docs check --repo <target> [--contract <repo-relative-file>] --json
```

The command loads the project contract and verifies every registered document, rule and acceptance source path without executing checks or generators or writing files.
For UTF-8 `.md` and `.markdown` sources it checks local inline links, images and defined reference links, including collapsed and shortcut references.
Relative destinations resolve from the source document, may traverse parents inside the selected target, must use exact path case and cannot escape through symlinks.
Markdown links and reference definitions are extracted from the token tree produced by the exactly pinned `marked` parser, with GFM tables enabled.
Standard destinations, optional titles, escaped punctuation, nested image links, full, collapsed and shortcut references are supported; paths can use percent encoding.
Heading fragments use lowercase ATX or setext heading slugs, with punctuation removed, whitespace changed to hyphens and repeated headings suffixed `-1`, `-2` and so on.
External URLs are not fetched.
Code fences, indented code and HTML comments do not contribute links or glossary entries.
Inline code spans and backslash-escaped ASCII punctuation do not contribute link syntax; ordinary links elsewhere in the same document, including links with code in their rendered labels, remain checked.
Code spans may continue across lines within a paragraph, including lazy blockquote and list continuations, but do not extend across block boundaries.
Emphasis, strong emphasis, headings, lists, tables and URI or email autolinks do not prevent ordinary local links from being checked.
Raw HTML, explicit HTML anchors, custom heading IDs and HTML entities are coverage limits.
Entity-containing destinations are left unchecked rather than treated as literal filesystem paths.
Unsupported links and HTML spans are left for renderer review while ordinary links elsewhere in the document remain checked; registered paths are still verified.
Coverage limits remain visible in the result and do not imply that unchecked references passed.
A source document with these coverage limits is left for renderer review for glossary validation, while its supported local links remain checked.
A fragment target containing such unsupported markup also reports a coverage limit rather than a missing heading.
Heading text comes from inline tokens, so emphasis, code spans, escapes and link labels contribute their rendered text to the slug.
Fragments in non-Markdown targets are not validated.
Unsupported document encodings and formats produce `data.coverageLimits`, also visible in plain output, rather than a readiness failure or a forced rewrite.
Broken supported local references fail with `broken-local-link`.
The command checks registered sources only, not every document reachable through their links.

Register a glossary on its document record as `"glossary": { "context": "ordering", "format": "markdown-bold" }`.
Context is an explicit domain identity; document headings and filenames do not select or split contexts.
The supported formats are:

- `markdown-bold`: entries beginning at column zero with `**Term**:`, followed by a definition on that line or subsequent lines until the next entry or heading.
- `markdown-table`: two-column tables with `Term` and `Definition` headers and a Markdown separator row, with one term and definition per row.

Glossary fields use plain text; code spans, escaped pipes and other field markup are coverage limits.
A glossary document containing backticks or backslashes outside excluded blocks is left for renderer review while its supported local links remain checked.
Unusual table rows report coverage limits rather than invalid or empty fields.
Trailing horizontal whitespace on ordinary table lines is accepted.

Supported glossaries require at least one entry and nonempty canonical terms and definitions.
Term comparison normalizes Unicode to NFC, lowercases text and collapses whitespace.
Duplicate canonical terms fail within the same registered context, including across files.
The same word in two different contexts is valid.
Synonyms, contradictory definitions and domain relevance remain reviewer judgements.
An unrecognized glossary format reports a coverage limit while supported local links in that document are still checked.

`node skills/glossary/scripts/glossary.mjs <command> --repo <path> [--json]` is the installed entry point of the standalone glossary skill.
It runs `docs check`, `apply`, `state show` and `cite-check` from the [shared runtime](../../), with the same arguments, target, scratch and result contracts as repo-audit.

`node skills/agents-md/scripts/agents-md.mjs <command> --repo <path> [--json]` is the installed entry point of the standalone agents-md skill.
It runs `inventory`, [`instructions measure`](instructions-measure.contract.md#instructions-measure), `apply` and `state show` from the shared runtime with those same contracts, and writes selected instruction-file edits and deletes a merged `CLAUDE.md` through one reviewed `apply` plan.

`node skills/maintenance/scripts/maintenance.mjs <command> --repo <path> [--json]` is the installed entry point of the standalone maintenance skill.
It runs `contract validate`, `evidence collect`, `evidence validate`, `docs check`, `docs generate`, `run-checks`, `probe record`, `probe compare`, `apply`, `state show` and `sweep` from the shared runtime with those same contracts, and ships the generated checker beside it.
