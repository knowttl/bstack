---
name: bstack-mode
description: Route a plain request to the right bstack skill and apply bstack's shared engineering principles without loading every skill. Use when the user says "use bstack-mode", "which bstack skill fits this", "harden this repo with bstack" or wants one consistent bstack entry point.
---

## Scope

Start `bstack-mode` when the user invokes `/bstack-mode`, `$bstack-mode` or `/skill:bstack-mode`, or asks for one entry point into bstack.
This skill is a thin, stateless router over bstack's skills. It holds no execution playbooks, edits no files and opens no pull requests.

## Non-negotiables

Apply these rules whenever routing or running bstack work:

1. **Audit before editing.** Restate the goal, inspect the repo read-only and cite every factual claim to `path:line` checked against current bytes.
2. **Enforce the constraint ladder.** Stop at the highest level that works: Architecture -> Types -> Lint / static / model check -> Automated test -> Agent instructions / docs -> Human review.
3. **Prove checks before trusting them.** Every new lint, boundary, comment or formal check must fail on a real past mistake (or seeded violation when no past bug exists) with a clear fix diagnostic, then pass on clean code.
4. **Verify real behaviour.** Drive the real product end to end, test against real local databases instead of mocking persistence, and preserve all security, authorization and compliance tests.
5. **Match ceremony to stakes.** Preview exact diffs and get owner approval before writing high-stakes or shared-config files; use the lighter path for tiny, reversible edits.

## Route to the right skill

Pick the single skill (or at most two in sequence) that matches the request, then hand off to it by name:

| User intent | Skill |
|---|---|
| First look at a repo, "what should I set up next?", lock-down scorecard | `/repo-audit` |
| Define purpose, users, non-goals or stress-test an idea | `/vision` |
| Define domain terms or fix inconsistent naming | `/glossary` |
| Design or audit module boundaries, dependencies or ADRs | `/architecture` |
| Scaffold a brand-new empty project from an approved vision | `/foundation` |
| Create or maintain a real-product verification kit, audit tests or add comment/slop checks | `/verification` (`create` or `maintain`) |
| Turn a repeated mistake from commits, PRs or transcripts into a proven check | `/verification correct` |
| Prove a high-stakes concurrency, retry, lock or state-machine property | `/formal-verification` |
| Register docs, check drift or sweep the whole repo | `/maintenance` (`create` or `sweep`) |
| Create, slim down or audit `AGENTS.md` / `CLAUDE.md` pointers | `/agents-md` |
| Create or audit `README.md` | `/readme` |
| Tune `.no-mistakes.yaml` review noise, fix rounds or ignore patterns | `/no-mistakes-tuning` |
| Break an approved design into small, verifiable PR units | `/plan` |
| Compare 2-3 throwaway design approaches with real measurements | `/prototype` |
| Explain how code works, why it exists, or both | `/how`, `/why`, `/teach` |
| Catch up from past Claude Code or Codex transcripts | `/recall` |

## Next step

When the repo's state is unknown or several areas need work, run `/repo-audit` next to get a cited, ordered checklist, or ask the user which single skill from the table to run.
