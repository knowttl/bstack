# Scoped maintenance completion

Completed with clean working trees in the fixture and independent clone. Node v24.17.0; npm 11.13.0; Version 5.9.3.

- Explicit comparison base selected before editing: `37864dacc088867c4aeeb0cd18275aa98b0c0a0b` (original HEAD).
- Assessed implementation commit: `9009fe97e495bb316de45cf203996fd31405ebfe`.
- Submitted source / assessment commit: `e6366d129b018058effbdeeae7cdcf2379d0cd73`.
- Assessment: [[fixture]/.bstack/assessment.json]([fixture]/.bstack/assessment.json).
- Assessment SHA-256: `0a82106459bcffdbd0cf0e4356b21bc02b9e89b4a77177c7b981c7b0989466ec`.
- Reviewed fingerprint: `5996171a7e8cb07612c07532db0520525501a948adfd6bb0210628664fc9da7c`.

## Reviewed scope

`packages/web/routes.ts` extracts `unitPrice * quantity` into `undiscountedTotal` and applies the identical existing factor. Multiplication grouping and evaluation order are unchanged. Public imports, defaults, quantity threshold/factor, recording and return object are unchanged. `DESIGN.md`, `glossary.md` and `AGENTS.md` have substantive no-impact assessments with literal base/current citations. All five affected rules are covered; no unmapped paths or pending decisions. `.bstack/project.json` remains byte-identical to the base with the same documents, rules, acceptance sources and required check scopes. The assessment metadata itself was reviewed and is the sole declared portable exclusion. Historical audit, approved documents, public interfaces and checker remain byte-identical.

## Passing command captures

