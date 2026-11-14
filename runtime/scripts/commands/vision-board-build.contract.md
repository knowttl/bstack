## VISION board build

```sh
node skills/vision/scripts/vision.mjs vision-board build --workspace <existing-directory> --draft <file> --proposals <file> --json
```

Use `--repo <path>` for a Git target or `--workspace <path>` for a new-idea workspace.
Both inputs are explicit readable files, resolved from the caller's directory.
The draft is nonempty UTF-8 Markdown.
Proposals conform to `skills/vision/schemas/vision-proposals.json`:

```json
{
  "schemaVersion": 1,
  "draftRevision": "<SHA-256 of exact draft bytes, 64 lowercase hexadecimal characters>",
  "project": "Project name",
  "runNote": "Author decisions, first review",
  "cards": [{
    "id": "H-1",
    "title": "A concrete change",
    "body": "The proposed change.",
    "tests": "The quoted draft principle.",
    "why": "The strongest case for each side."
  }]
}
```

This shape illustrates fields.
The [executable draft](../tests/inputs/vision-draft.md) and [matching proposals](../tests/inputs/vision-proposals.json) provide a complete valid pair.
Supply at least one card when a real unresolved trade-off warrants a board.
All fields are required, all card strings and the project name must be nonempty, and unknown fields are rejected.
IDs must be nonblank and unique by exact string value.
The revision is SHA-256 of exact draft bytes without line-ending normalisation.
Review proposals against changed draft bytes before updating their revision.

Missing or unknown options produce usage error 3.
Unreadable inputs, invalid JSON/schema, invalid UTF-8, an empty draft, missing/duplicate IDs or a stale revision fail with exit 1 before scratch creation.
Unavailable target, cache or bundled resources produce blocked exit 2 and a named prerequisite.
On success, exit 0 returns the shared envelope with `data.board`, `data.scratch`, `data.runId`, `data.draftRevision` and ordered `data.cardIds`.
Use `--json` to retrieve these paths and bindings.
Scratch contains `board.html`, the unchanged `review.css`, exact `draft.md` bytes, `proposals.json` and a versioned `board.json` manifest bound to the resolved target.
Each build creates a distinct run and preserves earlier drafts, without changing the target.

The full draft and one-card stack retain the upstream layout and review mechanics.
Inserted title/header text is escaped for HTML, while script values use JSON with HTML delimiters and Unicode line separators escaped.
Card and ledger text is escaped at DOM insertion without changing raw IDs or reasoning in feedback.
Individual `vision-verdict` and complete-round payloads carry schemaVersion, runId and draftRevision.
Card queue keys use a `vision-card:` prefix so an ID cannot collide with the round-completion key.
The observed pinned runtime returns that context as JSON embedded after `Context data:` in tagged prompts.
The agent owns semantic revisions from author reasoning, with previous drafts preserved.
The build command generates the board for the launch and verdict commands below.
