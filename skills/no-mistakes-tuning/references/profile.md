# Balanced review profile

This profile keeps the no-mistakes review on defects that a real user or caller would hit.
It bounds the automatic fix loop and keeps trivial changes out of agent review.
Start from these values and change one only with a reason from the repo or its run history.
Every key is in the configuration surface reference.

## Contents

- Why this profile
- Values
- Focus instruction
- Trivial changes
- Finding classes
- Per-run skips
- Driving rules
- Global recommendations

## Why this profile

These patterns come from several thousand recorded runs across about thirty repositories, most of them on no-mistakes v1.84.0.

- About a third of review findings were defects that ordinary use would hit.
  About a third were rare edge cases: concurrency or crash windows, malformed or hostile input, clock and platform oddities.
  Around a fifth were speculative hardening, removal of unrequested extras, or documentation remarks.
- Severity did not separate them.
  More than half of the `error` findings sampled were edge cases or speculative hardening.
- The driving agent selected edge-case and speculative findings for fixing as often as real defects.
  Each fix started another full review, and later passes found more, not fewer, problems.
  About half of all review findings first appeared in pass 2 or later, often in code a previous fix round wrote.
- Passes 3 and later took about half of all review time.
  The `auto_fix.review` cap did not bound the total, because the driver kept selecting findings after the automatic rounds ran out.
- Review instructions that asked for style, simplification or design review, or for every sibling, boundary and failure case to be listed, came with about half again as many findings per run.
  They also raised the share of runs needing 3 or more passes from about a fifth to about a third.
- About one run in sixteen changed only documentation, configuration or lockfiles.
  These runs still took several minutes each, mostly in the Test step, and about a quarter of them received review findings.

## Values

