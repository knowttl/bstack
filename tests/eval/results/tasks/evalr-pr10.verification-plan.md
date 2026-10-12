# Evidence storage verification

The maintainer approved keeping ledger and gate output plus redacted blocking and sampled transcripts in Git, with raw runs archived locally.

1. Run the public batch capture, scoring and finalization commands with fake hosts.
   Verify that the resulting raw records, conversations, scoring artifacts and batch inventory survive the documented local tar archive step.
2. Place the fake batch artifacts in a disposable Git repository using the production ignore policy and default results layout.
   Verify that `git status --short --untracked-files=all` exposes only the ledger and gate files, including when new historical raw-run files and the local archive exist.
3. Run `npm run check` and the full `npm test` on committed inputs.
   Attach captured full-suite evidence with task ID `evalr-pr10`.

## Scope and removals

New raw captures, scoring work files and private batch inventories are excluded from normal Git additions.
The documented workflow replaces committing every raw run with ledger and gate publication, selective redacted transcripts and a private local archive.
Existing tracked historical evidence remains available for acceptance references and judge calibration.
The validator continues to require local contributing run records; the archive does not replace those inputs.

## Deferred follow-ups

- Real smoke baselines, candidate batches and confirmation runs.
- Real full-tier bulk repetitions with compatible baselines and release-model anchors.
- Real judge calibration, blocking-verdict audit and sampled conversation audit.
- Real release archive creation and retention verification after those captures.

No live model, agent capture or judge call is authorized by this verification plan.
Fake-host storage verification establishes harness behaviour only, not release acceptance.
