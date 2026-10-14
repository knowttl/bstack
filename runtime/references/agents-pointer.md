# AGENTS.md pointers

The root `AGENTS.md` is a list of one-line pointers to the project's rules, evidence requirements and check commands.
It holds no copy of any source: definitions, rules and commands stay in the file they came from.
`/agents-md` owns the file, its structure, the `CLAUDE.md` merge and the pointer audit, and every other skill adds only the line for what it wrote.

## Shape

The file starts with the heading `# Agent instructions`, followed by one pointer per line.
A pointer is one plain sentence that tells an agent when to use a source, with exactly one relative Markdown link to it.
The link text is the path as written in the repo, and the destination is that same relative path.
Keep each sentence on its own line, with no bullets, so a pointer is added or removed without touching its neighbours.

Written without its links, a file with two pointers reads:

```md
# Agent instructions

Use the domain terms in GLOSSARY.md when naming things.
Check product changes against the purpose and non-goals in VISION.md.
```

In the real file, `GLOSSARY.md` and `VISION.md` are each the text and the destination of a Markdown link.

## Adding a pointer

A skill proposes its pointer as a separate edit in the same reviewed plan that writes its document, and only when the user selects it.
Read the target's root instruction files first, then use the first case that applies:

| Root state | Edit |
|---|---|
| `AGENTS.md` exists | `append-line-once` on `AGENTS.md` with the pointer line, which leaves the file unchanged when the line is already there |
| No `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` | `create` `AGENTS.md` with the heading, a blank line and the pointer line |
| No `AGENTS.md`, but a root `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` | No edit: Claude Code reads those files instead of `AGENTS.md`, so name `/agents-md` as the next step for the user to run |

Never rewrite other lines of the file, and never add a pointer for a document that was not written.
