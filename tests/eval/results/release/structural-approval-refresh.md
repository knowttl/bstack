Historical (v0.1.0): the per-run independent-verification.json files cited below were removed when machine assertions replaced them.

# Final evidence after the structural assessment gate

These runs refresh installed evidence after the assessment apply command began requiring the exact approved preview fingerprint.
They use the unchanged fixture revision `8e436639af6ca78c93bb61e759d643c4f304bd66`, pinned container toolchain and scoring criteria recorded in each run.
Baselines are reused only when their fixture, request, scripted answers, invocation, model, toolchain and criteria match.

| Scenario | Baseline | Installed final | Comparison | Actual independent evidence |
| --- | --- | --- | --- | --- |
| Maintenance | [Recovered 2/2](runs/2026-10-12T04-45-26.611Z-fbd0fe89-a41e-4279-81b1-89a41665e542/run.json) | [2/2](runs/2026-10-12T04-27-29.341Z-6937f05c-d20f-4149-9dc0-f5d2c2aebedc/run.json) | [Passed](maintenance-structural-comparison.json) | Baseline verification (removed file: runs/2026-10-12T04-45-26.611Z-fbd0fe89-a41e-4279-81b1-89a41665e542/artifacts/independent-verification.json), installed verification (removed file: runs/2026-10-12T04-27-29.341Z-6937f05c-d20f-4149-9dc0-f5d2c2aebedc/artifacts/independent-verification.json) |
| Implicit invocation | [1/1](runs/2026-10-11T22-34-43.903Z-0a944d91-fd0d-4582-a6e5-211439bb9ef5/run.json) | [1/1](runs/2026-10-12T04-45-36.615Z-bd2df85f-9bcc-45fe-a9ff-f41d06c35512/run.json) | [Passed](implicit-invocation-structural-comparison.json) | Three tracked files unchanged (removed file: runs/2026-10-12T04-45-36.615Z-bd2df85f-9bcc-45fe-a9ff-f41d06c35512/artifacts/independent-verification.json) |
| Ambiguous idea | [1/1](runs/2026-10-11T22-27-46.145Z-6c0b6ea4-5b79-4af5-bc01-882034bcb401/run.json) | [1/1](runs/2026-10-12T04-47-09.943Z-05a54e3e-aa12-497a-abbe-f1941aadc57f/run.json) | [Passed](ambiguous-idea-structural-comparison.json) | Original brief unchanged (removed file: runs/2026-10-12T04-47-09.943Z-05a54e3e-aa12-497a-abbe-f1941aadc57f/artifacts/independent-verification.json) |
| Scope and prerequisites | [2/2](runs/2026-10-11T22-46-18.504Z-1a2828d2-377d-4338-8e02-6a067a511a17/run.json) | [2/2](runs/2026-10-12T04-48-49.478Z-9a4ead0d-d657-41cc-8d15-b28428a3ff50/run.json) | [Passed](scope-and-prerequisites-structural-comparison.json) | Seven tracked files unchanged (removed file: runs/2026-10-12T04-48-49.478Z-9a4ead0d-d657-41cc-8d15-b28428a3ff50/artifacts/independent-verification.json) |
| Runtime independence | [0/1](runs/2026-10-11T23-19-36.297Z-6a14a0c1-4e0f-4365-9711-31c7e8ab71b3/run.json) | [1/1](runs/2026-10-12T04-53-27.879Z-be325203-026a-4a36-a1ed-b31cd377684e/run.json) | [Passed](runtime-independence-structural-comparison.json) | Three tracked files unchanged (removed file: runs/2026-10-12T04-53-27.879Z-be325203-026a-4a36-a1ed-b31cd377684e/artifacts/independent-verification.json) |
| Verification limitations | [3/3](runs/2026-10-11T23-26-56.348Z-ef5c15c9-02c6-4742-9b29-3d7eea18e530/run.json) | [3/3](runs/2026-10-12T04-56-30.964Z-74853b71-cdad-4d02-8efd-ac6c04266046/run.json) | [Passed](verification-limitations-structural-comparison.json) | 21 tracked files unchanged (removed file: runs/2026-10-12T04-56-30.964Z-74853b71-cdad-4d02-8efd-ac6c04266046/artifacts/independent-verification.json) |
| Python main-thread research | [0/3](runs/2026-10-12T00-05-31.655Z-a2ad260b-af0a-428a-8e0a-d5fdfcce6348/run.json) | [3/3](runs/2026-10-12T04-57-08.452Z-cca21275-7e53-4120-8fcd-975454844701/run.json) | [Passed](research-main-python-structural-comparison.json) | 37 citations verified (removed file: runs/2026-10-12T04-57-08.452Z-cca21275-7e53-4120-8fcd-975454844701/artifacts/independent-verification.json) |
| TypeScript main-thread research | [0/3](runs/2026-10-11T23-59-20.195Z-b3df9a3f-8bb2-41b0-bd6a-dfff0defdcdf/run.json) | [3/3](runs/2026-10-12T04-57-10.357Z-a654bbce-6af2-4fa9-b6f8-fca745c4fdff/run.json) | [Passed](research-main-typescript-structural-comparison.json) | 67 citations verified (removed file: runs/2026-10-12T04-57-10.357Z-a654bbce-6af2-4fa9-b6f8-fca745c4fdff/artifacts/independent-verification.json) |
| Python existing-repo audit | [3/4](runs/2026-10-11T23-21-43.463Z-7df859b5-5cba-42e3-9ce6-3488363289f2/run.json) | [4/4](runs/2026-10-12T04-58-45.555Z-1fff6179-4cc7-4f22-835a-9608df8a6659/run.json) | [Passed](existing-repo-python-structural-comparison.json) | 11 tracked files unchanged (removed file: runs/2026-10-12T04-58-45.555Z-1fff6179-4cc7-4f22-835a-9608df8a6659/artifacts/independent-verification.json) |
| Clear goals | [2/2](runs/2026-10-12T00-16-39.505Z-c5f6296f-448a-409f-a281-b6747c9e2bfd/run.json) | [2/2](runs/2026-10-12T05-00-22.123Z-14278fc4-143e-4778-80ef-e50b1bf05c3f/run.json) | [Passed](clear-goals-structural-comparison.json) | Three documents unchanged (removed file: runs/2026-10-12T05-00-22.123Z-14278fc4-143e-4778-80ef-e50b1bf05c3f/artifacts/independent-verification.json) |
| Selected rule relocation | [1/1](runs/2026-10-12T05-08-46.399Z-bc781f92-81bc-45fe-8cf9-bb3d58c4b305/run.json) | [1/1](runs/2026-10-12T05-08-47.669Z-8c0a0286-ea97-4617-a283-bbe14d6d884e/run.json) | [Passed](selected-rule-relocation-structural-comparison.json) | Baseline exact move (removed file: runs/2026-10-12T05-08-46.399Z-bc781f92-81bc-45fe-8cf9-bb3d58c4b305/artifacts/independent-verification.json), installed exact move (removed file: runs/2026-10-12T05-08-47.669Z-8c0a0286-ea97-4617-a283-bbe14d6d884e/artifacts/independent-verification.json) |

