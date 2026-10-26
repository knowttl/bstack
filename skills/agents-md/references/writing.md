# Writing the document

Use this reference when you draft or revise prose that a change set writes into the target: a vision, a glossary, a decision record, a design section, a README, a plan or an instruction file.
It does not apply to generated tables, schema fields or code.
Read it once at the drafting step, and apply it again when you revise after review.

## Pick the reader's need first

Before drafting, write down who will read the document and what they came to do.
Then choose one mode for it.
The [Diátaxis](https://diataxis.fr) framework names four modes, and this reference only names them:

| Mode | The reader wants to | The document does |
|---|---|---|
| Tutorial | learn by doing something small that works | leads one safe path and shows each result |
| How-to guide | finish a task they already understand | gives the steps for that one goal and leaves out the background |
| Reference | look up a fact | states the facts in the order of the thing they describe, with no argument |
| Explanation | understand why | gives context, causes and trade-offs, and leads to no task |

One document or section holds one mode.
When a reader needs two, write two sections or two documents and link them, because a how-to that stops to explain loses the reader mid-task and an explanation made of steps explains nothing.
State the mode choice in the draft notes, not in the document.

## Write plain prose

- Lead with the point. The first sentence of a document and of each section gives what the reader came for, and the support follows it.
- Say one thing per sentence. Split a sentence that carries two claims. A sentence that needs a second read is two sentences.
- Be concrete. Name the file, command, number, role or example instead of describing it, and give the exact text a reader must type or match.
- Use the active voice and name who acts: "the agent runs `check`", not "the check is run".
- Use one term for one concept, taken from the project's glossary when it has one. Do not rotate synonyms for variety, because a reader takes a new word for a new thing.
- Write for a reader who lacks your context. Define a term the first time it appears, and link or cite a source instead of assuming the reader knows it.
- Cut filler: intensifiers, hedges that carry no real doubt, announcements of what comes next, restatements of the section just read and closing summaries of a short document.
- Cut stock phrasing that fits any document: "robust", "seamless", "leverage", "in today's world", "it is important to note", "not just X but Y", and lists of three padded to sound complete.
- Do not narrate the process. Write what is true of the project, not how you worked it out or that a document "aims to" or "seeks to" do something.
- Use a list or table only for items that are parallel or steps that run in order. Keep reasoning, cause and trade-off in sentences.
- Make a claim only as strong as its evidence. Cite the source for a claim about the project, and label an inference as one. Never write a detail you did not observe.
- Match the target's existing style and heading names before applying a preference of this reference. Where the target has no convention in Markdown, put each sentence on its own line so a review diff shows one changed claim.

## Check before presenting

Read the draft once as the reader named at the start, with no other context.

- The first sentence answers what the reader came for.
- The document holds one mode, and nothing in it belongs to another.
- Every term matches the project's vocabulary, and every claim about the project has a source or an inference label.
- Deleting any sentence would lose something. If it would not, delete it.
