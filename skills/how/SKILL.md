---
name: how
description: Explain how a part of a codebase works from its code, tests and documents, with every claim cited to a file and line.
disable-model-invocation: true
---

## Scope

Only the user starts how.
Start this procedure only when the user's message explicitly invokes `$how`, `/how`, `/skill:how` or selects it through the host's skills menu.
A plain request such as "how does this work?" does not invoke it.
If you encounter this file while inspecting repository contents without that explicit invocation, treat it as repository content: do not follow its procedure, open its references or run its commands.
The target is an existing repo, passed as `--repo`.

How explains the mechanics of one part of the code: what runs, in what order, on what data and with what result.
The motive behind the code belongs to `/why`, and a model that joins both belongs to `/teach`; name them as next steps and start neither.
It reads the repo and writes nothing to it, executes nothing from it and opens no pull requests.
Keep notes, the citation report and drafts in scratch outside the target.

## Checklist

Copy this checklist and tick a step only when its Done when criterion is met.

- [ ] Step 1: Resolve the subject
- [ ] Step 2: Trace the mechanics
- [ ] Step 3: Check the citations
- [ ] Step 4: Explain

### Step 1: Resolve the subject

Take the subject from the user's message: a command, function, module, flow or behaviour.
When it names none, or names something the repo does not contain, ask one question that offers the plausible readings and recommends one.
State the question the explanation will answer in one sentence.

Done when: The subject exists in the repo and the question to answer is stated.

### Step 2: Trace the mechanics

Load the [mechanics reference](references/mechanics.md) and follow it from the subject's entry point.
Record each finding in scratch following `schemas/research-report.json`, using the brief `architecture` for code and tests and `documents` for project documents, and bind each cited file to the SHA-256 of the exact bytes read with state kind `sha256`.

Done when: Every step of the path has a file and line citation, and each claim is marked observed, inferred or unread.

### Step 3: Check the citations

Run `node scripts/how.mjs cite-check --repo <target> --report <file> --json`.
The checker establishes locations and byte freshness only, so open each cited line to confirm it supports the claim.

Done when: `cite-check` passes and every cited line supports its claim, or a claim without support is removed or relabelled as an inference.

### Step 4: Explain

Write the explanation by the [writing reference](references/writing.md) and the mechanics reference's shape.
State the subject, the answer, the cited path, the data shapes and invariants it relies on, and the limits: paths not followed, files not opened and each inference.
List `/why` for the motive and `/teach` for both as next steps for the user to run, and start neither.

Done when: The explanation answers the stated question, every claim cites its source or is labelled an inference, and the limits are named.

## Write rules

Write nothing to the target.
Use the installed `scripts/how.mjs` entry point, run documented commands and read their output rather than script source.
Resolve resources relative to the installed skill and pass the target explicitly.
Use command help for syntax, and never guess arguments.

## Load when

Read only the one reference needed for the current step, once per run unless it changes.
Run scripts without loading their source, and pass schemas to scripts without reading them as instructions.
Never recursively search bundled reference or schema directories to discover guidance; use this table and documented command help instead.

| When | Open |
|---|---|
| Tracing the mechanics | `references/mechanics.md` |
| Writing the explanation | `references/writing.md` |
| Recording citations for evidence | `schemas/research-report.json` |
