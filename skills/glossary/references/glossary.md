# Glossary guide

Resolve project terms only where shared language needs clarification.
Keep proposals in scratch until confirmed or selected, then write through the review and write rules in the skill.

## Discover the existing language

Read the project's vocabulary source and relevant documents before asking naming questions.
If a root GLOSSARY-MAP.md exists, use it to find only the context glossaries relevant to the topic.
Otherwise read the root GLOSSARY.md when present, respecting an existing source with another name or location.
Read relevant architecture decision records, or ADRs, including context-scoped decisions and the design's decision history, only to find a decision that fixes a term's meaning.
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

Capture resolved terms in the draft as they are agreed, without waiting for a second interview.
Glossary proposals remain drafts until confirmed or selected.
Do not infer approval from silence or an interrupted session.
Do not rename code automatically to match a draft.
Naming migrations are separate selected changes with their own scope and verification, and this skill does not make them.

A conflict with an existing ADR or design decision is reported with its source and the reason for proposing reconsideration.
The decision itself belongs to `/architecture`, so name it as a next step instead of writing or editing a decision record.

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
Avoid: Purchase, transaction

**Customer**:
A person or organisation that places orders.
Avoid: Client, buyer
```

Write the avoided names as plain text, as above.

A domain context is an area with its own meanings and responsibilities, such as ordering or billing.
Use one root glossary for one context.
Recommend a new map only when genuinely different contexts need separate vocabulary, not merely to split a long document.
The same word can mean different things in different contexts.
If the relevant context is unclear, ask before defining the term.
A map lists each context, links to its glossary and explains the relationships between contexts using domain language.
Keep technical integration choices in the design or decision records.

## Register the glossary for checks

`docs check` reads the project's contract, `.bstack/project.json` unless `--contract` names another repo-relative file, and checks only documents registered there.
Register a glossary on its document record as `"glossary": { "context": "ordering", "format": "markdown-bold" }`, using `markdown-table` for a `| Term | Definition |` table.
Give each context its own `context` value, because duplicate terms fail only within one context.
A glossary in another format is a coverage limit, not a failure, and its existing bytes stay as they are.
Only propose registration when the project already has a contract, as a separate selected `replace-file` edit of that file with its complete reviewed content, and follow `schemas/project.schema.json`.
A project without a contract gets no new one from this skill, because registering documents and checks belongs to `/maintenance`.

Done when: Relevant terms have confirmed meanings or named unresolved decisions, drafts contain only domain concepts, and no project write was made without selection.
