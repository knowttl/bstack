# Sources for the README guidance

Each source below was read on 2026-11-01.
The table says which rule of the skill it supports, so a rule can be rechecked against its source when the source changes.

## Contents

- Published guidance
- Published READMEs
- What the sources support

## Published guidance

| Source | Supports |
|---|---|
| [About the repository README file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes), GitHub Docs | A README says what the project does, why it is useful, how to get started, where to get help and who maintains it; the host shows `.github`, then root, then `docs`; content beyond 500 KiB is truncated; the host builds an outline and section links from headings; relative links are recommended; a README holds only what is needed to get started and contribute, with longer documentation elsewhere |
| [Classifying your repository with topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics), GitHub Docs | Topics name purpose, subject area, community or language and appear on the repository page; lowercase letters, numbers and hyphens, 50 characters or fewer, at most 20 |
| [Searching for repositories](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories), GitHub Docs | Repository search matches the name, description, topics and README through `in:name`, `in:description`, `in:topics` and `in:readme` |
| [READMEs](https://google.github.io/styleguide/docguide/READMEs.html), Google Style Guides | The file is named `README.md`; it sits in the top-level directory of the code; it says what the package is and is used for, who to contact, its status, how to use it with examples and where the documentation is |
| [Make a README](https://www.makeareadme.com/) | Name, description, badges, visuals, installation, usage with expected output, support, roadmap, contributing, license and status sections; use examples liberally; a README too long is better than too short, and depth can move to other documentation |
| [Influencing title links in Google Search](https://developers.google.com/search/docs/appearance/title-link), Google Search Central | A search engine builds a title from the title element, the main visual title and heading elements; put the main title in the first visible `<h1>` and make it distinctive |
| [AGENTS.md](https://agents.md/) | `README.md` is for humans, with quick starts and descriptions; `AGENTS.md` is a separate, predictable place for the build steps, tests and conventions agents need, and it complements the README without cluttering it |
| [Diataxis](https://diataxis.fr/) | Documentation has four needs, tutorials, how-to guides, reference and explanation, so a landing page should not try to be all four and should link to each |

## Published READMEs

| Source | Supports |
|---|---|
| [Matt Pocock, skills](https://github.com/mattpocock/skills) | A value proposition first, a thirty second install for several tools, why the skills exist mapped from failure modes to fixes, then a scannable list; process, scope and vocabulary live in `CONTRIBUTING.md`, `SCOPE.md`, `GLOSSARY.md` and `docs/`, and `AGENTS.md` stays short |
| [Lauren Tan, pstack](https://github.com/cursor/plugins/tree/main/pstack) | A direct voice that opens with the problem, then what it is and why, a short install, a two step get started naming the single entry point, example prompts, a table of skills and links to deeper docs, kept accurate as the plugin changes |
| [knowttl az-axi](https://github.com/knowttl/az-axi), [mg-axi](https://github.com/knowttl/mg-axi), [vectra-axi](https://github.com/knowttl/vectra-axi), [ldap-axi](https://github.com/knowttl/ldap-axi), [tenable-axi](https://github.com/knowttl/tenable-axi), [awx-axi](https://github.com/knowttl/awx-axi), [artium-axi](https://github.com/knowttl/artium-axi) and [falcon-axi](https://github.com/knowttl/falcon-axi) | One H2 sequence for agent-facing command line tools, an install block that ends in a verify command, honest "Use with your agent" and safety sections, configuration tables, exit codes and troubleshooting tables, and 150 to 180 lines each |

## What the sources support

- Structure and order: the GitHub, Google and Make a README sources agree on what a README says, and the skill pack and tool READMEs show the order.
- Findability: GitHub search and topics, and the Google title guidance, support the title, first paragraph, headings, description and topics rules.
- Agent readability: the AGENTS.md source supports keeping agent instructions out of the README and pointing at them, and the tool READMEs show the verify command, configuration tables and honest status that let an agent act without asking.
- Leave-out list: the GitHub guidance on README scope, Diataxis and the skill pack READMEs support moving reference, process, vocabulary and decisions to their own files.
- Length ceilings of about 180 lines for a tool and 250 for a skill pack, five badges, five to ten topics and four-line paragraphs are this skill's working guidance from those READMEs, not figures any source publishes.
