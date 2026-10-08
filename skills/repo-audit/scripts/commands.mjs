// Metadata stays separate so help never imports a command implementation.
export const commands = {
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
export const plannedCommands = ['rule-proof', 'baseline check', 'contract validate', 'evidence collect', 'evidence validate', 'docs generate', 'docs check']
