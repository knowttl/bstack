# Proposed repo audit record

Result: verification blocked

Stage: audit
Target: [fixture]
Revision: b6c59b7810f5155fd514c9db60e98b7dffce0cc0
Stated next change: Review foundation recommendations for the existing checkout before selecting changes.
Reviewed scope: AGENTS.md, CLAUDE.md, DESIGN.md, glossary.md, package.json, package-lock.json, tsconfig.json, boundaries.mjs, journey.mjs, unit.test.mjs, packages/core/a.ts, packages/core/b.ts, packages/core/index.ts, packages/core/internal/database.ts, packages/core/package.json, packages/web/alias.ts, packages/web/package.json, packages/web/public.ts, packages/web/routes.ts, packages/web/ui.ts
Current fingerprint: fab9f3a16ac2b94f5b7409b63f4b571dba481853e9392dc8ba47f01ba12dcbb9

## Readiness evidence

- Missing required outcome: starting-checks.
- Missing required outcome: journey.
- Missing required outcome: foundation-review.
- Unresolved finding: F-001.
- Unresolved finding: F-002.
- Unresolved finding: F-003.
- Unresolved finding: F-004.
- Unresolved finding: F-005.
- Unresolved finding: F-006.
- Unresolved finding: F-007.
- Unresolved finding: F-008.
- Unresolved finding: F-009.

## Documented intent

- design: UI never touches storage; checkout total 10. (DESIGN.md:3-4)
- instructions: Approved design and public core required; Claude stub imports canonical instructions. (AGENTS.md:1; CLAUDE.md:1)
- vocabulary: Order has two conflicting meanings. (glossary.md:3-4)

## Observed behaviour

