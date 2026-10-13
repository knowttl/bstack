// Both protected-write interfaces bind the same canonical plan representation.
const planDigests = '\nDigests use SHA-256 of UTF-8 JSON: recursively sort object keys, preserve array order, encode keys and primitive values with JSON.stringify and omit whitespace between tokens. Hash the complete findings object for findingsDigest; omit only the top-level planDigest when hashing each plan.'

// Metadata stays separate so help never imports a command implementation.
export const commands = {
  'kit scaffold': {
    module: './commands/kit-scaffold.mjs',
    options: ['plan'],
    help: 'Render the selected verification kit as a reviewable change set in scratch.\nUsage: verification.mjs kit scaffold --repo <path> --plan <file> [--json]\nPlan follows schemas/kit-plan.json. Returns the change set path, its planDigest and the exact diff. Existing kit files are never overwritten. Review with apply --dry-run, then apply the unchanged change set.'
  },
  'kit prove': {
    module: './commands/kit-prove.mjs',
    options: ['app', 'feature'],
    help: 'Run the applied kit end to end once: launch, doctor, drive one feature, capture evidence, clean up and confirm the evidence survived.\nUsage: verification.mjs kit prove --repo <path> --app <name> --feature <id> [--json]\nReads .agents/skills/verify-<name>/kit.json. Cleanup stops only the process the proof started. A failed proof still cleans up and keeps its evidence.'
  },
  'comment-check generate': {
    module: './commands/comment-check.mjs',
    options: ['language'],
    help: 'Generate a comment-ban checker that uses the target language\'s own tokenizer, in scratch.\nUsage: verification.mjs comment-check generate --repo <path> --language python|go|typescript [--json]\nThe checker is self-contained, runs without bstack and fails on every prose comment. Rule-specific machine directives and license headers are exempt. --baseline <file> accepts temporary debt entries and --list prints the current violations as rule/path/key objects. Propose it as a selected create edit and wire it into the maintained check command.'
  },
  apply: {
    module: './commands/apply.mjs',
    options: ['plan', 'dry-run', 'approved-fingerprint'],
    help: 'Apply or resume a reviewed change set with recoverable originals.\nUsage: verification.mjs apply --repo <path> --plan <file> [--dry-run] [--approved-fingerprint <planDigest>] [--json]\nPlan follows schemas/change-set.schema.json. --dry-run previews exact bytes without writes. Repeating a plan resumes its digest-bound run.' + planDigests
  },
  'state show': {
    module: './commands/state.mjs',
    options: ['run'],
    help: 'Inspect actual pending, applied and conflicting edits without writes.\nUsage: verification.mjs state show --repo <path> --run <id> [--json]'
  },
  'findings validate': {
    module: './commands/findings.mjs',
    options: ['findings'],
    help: 'Validate findings and assess current readiness without writes.\nUsage: verification.mjs findings validate --repo <path> --findings <file> [--json]'
  },
  'rule-proof': {
    module: './commands/rule-proof.mjs',
    options: ['check-plan', 'check-id', 'valid', 'violation', 'expect'],
    help: 'Prove a selected native check against disposable valid and violation copies.\nUsage: verification.mjs rule-proof --repo <path> --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text> [--json]\nUses schemas/check-plan.json. Prepare native dependencies in each source fixture first. Unavailable tools or a failed clean control are blocked. Evidence is saved in scratch.'
  },
  'baseline check': {
    module: './commands/baseline.mjs',
    options: ['baseline', 'violations', 'refresh', 'finding', 'findings', 'entry'],
    help: 'Check visible temporary debt and reject new or fixed entries.\nUsage: verification.mjs baseline check --repo <path> --baseline <repo-relative-file> --violations <file> [--refresh [--finding <id> --findings <file> --entry <file>]] [--json]\nBaseline follows schemas/baseline.schema.json; violations are an array of rule/path/key objects. Refresh removes fixed entries. Adding one entry requires a selected unresolved debt finding in its scope. A failing refresh writes nothing.'
  },
  'run-checks': {
    module: './commands/run-checks.mjs',
    options: ['plan', 'phase', 'prior-run'],
    help: 'Capture declared checks and user outcome coverage in scratch.\nUsage: verification.mjs run-checks --repo <path> --plan <file> [--phase before|after] [--prior-run <id>] [--json]\nPhase defaults to after. Plans follow schemas/check-plan.json. Bug fixes and refactors require an original-state before capture. Outside dependencies also require probe record and probe compare.'
  },
  'probe record': {
    module: './commands/probe.mjs',
    options: ['name', 'phase', 'spec', 'approved-by-user', 'command'],
    help: 'Capture a live call in scratch.\nUsage: verification.mjs probe record --repo <path> --name <n> --phase before|after --spec <file> [--approved-by-user] [--json] -- <executable> [args...]\nDescriptor follows schemas/probe-spec.json. Side effects require approval for each call. Unavailable calls remain unverified.'
  },
  'probe compare': {
    module: './commands/probe.mjs',
    options: ['name', 'before', 'after'],
    help: 'Require a successful matching live probe pair for an outside dependency.\nUsage: verification.mjs probe compare --repo <path> --name <n> --before <run-id> --after <run-id> [--json]\nMissing, mismatched, unsuccessful or stale evidence cannot pass.'
  }
}
