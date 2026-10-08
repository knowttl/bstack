# Domain language

Resolve project terms alongside the intent interview or audit only where shared language needs clarification.
Keep proposals in scratch until confirmed or selected, then use the main procedure's review-before-apply and protected write boundary for project edits.

## Discover the existing language and decisions

Read the project's vocabulary source and relevant documents before asking naming questions.
If a root GLOSSARY-MAP.md exists, use it to find only the context glossaries relevant to the topic.
Otherwise read the root GLOSSARY.md when present, respecting an existing source with another name or location.
Read relevant architecture decision records, or ADRs, including context-scoped decisions and the design's decision history.
Missing glossary or ADR filenames are not readiness failures.
Do not create empty documents or directories upfront.

For an existing project without a glossary, derive candidate terms from documented domain concepts and relevant code.
Distinguish established definitions from inferred meanings.
Code shows current behaviour, not proof of the intended definition.
Propose a glossary only when shared language would help.
For a new project, draft it when the user agrees on the first useful project-specific term.

## Resolve meanings

Surface conflicting definitions with file citations and a targeted question.
For example, if documentation defines cancellation for an entire order but code allows cancellation of one item, ask which meaning is intended.
Challenge vague or overloaded terms by proposing precise canonical names.
Distinguish a customer account from a user login when the project treats them as different concepts.
Use concrete scenarios to test relationships and boundaries where unclear.
Resolve prerequisites first, giving a recommendation and trade-off with each decision question.
Group only independent questions into a small round and wait for answers.

Capture resolved terms in the draft during the selected foundation session, without waiting for a second interview.
Glossary proposals remain drafts until confirmed or selected.
Do not infer approval from silence or an interrupted session.
Use confirmed vocabulary in module names, interfaces, findings and proposed changes.
Do not rename code automatically to match a draft.
Naming migrations are separate selected changes with their own scope and verification.

## Glossary format and contexts

Each entry defines one project concept in one or two sentences.
Record its canonical name and conflicting synonyms where useful.
Include only project-specific domain concepts, not a generic programming dictionary.
Keep feature requirements, implementation steps, storage details and coding rules in their appropriate sources.
Group terms only when natural clusters help.
Adapt this minimal format to the project's existing conventions:

```md
# Ordering

The context that receives and tracks customer orders.

## Language

**Order**:
A customer's request for a set of products.
_Avoid_: Purchase, transaction

**Customer**:
A person or organisation that places orders.
_Avoid_: Client, buyer
```

A domain context is an area with its own meanings and responsibilities, such as ordering or billing.
Use one root glossary for one context.
Recommend a new map only when genuinely different contexts need separate vocabulary, not merely to split a long document.
The same word can mean different things in different contexts.
If the relevant context is unclear, ask before defining the term.
A map lists each context, links to its glossary and explains the relationships between contexts using domain language.
Keep technical integration choices in the design or decision records.

## Keep decisions separate

Surface a conflict with an existing ADR or design decision explicitly, with its source and the reason for proposing reconsideration.
Use the project's established decision location and format.
An existing design decision history can suffice.
Offer a separate ADR only when the choice is hard to reverse, surprising without context and the result of a real trade-off.
Do not create a record for every setup choice.

When no format exists and a separate ADR is selected, use docs/adr/ with sequential names such as 0001-slug.md.
Inspect existing numbering and use the next number.
Create the directory only through a selected write when a real decision needs recording.
The minimal format is a short title followed by one to three sentences explaining the context, decision and why it was chosen.
Add status, considered options or consequences only when they add useful context.
Keep proposed decisions separate from accepted ones.

Done when: Relevant terms have confirmed meanings or named unresolved decisions, drafts contain only domain concepts, and meaningful technical decisions remain in their appropriate sources with no unselected project writes.
