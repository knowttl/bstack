Verdicts takes the complete-round Context data JSON embedded in the terminal's vision-verdict prompt.
Copy that JSON unchanged to a scratch file, retaining the captured terminal response as provenance.
The [vision-verdicts schema source](../../schemas/vision-verdicts.json) defines the input fields and accepted verdict labels:

```json
{
  "schemaVersion": 1,
  "runId": "<board run ID>",
  "draftRevision": "<original exact-byte draft SHA-256>",
  "complete": true,
  "verdicts": [{ "id": "H-1", "verdict": "Conditional", "notes": "Author reasoning" }]
}
```

Every original card must occur exactly once.
Unknown, missing, blank or duplicate IDs, unknown fields or verdict labels, incomplete rounds and incompatible run or draft bindings fail with exit 1 before creating a new scratch draft.
The agent interprets author reasoning into the nonempty UTF-8 revised Markdown supplied as --draft.
The script validates transport and saves those exact revised bytes, rather than inferring semantic edits or author approval.
On success it creates new scratch draft.md and review.json, returning their paths, the revised hash, previousDraft and approval: pending-author-review.
Review metadata preserves the verdicts, original run ID, reviewedDraftRevision, previousBoard and previousDraft alongside the new draftRevision.
The original draft, board, proposals and decisions remain available for resumed review.
Present the saved revision and edit-to-verdict explanation for explicit author approval, retaining the approval and revision in the scratch transcript.
Another board round builds from that saved draft with matching proposals and uses the retained review.json decisions.
No board command changes the target or initialises Git, and a successful verdict command does not complete approval.
