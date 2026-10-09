// Metadata stays separate so help never imports a command implementation.
export const commands = {
  'docs check': {
    module: './commands/docs-check.mjs',
    options: ['contract'],
    help: 'Check registered document paths, local Markdown links and supported glossary structures without writes.\nUsage: repo-audit.mjs docs check --repo <path> [--contract <repo-relative-file>] [--json]\nDefaults to .bstack/project.json. Register glossary context and format on documents; markdown-bold and markdown-table are supported. Unsupported formats report coverage limits. Duplicate terms fail only within one context.'
  },
  'docs generate': {
    module: './commands/docs-generate.mjs',
    options: ['contract', 'check'],
    help: 'Compare registered generated sections or render proposed documents in scratch.\nUsage: repo-audit.mjs docs generate --repo <path> [--contract <repo-relative-file>] [--check] [--json]\nGenerator IDs identify markers in outputPaths; stdout is the exact section body. Without --check, review scratch proposals and apply through a selected change set with apply --plan <file>.'
  },
  'contract validate': {
    module: './commands/contract.mjs',
    options: ['contract'],
    help: 'Validate project source pointers, scopes and leaf commands without execution.\nUsage: repo-audit.mjs contract validate --repo <path> [--contract <repo-relative-file>] [--json]\nDefaults to .bstack/project.json; input follows schemas/project.schema.json. Unsupported config formats need a reviewed standalone contract.'
  },
  'evidence collect': {
    module: './commands/evidence.mjs',
    options: ['contract', 'base', 'previous-contract'],
    help: 'Collect the live Git change inventory and save a document assessment skeleton to scratch.\nUsage: repo-audit.mjs evidence collect --repo <path> --base <ref> [--contract <repo-relative-file>] [--previous-contract <base-policy-path>] [--json]\nPrevious policy defaults to .bstack/project.json at the base; custom prior authority requires --previous-contract. Use --base empty before the first commit. An unavailable base blocks comparison. Renames map both paths through case-sensitive scopes. Collection is not semantic assessment or readiness validation.'
  },
  'evidence validate': {
    module: './commands/evidence-validate.mjs',
    options: ['contract', 'base', 'assessment', 'previous-contract'],
    help: 'Validate live change coverage, substantive review freshness and captured required checks.\nUsage: repo-audit.mjs evidence validate --repo <path> --base <ref> --assessment <file> [--contract <repo-relative-file>] [--previous-contract <base-policy-path>] [--json]\nPrevious policy defaults to .bstack/project.json at the base; custom prior authority requires --previous-contract. Assessment follows schemas/evidence.schema.json. Returns the current review fingerprint; review must bind it explicitly. Missing prior policy, decisions or checks block completion. Structural validation cannot prove semantic correctness.'
  },
  'rule-proof': {
    module: './commands/rule-proof.mjs',
    options: ['check-plan', 'check-id', 'valid', 'violation', 'expect'],
    help: 'Prove a selected native check against disposable valid and violation copies.\nUsage: repo-audit.mjs rule-proof --repo <path> --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text> [--json]\nUses schemas/check-plan.json. Prepare native dependencies in each source fixture first. Unavailable tools or a failed clean control are blocked. Evidence is saved in scratch.'
  },
  'baseline check': {
    module: './commands/baseline.mjs',
    options: ['baseline', 'violations', 'refresh', 'finding', 'findings', 'entry'],
    help: 'Check visible temporary debt and reject new or fixed entries.\nUsage: repo-audit.mjs baseline check --repo <path> --baseline <repo-relative-file> --violations <file> [--refresh [--finding <id> --findings <file> --entry <file>]] [--json]\nBaseline follows schemas/baseline.schema.json; violations are an array of rule/path/key objects. Refresh removes fixed entries. Adding one entry requires a selected unresolved debt finding in its scope. A failing refresh writes nothing.'
  },
  'project create': {
    module: './commands/project.mjs',
    options: ['plan', 'dry-run'],
    help: 'Create or resume the approved minimal project.\nUsage: repo-audit.mjs project create --workspace <existing-directory> --plan <file> [--dry-run] [--json]\nPlan follows schemas/project-create.json and references a reviewed change set. Dry run builds only in scratch. Repeat the unchanged plan to recover directory, file and Git creation. Failed setup or journey keeps the project unverified.'
  },
  'probe record': {
    module: './commands/probe.mjs',
    options: ['name', 'phase', 'spec', 'approved-by-user', 'command'],
    help: 'Capture a live call in scratch.\nUsage: repo-audit.mjs probe record --repo <path> --name <n> --phase before|after --spec <file> [--approved-by-user] [--json] -- <executable> [args...]\nDescriptor follows schemas/probe-spec.json. Side effects require approval for each call. Unavailable calls remain unverified.'
  },
  'probe compare': {
    module: './commands/probe.mjs',
    options: ['name', 'before', 'after'],
    help: 'Require a successful matching live probe pair for an outside dependency.\nUsage: repo-audit.mjs probe compare --repo <path> --name <n> --before <run-id> --after <run-id> [--json]\nMissing, mismatched, unsuccessful or stale evidence cannot pass.'
  },
  'run-checks': {
    module: './commands/run-checks.mjs',
    options: ['plan', 'phase', 'prior-run'],
    help: 'Capture declared checks and user outcome coverage in scratch.\nUsage: repo-audit.mjs run-checks --repo <path> --plan <file> [--phase before|after] [--prior-run <id>] [--json]\nPhase defaults to after. Plans follow schemas/check-plan.json. Bug fixes and refactors require an original-state before capture. Outside dependencies also require probe record and probe compare.'
  },
  apply: {
    module: './commands/apply.mjs',
    options: ['plan', 'dry-run'],
    help: 'Apply or resume a reviewed change set with recoverable originals.\nUsage: repo-audit.mjs apply --repo <path>|--workspace <path> --plan <file> [--dry-run] [--json]\nPlan follows schemas/change-set.schema.json. --dry-run previews exact bytes without writes. Repeating a plan resumes its digest-bound run.'
  },
  'state show': {
    module: './commands/state.mjs',
    options: ['run'],
    help: 'Inspect actual pending, applied and conflicting edits without writes.\nUsage: repo-audit.mjs state show --repo <path>|--workspace <path> --run <id> [--json]'
  },
  'findings validate': {
    module: './commands/findings.mjs',
    options: ['findings'],
    help: 'Validate findings and assess current readiness without writes.\nUsage: repo-audit.mjs findings validate --repo <path>|--workspace <path> --findings <file> [--json]'
  },
  'findings render': {
    module: './commands/findings.mjs',
    options: ['findings'],
    help: 'Render a proposed audit record only in scratch and return its path.\nUsage: repo-audit.mjs findings render --repo <path>|--workspace <path> --findings <file> [--json]'
  },
  inspect: {
    module: './commands/inspect.mjs',
    options: [],
    help: 'Inspect starting Git state, manifests and prerequisite versions without writes.\nUsage: repo-audit.mjs inspect --repo <path> [--json]'
  },
  inventory: {
    module: './commands/inventory.mjs',
    options: [],
    help: 'Discover document sources and scoped instructions without writes.\nUsage: repo-audit.mjs inventory --repo <path> [--json]\nAbsent document kinds are reported without failure. Instruction consolidation is a candidate requiring review.'
  },
  measure: {
    module: './commands/measure.mjs',
    options: ['range', 'exclusions'],
    help: 'Collect endpoint file sizes and current-lifetime history signals without writes.\nUsage: repo-audit.mjs measure --repo <path> --range <base>..<head>|<head> [--exclusions <file>] [--json]\nA single revision selects its reachable history. Only files present at the endpoint are measured, following renames back to their addition. Exclusions follow schemas/measure-exclusions.json. Signals do not establish violations or merge conflicts.'
  },
  overlap: {
    module: './commands/overlap.mjs',
    options: ['plans'],
    help: 'Compare declared write paths and changing contracts without writes.\nUsage: repo-audit.mjs overlap --repo <path> --plans <file> <file> [--json]\nPlans follow schemas/overlap-plan.json. Paths are case-sensitive and repo-relative, using /, * and ? within segments, and ** for zero or more segments. Unsupported glob syntax fails. Intersections include planned new files. Disjoint paths do not prove independence.'
  },
  'cite-check': {
    module: './commands/cite-check.mjs',
    options: ['report'],
    help: 'Check file citation locations and exact-byte freshness without writes.\nUsage: repo-audit.mjs cite-check --repo <path>|--workspace <path> --report <file> [--json]\nReport follows schemas/research-report.json. Web URL/date records are validated without fetching sources.'
  },
  'vision-board build': {
    module: './commands/vision-board-build.mjs',
    options: ['draft', 'proposals'],
    help: 'Build a revision-bound VISION review board in scratch.\nUsage: repo-audit.mjs vision-board build --repo <path>|--workspace <path> --draft <file> --proposals <file> [--json]\nDraft is UTF-8 Markdown. Proposals follow schemas/vision-proposals.json and name its exact SHA-256.'
  },
  'vision-board launch': {
    module: './commands/vision-board-launch.mjs',
    options: ['board'],
    help: 'Open the pinned board runtime, preserving the scratch draft.\nUsage: repo-audit.mjs vision-board launch --repo <path>|--workspace <path> --board <scratch-board.html> [--json]\nRead runtimeOutput and run the returned listener in the terminal for author feedback.'
  },
  'vision-board verdicts': {
    module: './commands/vision-board-verdicts.mjs',
    options: ['board', 'input', 'draft'],
    help: 'Validate a complete review round and save the agent-revised draft in new scratch.\nUsage: repo-audit.mjs vision-board verdicts --repo <path>|--workspace <path> --board <scratch-board.html> --input <round.json> --draft <revised.md> [--json]\nInput follows schemas/vision-verdicts.json. Previous draft and reasoning remain available. The resulting draft still needs explicit author approval.'
  },
  'contract-test': {
    module: './commands/contract-test.mjs',
    options: ['input', 'schema'],
    help: 'Validate shared schema and joining-ID contracts without writes.\nUsage: repo-audit.mjs contract-test --repo <path>|--workspace <path> --input <file> [--schema <file>] [--json]\n--schema selects a schema definition for subset validation tests.'
  }
}

// Owning tasks register production commands when their implementations land.
export const plannedCommands = []
