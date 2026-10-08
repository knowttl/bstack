# Architecture

Use this reference when recommending module boundaries.
Start with the reported area, stated next change, approved design and relevant history.
Expand only where evidence leads.
For a new project, review expected changes against proposed boundaries instead of inventing history.

Coupling means that a change needs knowledge of, or edits to, another part.
Cohesion means that code belongs together for a clear responsibility.
A module is a logical unit with an interface and implementation, which may span several private files.
A god file mixes unrelated responsibilities and becomes a shared target for different changes.
Length alone does not establish that problem.

## Principles to consider

Choose principles only where project evidence supports them.
No single architecture style is required.

| Principle | Practical rule | Source |
|---|---|---|
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
These adaptations follow the pinned design and module guidance attributed in the package NOTICE.

## What the audit inspects

- Unrelated business responsibilities, or startup, UI, domain rules and persistence combined without clear internal boundaries.
- Imports of private implementation, leaked representations and cycles across intended module boundaries.
- Shared mutable state and multiple writers of canonical data.
- Frequently changed files and pairs that repeatedly change together.
- Central registries, broad utilities, shared type collections and wiring files that unrelated work repeatedly edits.
- Tests requiring unrelated modules or asserting implementation details rather than a public contract.
- Two representative planned changes, their write paths and the shared contracts they would modify.

Collect dependency edges through the native analysis selected by the language research brief.
Resolve aliases, re-exports and package entry points.
Report unsupported syntax, dynamic dependencies and unresolved imports as coverage limits.
Unresolved imports do not demonstrate independence.
Prefer an existing architecture checker to another dependency engine.

For history, record revision range, rename handling and exclusions for generated files, lockfiles and broad formatting changes.
Show the supporting commits behind a finding.
Co-change is distinct from observed merge conflicts.
History may omit abandoned rebases and conflict resolutions.

## Signals that are not violations

Size, import counts and change frequency indicate where to investigate.
They do not prove a bad boundary.
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

Tie each proposed boundary to its project-specific reason, source, scope, enforcement and exception policy using the enforcement reference.
Reuse existing design decisions and standards rather than duplicating their rules.
Present evidenced candidates and alternatives for selection before applying changes.
Verification requires representative allowed and forbidden imports and compatible public behaviour, not file-count targets.
This reference does not implement native rules or maintenance checks.