- code: Private storage imports, mixed route responsibilities and cyclic core functions. (packages/web/ui.ts:1-4; packages/web/routes.ts:1-6; packages/core/internal/database.ts:1-4; packages/core/a.ts:1-2; packages/core/b.ts:1-2)
- checks: Fresh check captures in scratch: types and 2 units pass; journey and boundaries exit 1. (package.json:12-15; boundaries.mjs:11-30; journey.mjs:10-12; unit.test.mjs:5-8)
- host-docs: Official instruction-loading limits verified; no Claude executable available to prove runtime loading. Stub removal blocked. (https://code.claude.com/docs/en/memory (read 2026-10-12); inventory.json)

## Inferred intent

- ownership: Pricing and order persistence belong behind a public core capability, with route limited to transport mapping. This is a proposed ownership boundary, not approved design text. (packages/web/routes.ts:3-6; packages/core/index.ts:1)

## Observed debt

### F-001: Existing loopback checkout returns total 12; approved acceptance is 10.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/core/internal/database.ts, journey.mjs. Command: npm run journey.
Principle: DESIGN.md:4 is authoritative; do not change acceptance to match implementation. No exception to the approved case.
Consequence: Checkout is currently incorrect despite green unit tests.
Fix: Restore quantity-one checkout through core-owned pricing. Keep DESIGN.md and journey.mjs expected total 10 unchanged. Broader service-price and quantity policy remains blocked pending owner decision.
Scope: packages/web/ui.ts, packages/web/routes.ts, packages/core/internal/database.ts, journey.mjs
Verification: Existing npm run journey must pass with service response 12 and result {status:201,total:10}; retain original reproduction. For later implementation capture a bug-fix before plan; these audit captures are not refactor before/after proof.
Sources: design, code

### F-002: UI, route and alias import private core storage.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts. Command: npm run boundaries.
Principle: AGENTS.md:1 and DESIGN.md:3 require public core and no UI storage. Automated import resolution plus review; no private import exception.
Consequence: Storage representation changes force web changes and bypass intended package exports.
Fix: Expose a useful checkout capability through existing packages/core/index.ts; migrate web consumers, keeping storage private. Do not merely re-export storage representation or add forwarding layers.
Scope: packages/web/ui.ts, packages/web/routes.ts, packages/web/alias.ts, packages/core/index.ts
Verification: Reuse npm run boundaries; prove clean public import and independent private import, alias bypass and cycle failures in disposable fixtures; document dynamic-import/require coverage limits.
Sources: design, instructions, code, checks

### F-003: Route owns pricing, bulk discount, mutable order persistence and response mapping.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/web/routes.ts, packages/core/index.ts. Command: none.
Principle (proposed new principle): Proposed responsibility rule: core owns pricing/order creation; web maps transport. Human review and public checkout compatibility. Exceptions require named scope/reason/removal condition.
Consequence: Pricing and persistence changes both edit the route; shared mutable array is an implicit owner.
Fix: Move pricing and order recording behind one core checkout interface; keep HTTP-shaped response mapping in the route. Candidate checkout.ts and private orders.ts only if selected. Preserve current public shape and investigate broader pricing before altering it.
Scope: packages/web/routes.ts, packages/core/index.ts
Verification: Capture approved checkout before/after, then check public outcome and boundary rule. Persistence semantics and bulk outcomes need authoritative acceptance before extra tests.
Sources: design, code, ownership

### F-005: Core database module mixes static price policy and external HTTP price fetching; entry exports storage function directly.

Status: proposed. Resolved: false. Blocks next change: true.
Files: packages/core/internal/database.ts, packages/core/index.ts. Command: none.
Principle (proposed new principle): Proposed information-hiding rule: core pricing owns business decisions and a private adapter owns fetch. Review public interface and acceptance; exceptions need narrow reason and expiry.
Consequence: Service shape and price-policy knowledge are bound to a storage-named module and exposed to callers.
Fix: Keep current package entry; place policy in a cohesive core owner and isolate external fetch only where it hides actual complexity. No new framework, deployment or service. Public quote()=12 is observed, not approved checkout policy.
Scope: packages/core/internal/database.ts, packages/core/index.ts
Verification: Protect existing approved checkout through real loopback HTTP and public core entry; approve quote/service failure semantics before new expectations. A live external endpoint is unavailable.
Sources: design, code, ownership


## Missing protections

### F-006: Maintained check only typechecks; existing journey and boundaries fail outside that command. Mocked checkout hides real transport-path failure.

Status: proposed. Resolved: false. Blocks next change: true.
Files: package.json, boundaries.mjs, journey.mjs, unit.test.mjs. Command: npm run check; npm run test; npm run journey; npm run boundaries.
Principle (proposed new principle): Proposed completion rule: affected approved journeys and architectural checks pass on final bytes; units alone are insufficient. Native checks enforce, review maps outcomes. No masking exceptions.
Consequence: npm run check can be green while the product violates both approved commitments.
Fix: After selecting repairs, extend existing check with fail-fast type, unit, boundary and journey commands; preserve all known failures. Reuse current journey instead of adding duplicate expected-value tests. Do not add CI without selection.
Scope: package.json, boundaries.mjs, journey.mjs, unit.test.mjs
Verification: Prove integrated command on clean and seeded boundary violations using rule-proof, then run final native checks. No rule-proof claimed from failing current fixture.
Sources: checks, design

### F-009: No project document states what evidence completes a checkout change.

Status: proposed. Resolved: false. Blocks next change: false.
Files: DESIGN.md, AGENTS.md. Command: none.
Principle (proposed new principle): Proposed evidence standard: original acceptance plus affected journey checks on final inputs. Human review; unavailable required evidence means unverified, no blanket unit-only exception.
Consequence: Future changes may rely on green units while agreed outcomes fail.
Fix: Draft append-only design section naming DESIGN.md acceptance and journey.mjs check, plus affected final-input check requirement; AGENTS gets pointers if selected. Preserve both existing design commitments verbatim; no new VISION or standards template.
Scope: DESIGN.md, AGENTS.md
Verification: Review exact proposed bytes against approved design and checks; verify affected native checks on final inputs. Document edits remain unselected.
Sources: design, instructions, checks


## Design decisions

### F-004: Core a and b mutually recurse with no terminating branch, independently of checkout.

Status: proposed. Resolved: false. Blocks next change: false.
Files: packages/core/a.ts, packages/core/b.ts. Command: npm run boundaries.
Principle (proposed new principle): Proposed core dependency rule: forbid unintended cycles; native boundary check and responsibility review. Exceptions require a documented legitimate dependency and removal condition.
Consequence: Calling either function cannot produce a finite result; coupled core files block a clean graph check. No evidence that they affect checkout execution.
Fix: Determine intended capability before consolidating into one cohesive owner, redirecting dependencies, or selecting removal of unused code. No invented return value.
Scope: packages/core/a.ts, packages/core/b.ts
Verification: Native cycle check must become clean; if retained, test its approved public capability. Current functions have no acceptance source, so semantic repair stays blocked.
Sources: code, checks

### F-007: Order denotes both a purchase and panel sequence.

Status: proposed. Resolved: false. Blocks next change: false.
Files: glossary.md. Command: none.
Principle (proposed new principle): One meaning per project term or explicit context; terminology is a draft until confirmed. Human review; contextual uses may be retained by explicit decision.
Consequence: Ambiguous terminology can misdirect interface ownership and naming changes.
Fix: Draft only: Order = customer purchase; Panel sequence = UI panel ordering. Keep existing glossary untouched. Asked owner; naming migration requires separate selected scope.
Scope: glossary.md
Verification: Owner confirmation of meanings followed by exact glossary diff review; no code rename bundled.
Sources: vocabulary

### F-008: CLAUDE.md is an import-only AGENTS stub; it contains no additional instruction to consolidate.

Status: proposed. Resolved: false. Blocks next change: false.
Files: AGENTS.md, CLAUDE.md. Command: none.
Principle: Canonical AGENTS contains equivalent instructions; compatibility verified before removing host bridge. Human loading review; keep stub when required.
Consequence: Removing it without host evidence could prevent approved instructions from loading.
Fix: Equivalent-content consolidation candidate: preserve AGENTS.md bytes and delete only the stub if host loading is proved and selected. BLOCKED: no Claude runtime. Inventory limits: pre-2.1.277; some Bedrock/no-telemetry pre-2.1.281; disabled built-in AGENTS plugin.
Scope: AGENTS.md, CLAUDE.md
Verification: Confirm target runtime/version, supported session and loaded memory with official host procedure before selected deletion. No ancestor/profile files read.
Sources: instructions, host-docs


## Proposed new principles

- F-003: Proposed responsibility rule: core owns pricing/order creation; web maps transport. Human review and public checkout compatibility. Exceptions require named scope/reason/removal condition. (proposed)
- F-004: Proposed core dependency rule: forbid unintended cycles; native boundary check and responsibility review. Exceptions require a documented legitimate dependency and removal condition. (proposed)
- F-005: Proposed information-hiding rule: core pricing owns business decisions and a private adapter owns fetch. Review public interface and acceptance; exceptions need narrow reason and expiry. (proposed)
- F-006: Proposed completion rule: affected approved journeys and architectural checks pass on final bytes; units alone are insufficient. Native checks enforce, review maps outcomes. No masking exceptions. (proposed)
- F-007: One meaning per project term or explicit context; terminology is a draft until confirmed. Human review; contextual uses may be retained by explicit decision. (proposed)
- F-009: Proposed evidence standard: original acceptance plus affected journey checks on final inputs. Human review; unavailable required evidence means unverified, no blanket unit-only exception. (proposed)

## Selected findings


## Limitations

- No changes selected or applied; repo clean at initial revision. All recommendations unresolved; dependent work blocked.
- Native captures use phase after as a baseline audit with no edits; not structural compatibility proof.
- Type/unit captures link a supporting case to public-core, but passing those commands does NOT establish that boundary; only native boundary analysis is relevant and it fails. Automated coverage metadata is not semantic proof.
- Findings execution remains empty: captured run-checks fingerprints are not findings fingerprints. No manually attached artifact claimed validated. Readiness stays blocked.
- History has only initial b6c59b7 commit; co-change pairs reflect initial creation, not recurring coupling or conflicts.
- No live external pricing endpoint or approved error, invalid quantity or bulk-discount acceptance; no outside behaviour verified.
- No formatter/linter/CI configured; do not impose a universal toolchain. No missing VISION treated as a product-goal gap.
- Boundary checker covers top-level import/export resolution, not dynamic imports/require.
- Terminology, cycle purpose and general pricing decisions pending; Claude stub removal blocked by missing runtime.