## Recovery of the interrupted maintenance baseline

The replacement baseline is one authorized recovery of `2026-10-12T04-07-52.088Z-d5865a6d-5ca3-43b9-8bbf-63b9335ad381`, which was deliberately interrupted and never scored.
The replacement consumed the unchanged amended two-answer protocol in three turns.
It initially stopped because the requested skill reference was absent; after the original unchanged-pricing reply, it completed the bounded refactor using existing approved sources.
It preserved the three authoritative documents, existing contract, historical snapshot and original checks.
Its separately committed no-impact assessment cites 15 independently verified literal sources.
Fresh standalone results passed in the working checkout and a different-root clean clone; all 25 tracked clone files match.
The [37 native artifacts](runs/2026-10-12T04-45-26.611Z-fbd0fe89-a41e-4279-81b1-89a41665e542/artifacts/export-manifest.json) were exported before scoring cleaned the throwaway home.
The baseline explicitly reports that no protected-write procedure was available, without claiming to have performed one.

The passing installed run is reused unchanged from the [structural approval capture](maintenance-structural-approval-final.md).
Both runs pass the two design-derived rubric checks; the comparable pair therefore satisfies the all-already-passing branch of the design's pass rule.
The old one-answer comparison remains retained as rejected history, and the interrupted baseline remains unscored.

The other completed pairs preserve unresolved choices and unavailable prerequisites without inventing successful implementation or product readiness.
The implicit-invocation transcript reads the independently provisioned Lavish dependency guidance and target documents, while leaving the repo-audit skill and its procedures unstarted.
The scope run genuinely fails to resolve `HEAD^`, names missing parent `4c30913019f94a99eab09a7387a214ddd0ce12da`, and leaves the exact comparison blocked.
Independent host verification confirms this remains a shallow repository and `git rev-parse --verify HEAD^` exits 128.
The original public quote test passes, but it does not resolve the owner scope question or missing history.

Runtime independence confirms all three excluded commands are actually unavailable in the isolated host, while the bounded audit completes through shipped helpers and native tools.
The verification-limitations run preserves passing native units alongside the prohibited browser flow, actual bounded health connection refusal and unapproved billing POST boundary.
Its first health attempt records unavailable curl; the actual Python GET then records connection refusal within the five-second bound.
No billing call was executed.

Both discovery-only research runs contain five ordered main-thread briefs with effective subagent and web capabilities recorded as false.
The shipped citation checker passed, and independent verification checked every cited file hash and main-thread file-opening trace: 67 TypeScript citations and 37 Python citations.
No native project checks, network research, invented measurements or fixture writes were performed.
The no-web reason appears in each language and outside finding, with its supporting limitations.

The Python audit uses the prepared Python 3.12.15 interpreter and Ruff 0.14.0.
Unittest and Ruff pass; the existing boundary checker fails with `private`, and readiness does not erase that violation.
The actual startup journey verifies matching CSV/JSON rows, a public import round trip, cash `10`, equity `-10` and a balanced ledger.
Recommendations retain CONTRIBUTING.md as the existing standards authority, the cohesive ledger owner and thin startup wiring.
They propose stronger native boundary coverage and public journey protection without applying changes.

Remaining scenarios, automated procedures, full-suite capture and release acceptance are still pending.

The clear-goals run consumes both scripted answers without repeating the settled goal or terminology interviews.
Its observed loading trace never opens the vision, intent-interview or domain-language references.
The selected-rule runs both wait for exact approval, move the two original ownership sentences verbatim into one authority, and replace the original rule with a valid section link.
Independent byte checks confirm the unrelated guidance, Python source and original tests remain unchanged.
Both runs pass the unchanged two native unit tests and Ruff, while preserving the existing private-import boundary failure.
The installed run additionally executes the real CSV/JSON export and public import journey; the baseline does not claim that additional journey.
The design-derived relocation rubric passes on both sides without requiring overall project readiness.
