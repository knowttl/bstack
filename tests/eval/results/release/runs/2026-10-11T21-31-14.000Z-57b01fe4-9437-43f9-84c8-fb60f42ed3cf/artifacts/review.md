# Checkout foundation review

Assessed revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0; clean working tree. No project changes selected or applied.

- [x] Step 7: Audit starting state — inspect, inventory, source research, cite-check, native checks, measure and overlap captured.
- [x] Step 8: Resolve material gaps — pricing and terminology questions asked; dependent work explicitly blocked.
- [x] Step 9: Present evidenced findings — findings schema validated and rendered; five proposed findings retained.
- [ ] Step 10: Review and apply selected findings — no selection or exact-byte approval; no apply attempted.
- [ ] Step 11: Verify and report readiness — boundaries and journey fail; foundation review pending.

## Actual checks

| Command | Result | Evidence |
|---|---|---|
| npm run check | Exit 0 | TypeScript only; does not enforce design |
| npm test | Exit 0; 2 tests pass | Quote expects 12; checkout mocks service price 10 |
| npm run boundaries | Exit 1 | alias, cycle, private |
| npm run journey | Exit 1 | HTTP checkout returns {status:201,total:12}; approved total is 10 |

Execution captured through run-checks, with fresh host preflight before each native suite. All checks met at least 8 GB available memory, 20 GB free disk, load below 36, and at most two host-wide suites including the proposed run. No process inventory was printed. Node v24.17.0, npm 11.13.0, TypeScript pinned 5.9.3.

## Proposed foundation and review rules

Keep TypeScript, the workspaces, Node tests, the existing journey and the TypeScript dependency checker. No service split, new framework, formatter, linter, CI, or duplicate authority is recommended by this bounded audit. Setup already works with installed dependencies; no installation was performed. For a later isolated setup, use the existing lockfile and engine requirement.

Core hides storage and exposes reviewed pricing/service capabilities; web coordinates checkout through the public core interface; routes currently own order state and response assembly. Pricing-policy ownership is proposed, not approved. Current data flow is HTTP price → private core helper → UI → route total calculation → in-memory order list → response. The quantity discount is observed behaviour, not approved acceptance. HTTP failure, malformed price and quantity validation requirements remain unspecified: do not invent expected values or failure contracts.

| Principle | Reason and source | Scope and enforcement | Exception policy |
|---|---|---|---|
| Approved total 10 | DESIGN.md:4 and journey.mjs:12 | Existing checkout journey; human review protects acceptance bytes | No acceptance relaxation without explicit owner decision |
| Public core access | AGENTS.md:1; DESIGN.md:3 | Web imports checked using existing TypeScript resolver, plus public boundary journey | No web storage bypass; temporary debt only if separately selected, narrow, justified and removable |
| Completion requires affected outcome evidence (proposed) | Passing units mask failed journey; package.json:12 | Extend maintained check after selected repairs; human review links cases to DESIGN.md | Missing or skipped required evidence is blocked, never passed |
| No dependency cycles (proposed) | boundaries.mjs:26; core a.ts/b.ts | Existing native checker and valid/seeded fixture proof | Existing a/b debt may be deferred only with selected reason, scope and removal condition |
| Distinct purchase/panel terms (draft) | glossary.md:3–4 | Owner review of terminology draft only | Context-specific meanings remain possible until owner resolves them; no automatic renames |

## Parallel change assessment

The two declared candidate plans are illustrative scope proposals, not authorizations. Their shared write paths are packages/core/index.ts, packages/web/ui.ts, packages/web/routes.ts, unit.test.mjs and journey.mjs. Their shared contracts are the public core pricing interface and checkout response/total. DESIGN.md is a shared authoritative contract source, not an authorized write path in either repair plan.

Assign one writer to core exports, checkout/routes, and their shared tests. Agree pricing contract first, then sequence shared boundary and pricing changes. Independent cycle investigation and terminology drafting can proceed read-only; package.json and any selected DESIGN.md completion section also need one writer during integration. Disjoint paths do not establish semantic independence. No parallel implementation was launched.

Measurement covers the single initial commit, follows Git rename lineage, and uses default generated/lockfile exclusions. It provides no recurring hot-spot or merge-conflict evidence; no split is justified from sizes or co-change alone.

## Retained decisions and limits

Approved DESIGN.md and journey acceptance stay unchanged. The quote test's 12 is existing compatibility evidence, not proof that checkout should change to 12; changing every price to 10 is unsupported. Pricing mechanism is blocked pending decision. Terminology draft is unapproved. CLAUDE.md remains its AGENTS.md import stub; removal compatibility was not researched because removal is not proposed.

The journey uses real loopback HTTP and the public checkout function; it is not browser/UI or production dependency verification. No configured third-party service was found, so no external probe was invented. Static boundary coverage excludes dynamic imports and require calls. TypeScript paths maps compile-time resolution and does not rewrite runtime imports; aliasQuote runtime is unverified. Official source: https://www.typescriptlang.org/tsconfig/paths.html (opened 2026-10-11).

Findings execution is manually bound to the findings fingerprint, preserving the actual run-checks artifact and hash; validation confirms bindings, not independent semantic approval. No check-plan fingerprint is substituted. Readiness: verification blocked; pricing decision and proposal selection required. All exact-byte edits, apply plans and protected writes remain later steps.
