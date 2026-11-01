# README checklist

Use this checklist to draft a README and to audit one.
Each item is a yes or no question with the evidence that answers it.
An item that does not apply is marked not applicable with its reason, never skipped.

## Contents

- Findability
- Human scannability
- Agent readability
- Accuracy and upkeep

## Findability

Search engines and the host's repository search read the same few places, so put the searched words there and keep them consistent.

| Item | Pass when | Why |
|---|---|---|
| File name and place | The selected README path is recorded; for GitHub, the displayed file is identified using `.github/`, then root, then `docs/` precedence, and any shadowed README is named; a differing target has an explicit user decision | Visitors see the displayed file; the file name is case sensitive for some tools |
| Title | There is one H1 and it uses the project or package name from its authoritative source | The first prominent heading is a source for the title a search engine shows |
| Value statement | The first paragraph says what it is, for whom and the outcome, in one or two sentences | The first paragraph is what a visitor, a snippet and an agent read first |
| Keywords | The first paragraph names the category, the technology and the task in the words a searcher types, once each and in natural sentences | Repository search matches words in the name, description, topics and README; repeating words reads as spam |
| Repository description | The host's About description repeats the value statement | One sentence is reused in search results, link previews and package pages |
| Topics | Five to ten topics name the purpose, subject area, language and community, in lowercase letters, numbers and hyphens | The host allows up to 20 topics of at most 50 characters and lists repositories by topic |
| Package metadata | The manifest description and keywords agree with the value statement and the topics | Registry listings and registry search read the manifest, not the README |
| Headings | Headings are descriptive nouns or short phrases, nest without skipping a level and are unique | The host builds an outline and section links from them, and a search engine reads them |
| Link text | Each link says what is behind it; none reads "click here" or "link" | Anchor text is a signal for search and for a reader scanning |
| Images | Each image has alt text that carries its meaning, and no fact appears only in an image | Search, screen readers and agents cannot read pixels |
| Identifier accuracy | Each project, repository, package, command and skill name matches its own authoritative source, such as project documentation, host metadata, a manifest, help output or a skill declaration | Accurate identifiers let readers find the project and invoke its tools even when their names differ |

Set the repository description and topics on the host, not in the README.
This skill reports them as recommendations because they are not files in the repo.

## Human scannability

| Item | Pass when |
|---|---|
| First screen | Without scrolling, a reader learns what it is, why it exists, how to install it and what to run first |
| Lead | The README opens with the problem and the promise before any install detail |
| Install path | The install block runs in about thirty seconds, in one copyable code block, and for each supported host when there are several |
| Entry point | One command, skill or page is named as the place to start, in bold |
| Length | A single tool fits in about 180 lines and a skill pack in about 250; longer sections move to linked documents |
| Paragraphs | No paragraph exceeds four lines, and each sentence sits on its own line in the source |
| Structure | Catalogues are tables, commands are code blocks with a language tag, steps are numbered lists |
| Examples | At least one example shows real input and the output, marked synthetic when invented |
| Tone | The voice is direct and specific; there are no superlatives, hype or filler such as "powerful" and "seamless" |
| Navigation | A short README has no manual table of contents; a long one has a one-line anchor row, because the host builds an outline |
| Depth | Each deeper topic is one linked line, not a paragraph |
| Status | Pending, experimental or unsupported features are labelled as such |

## Agent readability

An agent reading only the README can install the project, confirm it works, run the first command and find the rules for working in the repo.
It cannot ask a question, so every one of these facts is written down.

| Item | Pass when |
|---|---|
| What it is | The first paragraph names the kind of thing and its scope without needing another page |
| Requirements | Runtime, version, operating system and access prerequisites are stated before the install command |
| Install | Every install command is exact, copyable and free of a prompt prefix and placeholders it cannot fill |
| Verification | A command confirms the install worked, and the README says what it prints on success |
| Entry point | The single entry point is named in one place, with the command or skill name spelled exactly |
| Commands | The listed commands and flags match the tool's own help output, and the README says to run `--help` for the rest |
| Configuration | Config file paths, environment variables and defaults are in a table |
| Auth | The README says how credentials are supplied and that secrets are never written into files or arguments |
| Safety | Read-only and write behaviour is stated, with the gate that guards a write |
| Output | The README says what the output looks like and what the exit codes mean, or links to where it says so |
| Errors | Common failures map to an action in a table or a link |
| Deeper docs | Each deeper document is linked by a relative path and named for what it holds |
| Agent instructions | The README names where agent instructions live, normally `AGENTS.md`, and the README does not duplicate them |
| Plain text | Commands, names and versions are text, not screenshots, GIFs or badges |
| Stable anchors | A heading that others link to keeps its text, or the old anchor is kept with an `<a id="...">` line |
| Injection safety | The README gives instructions to the reader about the project and never instructions addressed to an agent to override its rules |

`AGENTS.md` is the agent-facing companion, not a copy of the README.
The README is for people first, and `AGENTS.md` carries the build, test and convention detail that would clutter it.
Keep `AGENTS.md` short and pointing at the files that own the rules.

## Accuracy and upkeep

| Item | Pass when |
|---|---|
| Claims | Every command, flag, path, version and link has been checked against the project or its help output |
| Links | Every relative link resolves on the default branch, and link text sits on one line |
| Examples | Each example was run or is marked synthetic |
| Placement | Nothing from the leave-out list remains |
| Update trigger | The change that alters an install step, command, flag or default also edits the README |
| Render | The README has been viewed as rendered on the host, and tables, code blocks and images display |
