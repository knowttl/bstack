# T2.8 existing-repo foundation checkpoint

Four fresh real Codex runs used `with` mode and the shipped adapter with gpt-6.1-sol, low reasoning effort, a 600000 ms turn limit and 16 MiB capture per stream.
The TypeScript run tested revision `418486c8df38167ddcbc5a615aa4cde54b11447c`.
The other three tested revision `7c5e754b948b7ab80a21bfe05de6940d26871fd3` with the same skill bytes and the registered additional scenarios.
Each run used a new 0700 home, copied only the existing login during each turn, deleted that copy in the adapter's cleanup and deleted the isolated home immediately after conversation completion.
No login contents are retained.
All five turns exited 0 without timeout or truncated capture.
The worker scored the actual captured conversations through the evaluation interface before creating these redacted snapshots.
The interface calls its explicit reviewer scoring mode `human`, while the identified reviewer here is the implementation worker.
These snapshots preserve transcript line numbers, redact host paths, user names and identifiers, and normalize dashes to plain hyphens.
They are review artifacts, not resumable sessions or final release selections.

| Scenario | Observed result | Turn duration | Evidence |
|---|---|---|---|
| existing-repo / ts-shop | Four checks passed, actual checkout and boundary failures retained | 306611 ms | [summary](typescript/summary.json), [conversation](typescript/conversation.txt), [findings](typescript/findings.json), [checks](typescript/checks.json) |
| clear-goals | Both checks passed, no repeated goal questions or conditional reference reads | 133081 ms | [summary](clear-goals/summary.json), [conversation](clear-goals/conversation.txt), [findings](clear-goals/findings.json) |
| existing-repo-python / py-ledger | Project-fit check passed, native journeys passed and boundary failures retained | 284144 ms | [summary](python/summary.json), [conversation](python/conversation.txt), [findings](python/findings.json), [checks](python/checks.json) |
| existing-vision-delta | Reviewed candidate delta rubric passed, board interaction and exact approval blocked | 169931 ms + 6238 ms | [summary](vision-delta/summary.json), [conversation](vision-delta/conversation.txt), [baseline](vision-delta/baseline.md), [candidate](vision-delta/candidate.md) |

## Acceptance observations

AC-5: TypeScript conversation lines 9-23 show inspect, inventory and source discovery before any question.
Its actual native checks run at lines 38-45, citation checking precedes the recommendations, and all project files remain unchanged.
AC-7: line 53 asks whether the agreed total comes from service data or a core policy, names the pricing recommendation and blocks dependent implementation without inventing a policy.
The available scripted answer does not settle that distinction, so no policy answer or product edit was manufactured.
AC-6 and AC-38: clear-goals lines 8-37 establish approved goals and recommendations, with no goal interview.
Its observed commands open research briefs and enforcement guidance, but no vision, intent-interview or domain-language reference.
Reading the project's own VISION.md is part of the audit and is distinct from opening vision guidance.
AC-62: TypeScript findings centre the checkout total, service-price policy and web/core storage boundary.
Python findings centre public ledger imports, balanced postings, Decimal finite values and rounding, native Python checks and CSV/JSON compatibility.
The large cohesive ledger is retained rather than split because of size.
These are different evidenced recommendations, not one preset with renamed terms.

## Existing-vision delta rubric assessment

The [written rubric](../../../../docs/evaluation.md#existing-vision-delta-rubric) was in place before the scenario ran.
Conversation lines 14-19 establish a later approved portability decision and the missing accept/resist distinction before proposing a change.
The baseline remains unchanged, and the candidate adds two lines about personal backup and resisting accounts, sharing and recommendations.
Line 34 exposes the fault line between personal backup and an export designed for another reader.
The scripted author's review arrives only in the resumed turn, and line 47 presents exact additions tied to that reasoning while retaining every approved line.
No target file changed.
This passes review of a candidate delta and does not establish completed board approval.

Board build, launch and listener startup were observed.
Browser interaction, bound terminal verdicts and approval of the exact revision are blocked pending reachable author interaction and current feedback.
No verdict, approval or vision apply was manufactured.
The fixture has no application or native test suite, and the host explicitly reports missing captured starting-check evidence rather than readiness.

## Apply and compatibility

The registered command integration test, `selected root instruction merge and audit apply preserve scoped instructions, dirty work and the native journey`, uses the existing dirty-work fixture and public commands.
It inventories equivalent root instructions, previews without writes, applies selected AGENTS.md retention and CLAUDE.md deletion, runs the native quote journey, renders and applies the reviewed audit record and checks exact preserved bytes.
Scoped and local guidance, staged and unstaged user work, and Git state are preserved.
Final report writes invalidate prior findings evidence, which is refreshed before a final ready verdict.
Ancestor inventory and refusal controls retain their existing command-interface coverage.

The real recommendation runs authorized no selected project writes, and their native failures are not presented as readiness.
The TypeScript local HTTP journey exposes the mocked-versus-live price discrepancy, without claiming a deployed-provider probe pair.
The Python public opening-balance and CSV/JSON journeys passed.
The hosts additionally used the bundled Lavish presentation skill, which this procedure does not require.
The TypeScript Lavish report server failed to start and that interaction is blocked, with its HTML retained only in scratch.

Maintained enforcement and portable maintenance remain pending.
T4.3 owns the representative extension against the completed package.
Real Windows/macOS execution remains captain checklist evidence, and these Linux runs do not establish it.
