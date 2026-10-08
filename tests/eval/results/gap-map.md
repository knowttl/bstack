# T1.3 baseline-to-guidance map

The recorded T1.2 baselines stand without new agent sessions in C8.
This review maps observed gaps to the first procedure, without claiming that prose or package validation proves model behaviour.
All approved cases remain required, including those already passing without the skill.
No advice was removed, so no ablation run was needed.

The [new-idea scoring record](runs/2026-10-08T03-14-25.779Z-868cd552-80e0-4265-9e06-5a2f8bab4bc7/af3f704e-a982-4e92-9cfa-4d85caab821f/answers.json) records three failures in the [transcript](runs/2026-10-08T03-14-25.779Z-868cd552-80e0-4265-9e06-5a2f8bab4bc7/af3f704e-a982-4e92-9cfa-4d85caab821f/transcript.txt).
Their requirement sources are AC-1 and AC-9 in the design and the unchanged new-idea scenario checklist.

| Failed baseline check | Observation | Sentence or step in SKILL.md |
|---|---|---|
| interview, AC-1 | Transcript lines 1 to 13: the agent read the brief and wrote VISION without interviewing | Step 1: "Begin with the intent interview before recommending implementation, even when a brief already supplies goals and a stack." Its Done when criterion requires confirmation of new or changed intent and resolved or blocked dependent decisions |
| terms, AC-9 | Transcript lines 10 to 13 and the retained generated VISION: browser local storage appeared among domain terms | Step 2: "Keep storage choices, frameworks and other implementation details in the design instead of treating them as domain terms." Its Done when criterion excludes implementation details and empty entries |
| vision, AC-1 | Transcript lines 10 to 13: approval of goals and stack was treated as approval of the generated VISION | Step 3: "Approval of a brief's goals or stack does not approve the generated VISION.md." Its Done when criterion requires board verdicts and explicit approval of the current draft revision |

The [procedure](../../../skills/repo-audit/SKILL.md) retains passing requirements as well.

| Passing baseline | Required behaviour retained | Procedure |
|---|---|---|
| ambiguous-idea, AC-2, 1/1 | Expose the undecided offline-access choice and stop dependent recommendations without inventing a goal or stack | Scope and Step 1 keep dependent work blocked while consequential decisions remain open |
| clear-goals, AC-6, 1/1 | Reuse approved documents without asking the user to repeat goals | Steps 7 and 8 audit first and proceed directly to recommendations when evidence answers the questions |
| clear-goals, AC-38, 1/1 | Avoid opening interview, vision and domain-language references without corresponding gaps | Step 8 and Load when restrict reference reads to the current need |

Review before apply, protected writes, per-change AGENTS.md approval, source-based verification, live probes and read-only research with a sequential fallback remain required regardless of baseline scores.
The clear-goals parent-directory search observation stays in the historical record without creating a new scoring criterion.
Unavailable references, board review, discovery, measurement, findings, writes, probes and maintenance helpers are labelled with their owning tasks.
The baseline contains no with-skill observations.
T1.7, the foundation checkpoints and T5.2 must exercise the completed procedures and compare the same fixture revision, agent, model, adapter, stage and criteria.
