# Shorter scenarios and bulk adapter verification

The maintainer approved the release-evaluation redesign and selected `gpt-6-luna` at high reasoning effort for full-tier bulk runs.

1. Build `selected-ts-shop` through the fixture test suite.
   Verify deterministic history, the original failing total-10 journey and boundary defects, selected findings, approved bounded plan and uncommitted receipt note.
2. Exercise `eval affected` through the impact tests.
   Verify selected apply depends on protected writes, verification and maintenance inputs, and that unmapped changes still select every scenario.
3. Exercise public batch commands with fake hosts.
   Verify the long paths and selected apply cannot enter the smoke tier, the bulk adapter is rejected before smoke resources start, and full-tier bulk opening and resumed turns complete with isolated cleanup.
4. Run `npm run check` and the full `npm test` on committed inputs.
   Attach captured full-suite evidence with task ID `evalr-pr09`.
5. Keep release-history tests independent of the worker checkout's parent commit.
   Build a disposable compatible runner history and verify the gating-rate, first-release and capture-date cases through the public release command.

## Deferred follow-ups

- Real selected-apply-verify baseline and with-skill captures and semantic scoring.
- Real smoke baselines, release-model candidate batches and confirmation runs.
- Real full-tier bulk repetitions with their own baselines and one release-model anchor per scenario.
- Real judge calibration, blocking-verdict audit and sampled conversation audit.
- Runtime, token and cost measurements of the shorter scenario and bulk profile.

No live model, capture or judge call is authorized by this verification plan.
Deterministic fixture and fake-host checks establish harness behaviour only, not agent acceptance or measured savings.

## Scope and removals

The existing audit scenario supplies the first half of the split existing-repo path.
The new selected apply scenario supplies its bounded second half with one exact-diff approval answer.
Complete existing-repo, new-project and representative-extension paths remain available in the full tier only, as established by the preceding tier change.
The new scenario removes the need to repeat the interview and full audit before measuring selected apply and verification.
The bulk profile is configurable through its adapter file and cannot supply smoke batches.
