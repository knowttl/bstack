# Grilling

Resolve only decisions that would change the requested recommendation.
Use the user's explanation and, for an existing project, the initial audit as the starting point.
Retain settled decisions and distinguish documented goals, observed behaviour and inferred intent.

## Decision rounds

Map the unresolved choices as a decision tree, with each parent above the decisions that depend on it.
Resolve parent decisions first.
A question is ready only when its prerequisites are settled.
An unanswered question or missing factual evidence keeps its dependent questions blocked.

Find facts in the repo, available documentation and environment rather than asking the user to look them up.
Use read-only research under the main procedure's research rules where needed.
Continue independent questions while factual research is unresolved.
Decisions belong to the user.

Ask a small round of independent questions, numbering each question and giving a recommended answer with the relevant trade-off.
For example:

> Q1 - Must the first useful journey work offline?
> Recommendation: start online if connectivity is available to the intended users, because offline writes add synchronisation decisions.
> If offline use is required, resolve that requirement before recommending the data and deployment shape.

Wait for answers before the next round.
Use each answer to reshape the tree and identify the next ready questions.
Do not place a question in the same round as an unresolved prerequisite.
Do not reopen approved choices merely to complete an interview.

## Confirm the outcome

Finish when every material branch is resolved or its uncertainty and dependent recommendation are explicitly blocked.
Summarise the agreed goal, boundaries, decisions and remaining uncertainties concisely.
For an existing project, cite supporting files and separate documented goals from inferred behaviour.
Ask the user to confirm new or changed intent before dependent implementation.
An already approved vision needs no repeat confirmation when unchanged.
Silence and an interrupted session do not count as confirmation.

Done when: Material decisions are resolved or named as blockers, and the user has confirmed any new or changed intent before dependent work.
