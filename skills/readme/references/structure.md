# README structure and template

The README is the first impression of a project and the first file an agent reads.
It answers four questions in order: what this is, why it exists, how to start, where to go next.
Everything else belongs in another file.

## Contents

- The job of the README
- Section order
- Profiles
- Template
- Grounding in real READMEs

## The job of the README

- A visitor decides in about thirty seconds whether to stay, so the first screen carries the value statement, the install path and the entry point.
- An agent has no prior context and cannot ask, so the README gives it facts it can act on: names, versions, copyable commands and where each deeper document lives.
- A search engine and the host's repository search read the title, the first paragraph, the headings and the repository metadata, so those carry the words people search for.
- The README is a living document.
  Update it in the same change that alters an install step, a command, a flag or a default.

## Section order

Lead with the problem and the promise, then make the first actions obvious and short.
Keep the order below unless a section does not apply, and drop the section rather than leave a placeholder.

| Order | Section | Job | Rule |
|---|---|---|---|
| 1 | `# Name` | The project or package name from its authoritative source | The only H1; repository, package, command and skill identifiers each match their own authoritative source and may differ |
| 2 | Value statement | What it is, who it is for and the outcome, in one or two sentences | Names the category and the technology in plain words; reusable as the repository description |
| 3 | Badges, optional | Facts a visitor checks: release, license, build | Only true, live badges; five at most; never the only place a fact appears |
| 4 | Why this exists | The problem in the reader's terms and what this does about it | Three to five lines; failure mode mapped to fix |
| 5 | Install or Quickstart | The shortest working path | Requirement, one copyable command, a verify command with expected output |
| 6 | Get started | The single entry point and the first useful action | Names one command or skill in bold; two steps at most |
| 7 | Examples | The smallest real use | Prompts or commands with sample output, marked synthetic when invented |
| 8 | What it covers | A scannable catalogue of commands, skills or playbooks | A table with a one-line job each, linked to the full reference |
| 9 | Configuration and auth | Where settings live and how credentials are supplied | Paths, environment variables, credential references; never inline secrets |
| 10 | Safety | What is read-only, what writes and what gates a write | Only for tools that act on something outside themselves |
| 11 | Troubleshooting | Symptom to action | A short table, or one link when the list is long |
| 12 | Docs, contributing, security, license | Where depth lives | One line each, linked, with the file named |

Rules that apply to every section:

- Open each section with the answer, then the detail.
- Keep a paragraph to four lines or fewer, and put each sentence on its own line in the source.
- Use a table for a catalogue, a code block for a command and a short list for steps.
- Link to the deeper document and say in the link text what the reader finds there.
- Give every command in a code block with a language tag, without a leading `$` or `>` so it copies cleanly.
- State what is pending or unsupported plainly instead of implying it works.

## Profiles

The order stays the same and the weight of each section shifts with the kind of project.

| Profile | Lead with | Keep short | Link out |
|---|---|---|---|
| Command line tool | Install, verify command, first read | Why this exists | Command reference, exit codes, configuration reference |
| Skill pack or plugin | The problem the skills fix, then the install path for each host | Per-skill detail beyond one line | Each skill's own file, contributing guide, glossary |
| Library or package | Install and the smallest working example | Feature list | API reference, changelog, migration guide |
| Service or application | What it does for a user, then the run path | Architecture | Deployment guide, architecture and decision records, runbooks |

For a skill pack, follow this shape:

1. State the promise in one sentence and who it is for.
2. Give a thirty second install path for each supported host, ahead of any explanation.
3. Map each common failure mode to the skill that fixes it.
4. List the skills in a scannable table with a one-line description.
5. Point to the files that hold process, standards, vocabulary and decisions.

## Template

Replace every bracketed item and delete a section that does not apply.

````markdown
# [name]

[One or two sentences: what it is, for whom, the outcome. Use the category and technology words a searcher would type.]

[Optional: up to five true badges.]

## Why this exists

[The problem the reader has, in their words.]
[What this does about it, and the one design stance that matters, such as read-only by default.]

## Quickstart

Requires [runtime and version] and [access prerequisite].

```sh
[install command]
[verify command]
```

[What the verify command prints when it works.]
[One-off alternative without installing, if one exists.]

## Get started

1. [First action, copyable.]
2. Run **`[single entry point]`** to [first useful result].

Example:

```text
[prompt or command and the smallest real output]
```

## What it covers

| [Command or skill] | What it does | Reference |
|---|---|---|
| `[name]` | [One line.] | [link] |

Run `[tool] --help` for the full surface.

## Configuration

| Item | Where | Purpose |
|---|---|---|
| [config file] | [path] | [what it holds] |
| `[ENV_VAR]` | environment | [what it sets and the default] |

Credentials are supplied by [reference mechanism], never written into the file.

## Safety

[Read-only default, what writes, the gate that guards a write, what is redacted.]

## Troubleshooting

| Symptom | Action |
|---|---|
| [what the reader sees] | [what to run or change] |

## Documentation

- Command reference, linked by its relative path: [what it holds].
- Agent instructions, linked to `AGENTS.md`: how an agent works in this repo.
- Contributing, Security and License, each linked to its file.
````

## Grounding in real READMEs

The structure follows the knowttl command line tool READMEs and two published skill pack READMEs.

- The eight knowttl `*-axi` READMEs share one H2 sequence: Why this exists, Quickstart, Use with your agent, What it covers, Safety, Configuration, Output and exit codes, Troubleshooting, Contributing, Security, License.
  Each runs about 150 to 180 lines, which is a sensible ceiling for a single tool with configuration and safety sections.
- They open with a short purpose line, then three to five lines on why the tool exists, then an install block that ends in a verify command and a sample of synthetic output.
- Their openers vary in search value.
  "Read Active Directory and LDAPv3 directories from the shell" names the product, the protocol and the action, so a searcher for those words finds it.
  "Client CLI and embedded skill for the Artium managed tools server" names no task, so it is the weaker model.
- Their "Use with your agent" section states honestly what each integration grants, and links to the skill's own file for the compact agent guide.
- Matt Pocock's skills README opens with a value proposition, gives a thirty second install for several tools, maps four failure modes to fixes under "Why these skills exist", and ends in a scannable reference list.
  Process, vocabulary and scope live in other files, and `AGENTS.md` stays short.
- Lauren Tan's pstack README opens with the problem, says what pstack is and why, gives a short install, names one entry point under "get started", shows example prompts, tabulates the skills and points to deeper docs.
  It is kept accurate as the plugin changes.
- Both skill pack READMEs and the tool READMEs agree on the shape: problem and promise first, a short obvious first action, scannable tables and links to deeper guides, and nothing that belongs elsewhere.