- before: exit 0; [before.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs run-checks --repo [fixture] --plan [isolated-home][scratch-path] --phase before --json`.
- after: exit 0; [after.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs run-checks --repo [fixture] --plan [isolated-home][scratch-path] --phase after --prior-run 132e6591-194c-48e6-8f6a-4e339f8c334c --json`.
- final-collect: exit 0; [final-collect.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs evidence collect --repo [fixture] --base 37864dacc088867c4aeeb0cd18275aa98b0c0a0b --portable .bstack/assessment.json --json`.
- docs-check: exit 0; [docs-check.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs docs check --repo [fixture] --json`.
- docs-generated: exit 0; [docs-generated.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs docs generate --repo [fixture] --check --json`.
- local-evidence-validation: exit 0; [local-evidence-validation.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs evidence validate --repo [fixture] --base 37864dacc088867c4aeeb0cd18275aa98b0c0a0b --assessment .bstack/assessment.json --json`.
- final-contract-validation: exit 0; [final-contract-validation.json]([isolated-home][scratch-path]
  Command: `node [isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs contract validate --repo [fixture] --json`.
- local-checker: exit 0; [local-checker.json]([isolated-home][scratch-path]
  Command: `node .bstack/bin/bstack-check.mjs --repo [fixture] --base 37864dacc088867c4aeeb0cd18275aa98b0c0a0b --assessment [fixture]/.bstack/assessment.json --json`.
- clone-checker: exit 0; [clone-checker.json]([isolated-home][scratch-path]
  Command: `node .bstack/bin/bstack-check.mjs --repo [isolated-home][scratch-path] --base 37864dacc088867c4aeeb0cd18275aa98b0c0a0b --assessment [isolated-home][scratch-path] --json`.

Before raw outcome capture: [[isolated-home]/cache/bstack/21e3383881633b1a68d1a1de8d73f6cccb461824495261cadd3cce9921f5cbac/132e6591-194c-48e6-8f6a-4e339f8c334c/checks.json]([isolated-home]/cache/bstack/21e3383881633b1a68d1a1de8d73f6cccb461824495261cadd3cce9921f5cbac/132e6591-194c-48e6-8f6a-4e339f8c334c/checks.json).
After raw outcome capture: [[isolated-home]/cache/bstack/21e3383881633b1a68d1a1de8d73f6cccb461824495261cadd3cce9921f5cbac/809da682-ec36-4842-8733-10c5ff9c8ba2/checks.json]([isolated-home]/cache/bstack/21e3383881633b1a68d1a1de8d73f6cccb461824495261cadd3cce9921f5cbac/809da682-ec36-4842-8733-10c5ff9c8ba2/checks.json).

Fresh local checker artifact: [[isolated-home]/cache/bstack/21e3383881633b1a68d1a1de8d73f6cccb461824495261cadd3cce9921f5cbac/e16060c9-69a4-4be7-be38-048362e46ec5/checker-result.json]([isolated-home]/cache/bstack/21e3383881633b1a68d1a1de8d73f6cccb461824495261cadd3cce9921f5cbac/e16060c9-69a4-4be7-be38-048362e46ec5/checker-result.json).
Fresh clean-clone checker artifact: [[isolated-home][scratch-path]

Each standalone invocation executed exactly one distinct required leaf, `npm run check`, then validated final review inputs. Both fresh leaf outputs pass types, 2 public-interface unit tests, static boundaries and the actual loopback HTTP journey returning `{status:201,total:10}`. Public quote remains 12. These are separate fresh executions, not reuse of local capture successes.

Clone setup: `git clone --no-local` into [isolated-home][scratch-path]; `npm ci --no-audit --no-fund`, exit 0. Isolated HOME, XDG_CACHE_HOME, npm cache and TMPDIR are retained in [clone-setup.json]([isolated-home][scratch-path] Installation output is [clone-npm-ci.json]([isolated-home][scratch-path] Assessment bytes match exactly in both roots.

## Resource gates

Fresh host preflight returned source host, permitted true and exit 0 before each native suite-bearing invocation; all checks satisfied at least 8 GB available memory, 20 GB free disk, load under 36, and proposed aggregate suite count at most 2.
- before: memory 19459239936 bytes; disk 24827826176 bytes; load 5.87; existing suites 0; including proposed 1. [before-preflight.json]([isolated-home][scratch-path]
- after: memory 19945852928 bytes; disk 24930807808 bytes; load 4.36; existing suites 0; including proposed 1. [after-preflight.json]([isolated-home][scratch-path]
- local-checker: memory 18943664128 bytes; disk 24791130112 bytes; load 3.75; existing suites 0; including proposed 1. [local-checker-preflight.json]([isolated-home][scratch-path]
- clone-checker: memory 19004018688 bytes; disk 24766357504 bytes; load 3.36; existing suites 0; including proposed 1. [clone-checker-preflight.json]([isolated-home][scratch-path]

## Failed or blocked preparation attempts

No final native or standalone check failed. Earlier plan validation attempts were rejected before suites/project changes: protection-only lacked compatibility; compatibility-only lacked before protection; apply metadata lacked starting-checks, then replace-file payload lacked content; assessment create scope initially retained the implementation path. These were corrected before successful protected previews/applies. The earliest failures are recorded as summaries in scratch, not presented as raw command captures. The scratch-location portable validation was blocked by portable-source-mismatch; validation of the assessment at its selected project path was initially blocked by stale-review while fingerprint was unbound. Those exact captures remain [assessment-first-validation.json]([isolated-home][scratch-path] and [assessment-unbound-validation.json]([isolated-home][scratch-path]; the final bound validation passed.

## Limits and unverified areas

Semantic assessment was performed here against the actual diff and cited authority; scripts do not independently prove semantics or authenticate approval. Native static boundary checks exclude dynamic imports/runtime loading. No outside dependency was added: the approved loopback endpoint is observed by the existing HTTP journey. No hosted CI or external delivery enforcement was requested or verified. Receipt wording remains the documented future owner decision. Checker Markdown coverage reports renderer review limitations for inline code/escaped Markdown in DESIGN.md, AGENTS.md and the historical audit; these documents are byte-identical and no browser renderer review was run. Local capture files are not authenticated portable attestations; declared inputs do not detect transient changes restored during a check.

Final diff: [final.diff]([isolated-home][scratch-path] `git diff --check 37864dacc088867c4aeeb0cd18275aa98b0c0a0b HEAD` passed, capture [final-diff-check.json]([isolated-home][scratch-path] Full final diff contains only the implementation and its reviewed portable assessment. Current assessed readiness is retained in scratch; the historical audit was not rewritten.