| Setting | Proposed value | Reason | Trade-off |
|---|---|---|---|
| `auto_fix.review` | `2` | Two automatic rounds close most practical findings. A cap of 1 left open findings in about a fifth of reviews, and a cap of 3 added rounds without fewer total passes | Findings still open after two rounds park for a decision |
| `auto_fix.test` | `2` | A third test repair round was almost never used | A test that needs three repair rounds parks for a decision |
| Review focus in `review.path_instructions` | The [focus instruction](#focus-instruction) under path `**` | Narrows findings to ordinary-use defects and makes everything else non-blocking `info` | Rare edge cases and speculative hardening are no longer blocking unless the change targets them |
| `ignore_patterns` | The [trivial-change list](#trivial-changes) entries that match real paths | When every changed file is trivial, review and documentation skip with no agent call | Changes to those files get no agent review |

Every proposed `ignore_patterns` always includes `.no-mistakes.yaml`, even when the file does not exist yet, so the gate config is excluded from agent review by default.

Leave `auto_fix.lint`, `auto_fix.ci` and `auto_fix.rebase` at their current values unless the history shows rounds wasted there.
Keep any existing test-quality rule to one short instruction, because each test-quality finding costs a full review pass.

## Focus instruction

Propose this text as one `review.path_instructions` entry with path `**`, adjusted to the repo's own words:

```yaml
review:
  path_instructions:
    - path: "**"
      instructions: |
        Report defects that a user or caller hits during the change's intended use with ordinary input and timing: wrong results, crashes, broken or missing flows, regressions, data loss, and changed behaviour that no test would catch breaking.
        Do not report concurrency or crash windows, malformed or hostile input, clock or platform differences, or hardening for situations the change does not create, unless the change targets them.
        Do not report style, naming or wording.
        Report each root cause once.
        Use error or warning only for a defect with a concrete failing sequence under ordinary use; report anything else worth knowing as info.
```

`info` findings do not block the gate, so the last line is how a repo sets a severity threshold.

Decisions to put to the user instead of choosing:

- A repo that handles untrusted input, credentials, money or other people's data should keep hostile input in scope.
  Offer two options: drop "malformed or hostile input" from the second line, or add a path entry that restores it for the code that crosses the trust boundary.
- A repo whose product is concurrent or durable, such as a queue, a scheduler or a storage engine, should keep concurrency and crash windows in scope.
  Offer the same two options for "concurrency or crash windows".
- When the repo already records a policy on one of these, such as an instruction that defers security hardening, follow it, say so and ask only whether it still holds.

Flag existing instructions that work against the profile and propose their removal as separate selectable edits:

- instructions that ask the reviewer to list every sibling, boundary or failure case;
- instructions that forbid limiting findings, or that ask for style, simplification or design review on every change;
- several test-quality rules where one would do.

## Trivial changes

Propose each pattern only when it matches real paths in the repo:

| Pattern | Covers |
|---|---|
| `.gitignore`, `.gitattributes`, `.editorconfig` | Repository housekeeping |
| `.no-mistakes.yaml` | The gate config itself. Gate-control keys are read from the default branch anyway |
| `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `Cargo.lock`, `go.sum`, `poetry.lock`, `uv.lock`, `Gemfile.lock`, `composer.lock` | Lockfiles. Their manifests stay reviewed |
| Generated or vendored files and trees, for example `vendor/**`, `dist/**` or a generated reference file the repo regenerates | Files no one edits by hand; review their source instead |
| Committed evidence or snapshot artifacts, for example `.no-mistakes/evidence/**` | Run output, not authored code |

Put these to the user as decisions, never as defaults:

- Prose documentation (`*.md`, `docs/**`).
  Ignoring it skips agent review and the Document step for prose-only changes.
  Keep reviewing any file that steers agents or ships as product, such as `AGENTS.md`, `CLAUDE.md`, skill files or published documentation.
  Because `*.md` matches every Markdown file, offer a folder pattern such as `docs/**` when those files would otherwise be caught.
- CI and release workflow files (`.github/**`).
  They change behaviour, so keep them reviewed unless the user decides otherwise.

`ignore_patterns` also removes these files from review when a change mixes them with code.
That is intended: the code is still reviewed, and the lockfile or gate config is not.

## Finding classes

Use these classes when reading the history in Step 2:

| Class | Example |
|---|---|
| Practical defect | A valid input is rejected, a command reports success on failure, an existing test now fails |
| Rare edge case | Two concurrent logins overwrite each other's config; a crash between two writes repeats a scheduled job |
| Speculative hardening | A path containing an encoded tab bypasses a check no caller reaches; a backward clock change submits early |
| Scope trim | The built-in simplification pass asks to remove an option the stated intent does not need |
| Documentation remark | A count in the README is off by one; a pointer is stale |
| Test-quality remark | An assertion checks a source substring instead of behaviour |
| Process notice | The Test step asks to proceed without live validation for a change with no runtime surface |

A high share of rare edge cases and speculative hardening supports the focus instruction.
Many findings that reappear in later passes, or that name an earlier fix round, support keeping `auto_fix.review` at `2` and the driving rules below.
Many process notices on prose or configuration changes support the trivial-change list and the per-run skips.

## Per-run skips

`ignore_patterns` cannot skip the Test step, so give the user these commands for a change that touches only trivial files:

```sh
no-mistakes axi run --skip test
git push -o no-mistakes.skip=test no-mistakes <branch>
```

A change the patterns do not recognise but the author knows is trivial, such as a comment or typo fix, can skip review too, with `--skip review,test`.
When the Test step repeatedly asks for live validation on changes with no runtime surface, name `/verification` to add a line to `test.instructions` saying that such changes need no live validation.

## Driving rules

No setting bounds how many review passes the person or agent driving the gate chooses, so report these rules with the proposal:

- After the automatic rounds are spent, select a finding for another fix only when it is an `error` or `warning` with a concrete failing sequence under ordinary use.
  Approve the rest and record them as follow-ups.
- Treat a finding in code that a previous fix round wrote as a sign that the fix grew beyond the original finding, and prefer reverting to the smallest fix over another repair.
- Push once for each meaningful change, and do not push again while a run is in review.

## Global recommendations

Report these as not applied:

- `review_agents.fixer_after_round` with a faster or cheaper model, so long loops stop spending at the top tier.
- A `review_agent_timeout` that fits the repo, when review turns have hit the limit.
