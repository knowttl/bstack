# Architecture

Use this reference when recommending design principles or module boundaries.
Start with the reported area, stated next change, approved design and relevant history.
Expand only where evidence leads.
For a new project, review expected changes against proposed boundaries instead of inventing history.

Coupling means that a change needs knowledge of, or edits to, another part.
Cohesion means that code belongs together for a clear responsibility.
A module is a logical unit with an interface and implementation, which may span several private files.
A god file mixes unrelated responsibilities and becomes a shared target for different changes.
Length alone does not establish that problem.

## Contents

- [Principles to consider](#principles-to-consider)
- [What the audit inspects](#what-the-audit-inspects)
- [Signals that are not violations](#signals-that-are-not-violations)
- [Boundary rules](#boundary-rules)

## Principles to consider

Choose principles only where project evidence supports them.
No single architecture style is required.

| Principle | Practical rule | Source |
|---|---|---|
| DRY (Don't Repeat Yourself) | Give each piece of knowledge or logic one authoritative source; avoid independently maintained copies of rules, logic or documentation | [The Pragmatic Programmer, tip 15](https://pragprog.com/tips/) |
| KISS (Keep It Simple) | Choose the simplest design that meets the requirement; avoid speculative abstractions, layers and configurability | [Google code review guidance on complexity](https://google.github.io/eng-practices/review/reviewer/looking-for.html#complexity) |
| Single responsibility and cohesion | Keep code together when it changes for the same business reason and separate unrelated reasons | [Single responsibility](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) |
| Information hiding | Hide a changeable design decision behind an interface so callers do not depend on its representation | [Module decomposition](https://www.cs.lafayette.edu/~gexia/cs301/resources/parnas.html) |
| Locality of change | Keep capability code and tests together where this reduces coordination across unrelated areas | [Vertical slices](https://www.jimmybogard.com/vertical-slice-architecture/) |
| Explicit dependency direction | Define allowed dependencies and check forbidden imports and cycles across intended boundaries | [Dependency hierarchy](https://www.cs.lafayette.edu/~gexia/cs301/resources/parnas.html) |
| Separate wiring from behaviour | Startup assembles modules while modules own business behaviour | [Composition roots](https://blog.ploeh.dk/2011/07/28/CompositionRoot/) |
| Proportional deployment choices | A single deployed application can retain firm module boundaries | [Module boundaries](https://www.martinfowler.com/articles/microservice-trade-offs.html) |

A deep module hides useful complexity behind a small interface.
Consolidate tightly related shallow modules when removing their layer concentrates complexity in one place.
Separate unrelated responsibilities when their changes currently require shared edits.
Avoid forwarding layers that add navigation without hiding useful complexity.
Organise ownership around domain knowledge rather than scattering one rule across load, validate and save phases.
Assume the next contributor is an agent that sees only the files it opened, copies the nearest example and takes the shortest path that compiles.
Prefer the boundary where a change that looks right from one file is right for the whole repository.
These adaptations follow the pinned design and module guidance attributed in the package NOTICE.

## What the audit inspects

- Unrelated business responsibilities, or startup, UI, domain rules and persistence combined without clear internal boundaries.
- Imports of private implementation, leaked representations and cycles across intended module boundaries.
- Execution-context boundaries across processes, threads, client/server, sandboxes and real-time loops.
  Inspect entry points, build targets, process and worker spawns, runtime markers and context-specific roots to establish where code executes and which work belongs there.
  Cite performance or crash fixes that moved work between contexts and review comments about work running in the wrong context.
- The same workaround, such as a guard, cast, retry or defensive copy, repeated at unrelated call sites to cope with one module's contract.
  Cite the sites and name the module they work around: that is evidence the boundary is broken.
- A rising count of type escape hatches, such as `any`, unchecked casts, type-ignore comments and `unsafe` blocks, at the callers of one module.
  Count them with the language's own markers at the baseline and now, cite the sites, and treat the rise as evidence the module's types do not describe how it is used.
- Shared mutable state, multiple writers of canonical data, and state held in scattered booleans, phases or lifecycle checks that must stay in sync.
- More than one supported way to do one task, where callers copy whichever way they find first and every way keeps gaining callers.
- Direct dependency calls outside an existing sanctioned wrapper.
  Inspect dependency manifests, wrapper modules and existing restricted-API configuration to establish the intended interface, then trace callers and clustered casts, suppressions or repeated guards around that dependency.
  Cite the wrapper and bypass sites, and look for fix-up or revert commits, review comments or user corrections identifying the footgun.
- Hand-maintained parallel lists of the same items with no derivation or check that fails when they disagree.
- The same business rule, algorithm or documented policy maintained independently in several places, with a concrete change that would require coordinated updates.
- Abstractions, forwarding layers and configuration options without a current requirement, compared with a simpler design that still meets the approved requirements.
- Frequently changed files and pairs that repeatedly change together.
- Central registries, broad utilities, shared type collections and wiring files that unrelated work repeatedly edits.
- Tests requiring unrelated modules or asserting implementation details rather than a public contract.
- Two representative planned changes, their write paths and the shared contracts they would modify.

Collect dependency edges through the native analysis that the boundary checks reference's language research selects.
Resolve aliases, re-exports and package entry points.
Report unsupported syntax, dynamic dependencies and unresolved imports as coverage limits.
Unresolved imports do not demonstrate independence.
Prefer an existing architecture checker to another dependency engine.

For history, record revision range, rename handling and exclusions for generated files, lockfiles and broad formatting changes.
Show the supporting commits behind a finding.
Co-change is distinct from observed merge conflicts.
History may omit abandoned rebases and conflict resolutions.

## Signals that are not violations

Size, import counts, change frequency and scattered state indicate where to investigate, and the explicit state model standard in the design standards reference is proposed only with cited evidence.
They do not prove a bad boundary.
Similar-looking code is not necessarily duplicated knowledge: independently changing concepts should not be coupled merely to remove similar syntax.
Generated copies derived from one authority are not independently maintained duplication; verify their freshness instead.
A large cohesive domain owner may be sound.
A thin startup file may legitimately import many modules for wiring.
A stable domain contract may have many callers.
Co-change may reflect good cohesion, a mechanical commit or harmful coupling.
Inspect the reasons before recommending a split or consolidation.
Do not infer conflicts or prescribe services from these signals.

## Boundary rules

Name each module's responsibility, owned knowledge, public contract and private implementation.
Define allowed dependency direction and the scope of forbidden imports and cycles.
Callers use the public interface and do not depend on private storage or representation.
Private implementation may span files without exposing additional public entry points.
Keep startup focused on assembly and put behaviour with its domain owner.
Remove unnecessary shared write targets before serializing work.
Where sharing is real, enforce one writer and sequence unavoidable shared edits.

Review two representative changes against proposed boundaries.
For example, a pricing-policy change and a notification-template change should remain inside their owners when the public contracts still suffice.
Check whether either also changes a shared type, registry or data representation.
Compare declared paths and contract changes, then review semantic dependencies even when paths are disjoint.
A script reports overlap evidence but cannot prove independence or predict every conflict.
Fewer unrelated shared edits are an expected benefit, not a measured reduction until actual evidence exists.

Record each proposed boundary's project-specific reason, source, scope, enforcement and exception policy.
For an execution context, identify its roots and the work reserved for it before proposing an import-graph restriction.
For a bypassed wrapper, prefer eliminating the footgun; when detection is the highest workable rung, propose a native restricted-API rule whose diagnostic names the sanctioned wrapper.
If no wrapper exists, report the Eliminate-rung product change instead of building it.
Route repeated mistake evidence to `/verification correct`, subject to its two-occurrence threshold; suggest the skill rather than invoking it automatically.
Reuse existing design decisions and the design standards reference's sources rather than duplicating their rules.
Present evidenced candidates and alternatives for selection before applying changes.
Verification requires representative allowed and forbidden imports and compatible public behaviour, not file-count targets.
Use rule-proof, as the boundary checks reference describes, for a clean public-import control and independent private, alias or equivalent resolution bypass and cycle violations with the selected native check.
The Python equivalent-resolution fixture exercises an intermediate public-looking bridge to private implementation; proof does not establish every possible re-export or dynamic dependency.
Maintain these coverage limits alongside the rule evidence.
