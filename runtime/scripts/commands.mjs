// Both protected-write interfaces bind the same canonical plan representation.
const planDigests = '\nDigests use SHA-256 of UTF-8 JSON: recursively sort object keys, preserve array order, encode keys and primitive values with JSON.stringify and omit whitespace between tokens. Hash the complete findings object for findingsDigest; omit only the top-level planDigest when hashing each plan. Creation changeSetDigest equals the referenced change set\'s planDigest.'

// Metadata stays separate so help never imports a command implementation.
// Help text names its entry file {entry}; the generator writes each skill's own file name there.
export const commands = {
  'docs check': {
    module: './commands/docs-check.mjs',
    options: ['contract'],
    help: 'Check registered document paths, local Markdown links and supported glossary structures without writes.\nUsage: {entry} docs check --repo <path> [--contract <repo-relative-file>] [--json]\nDefaults to .bstack/project.json. Register glossary context and format on documents; markdown-bold and markdown-table are supported. Unsupported formats report coverage limits. Duplicate terms fail only within one context.'
  },
  'docs generate': {
    module: './commands/docs-generate.mjs',
    options: ['contract', 'check'],
    help: 'Compare registered generated sections or render proposed documents in scratch.\nUsage: {entry} docs generate --repo <path> [--contract <repo-relative-file>] [--check] [--json]\nGenerator IDs identify markers in outputPaths; stdout is the exact section body. Without --check, review scratch proposals and apply through a selected change set with apply --plan <file>.'
  },
  'contract validate': {
    module: './commands/contract.mjs',
    options: ['contract'],
    help: 'Validate project source pointers, scopes and leaf commands without execution.\nUsage: {entry} contract validate --repo <path> [--contract <repo-relative-file>] [--json]\nDefaults to .bstack/project.json; input follows schemas/project.schema.json. Unsupported config formats need a reviewed standalone contract.'
  },
  'evidence collect': {
    module: './commands/evidence.mjs',
    options: ['contract', 'base', 'previous-contract', 'portable'],
    help: 'Collect the live Git change inventory and save a document assessment skeleton to scratch.\nUsage: {entry} evidence collect --repo <path> --base <ref> [--contract <repo-relative-file>] [--previous-contract <base-policy-path>] [--portable <repo-relative-assessment>] [--json]\nPrevious policy defaults to .bstack/project.json at the base; custom prior authority requires --previous-contract. Portable review requires committed implementation and excludes only the selected record from inventory. Use --base empty before the first commit. An unavailable base blocks comparison. Renames map both paths through case-sensitive scopes. Collection is not semantic assessment or readiness validation.'
  },
  'evidence validate': {
    module: './commands/evidence-validate.mjs',
    options: ['contract', 'base', 'assessment', 'previous-contract'],
    help: 'Validate live change coverage, substantive review freshness and captured required checks.\nUsage: {entry} evidence validate --repo <path> --base <ref> --assessment <file> [--contract <repo-relative-file>] [--previous-contract <base-policy-path>] [--json]\nPrevious policy defaults to .bstack/project.json at the base; custom prior authority requires --previous-contract. Assessment follows schemas/evidence.schema.json. Returns the current review fingerprint; review must bind it explicitly. Missing prior policy, decisions or checks block completion. Structural validation cannot prove semantic correctness.'
  },
  sweep: {
    module: './commands/sweep.mjs',
    options: ['contract'],
    help: 'List what drifted across registered documents, generated sections, verification kits, formal verification suites and AGENTS.md pointers without writes.\nUsage: {entry} sweep --repo <path> [--contract <repo-relative-file>] [--json]\nEach problem names the skill mode that fixes it in its fix field: broken links and glossary structure by the document\'s owner, generated sections by /maintenance, registration by /maintenance create, kit drift by /verification maintain, formal-* suite drift by /formal-verification maintain (including source paths changed since a property\'s sync commit and a sync commit the repo no longer has), broken AGENTS.md links by /agents-md. A suite whose pinned tool file is missing is reported as a coverage limit, because it is unproven and not drifted. Code changes or document age alone never fail sweep. The skill also reviews every registered document against the whole current repo. Fails on reported problems; fixes nothing.'
  },
  'plan check': {
    module: './commands/plan-check.mjs',
    options: ['plan'],
    help: 'Check a scratch plan record for units with no evidence, user-facing units with no kit feature when the project has a verification kit, dependency cycles and design citations that no longer resolve, without writes.\nUsage: {entry} plan check --repo <path>|--workspace <path> --plan <file> [--json]\nPlan follows schemas/plan.json. Each unit lists the check or kit feature that proves it and its design citations, which use the location and exact-byte state of cite-check. A unit marked userFacing must name a kit-feature evidence entry when .agents/skills holds a verify-<app> kit. Fails with unit-no-evidence, unit-no-kit-feature, unknown-dependency, dependency-cycle or the cite-check citation codes. A passing check returns the units in dependency order. It does not judge whether a citation supports the unit or whether the evidence exists yet.'
  },
  'rule-proof': {
    module: './commands/rule-proof.mjs',
    options: ['check-plan', 'check-id', 'valid', 'violation', 'expect'],
    help: 'Prove a selected native check against disposable valid and violation copies.\nUsage: {entry} rule-proof --repo <path> --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text> [--json]\nUses schemas/check-plan.json. Prepare native dependencies in each source fixture first. Unavailable tools or a failed clean control are blocked. Evidence is saved in scratch.'
  },
  'baseline check': {
    module: './commands/baseline.mjs',
    options: ['baseline', 'violations', 'refresh', 'finding', 'findings', 'entry'],
    help: 'Check visible temporary debt and reject new or fixed entries.\nUsage: {entry} baseline check --repo <path> --baseline <repo-relative-file> --violations <file> [--refresh [--finding <id> --findings <file> --entry <file>]] [--json]\nBaseline follows schemas/baseline.schema.json; violations are an array of rule/path/key objects. Refresh removes fixed entries. Adding one entry requires a selected unresolved debt finding in its scope. A failing refresh writes nothing.'
  },
  'project create': {
    module: './commands/project.mjs',
    options: ['plan', 'dry-run'],
    help: 'Create or resume the approved minimal project.\nUsage: {entry} project create --workspace <existing-directory> --plan <file> [--dry-run] [--json]\nPlan follows schemas/project-create.json and references a reviewed change set. Dry run builds only in scratch. Repeat the unchanged plan to recover directory, file and Git creation. Failed setup or journey keeps the project unverified.' + planDigests
  },
  'probe record': {
    module: './commands/probe.mjs',
    options: ['name', 'phase', 'spec', 'approved-by-user', 'command'],
    help: 'Capture a live call in scratch.\nUsage: {entry} probe record --repo <path> --name <n> --phase before|after --spec <file> [--approved-by-user] [--json] -- <executable> [args...]\nDescriptor follows schemas/probe-spec.json. Side effects require approval for each call. Unavailable calls remain unverified.'
  },
  'probe compare': {
    module: './commands/probe.mjs',
    options: ['name', 'before', 'after'],
    help: 'Require a successful matching live probe pair for an outside dependency.\nUsage: {entry} probe compare --repo <path> --name <n> --before <run-id> --after <run-id> [--json]\nMissing, mismatched, unsuccessful or stale evidence cannot pass.'
  },
  'run-checks': {
    module: './commands/run-checks.mjs',
    options: ['plan', 'phase', 'prior-run'],
    help: 'Capture declared checks and user outcome coverage in scratch.\nUsage: {entry} run-checks --repo <path> --plan <file> [--phase before|after] [--prior-run <id>] [--json]\nPhase defaults to after. Plans follow schemas/check-plan.json. Bug fixes and refactors require an original-state before capture. Outside dependencies also require probe record and probe compare.'
  },
  apply: {
    module: './commands/apply.mjs',
    options: ['plan', 'dry-run', 'approved-fingerprint'],
    help: 'Apply or resume a reviewed change set with recoverable originals.\nUsage: {entry} apply --repo <path>|--workspace <path> --plan <file> [--dry-run] [--approved-fingerprint <planDigest>] [--json]\nPlan follows schemas/change-set.schema.json. --dry-run previews exact bytes without writes. Assessment writes require --approved-fingerprint matching the preview planDigest; that value must come from the owner\'s approval reply for the exact preview, never from the agent\'s own approval. Repeating a plan resumes its digest-bound run and still requires the approved fingerprint for assessment writes.' + planDigests
  },
  'state show': {
    module: './commands/state.mjs',
    options: ['run'],
    help: 'Inspect actual pending, applied and conflicting edits without writes.\nUsage: {entry} state show --repo <path>|--workspace <path> --run <id> [--json]'
  },
  'findings validate': {
    module: './commands/findings.mjs',
    options: ['findings'],
    help: 'Validate findings and assess current readiness without writes.\nUsage: {entry} findings validate --repo <path>|--workspace <path> --findings <file> [--json]'
  },
  inspect: {
    module: './commands/inspect.mjs',
    options: [],
    help: 'Inspect starting Git state, manifests and prerequisite versions without writes.\nUsage: {entry} inspect --repo <path> [--json]'
  },
  inventory: {
    module: './commands/inventory.mjs',
    options: [],
    help: 'Discover document sources and scoped instructions without writes.\nUsage: {entry} inventory --repo <path>|--workspace <path> [--json]\nAbsent document kinds are reported without failure. Instruction consolidation is a candidate requiring review.'
  },
  measure: {
    module: './commands/measure.mjs',
    options: ['range', 'exclusions'],
    help: 'Collect endpoint file sizes and current-lifetime history signals without writes.\nUsage: {entry} measure --repo <path> --range <base>..<head>|<head> [--exclusions <file>] [--json]\nA single revision selects its reachable history. Only files present at the endpoint are measured, following renames back to their addition. Exclusions follow schemas/measure-exclusions.json. Signals do not establish violations or merge conflicts.'
  },
  overlap: {
    module: './commands/overlap.mjs',
    options: ['plans'],
    help: 'Compare declared write paths and changing contracts without writes.\nUsage: {entry} overlap --repo <path> --plans <file> <file> [--json]\nPlans follow schemas/overlap-plan.json. Paths are case-sensitive and repo-relative, using /, * and ? within segments, and ** for zero or more segments. Unsupported glob syntax fails. Intersections include planned new files. Disjoint paths do not prove independence.'
  },
  'cite-check': {
    module: './commands/cite-check.mjs',
    options: ['report'],
    help: 'Check file citation locations and exact-byte freshness without writes.\nUsage: {entry} cite-check --repo <path>|--workspace <path> --report <file> [--json]\nReport follows schemas/research-report.json. Web URL/date records are validated without fetching sources.'
  },
  'vision-board build': {
    module: './commands/vision-board-build.mjs',
    options: ['draft', 'proposals'],
    help: 'Build a revision-bound VISION review board in scratch.\nUsage: {entry} vision-board build --repo <path>|--workspace <path> --draft <file> --proposals <file> [--json]\nDraft is UTF-8 Markdown. Proposals follow schemas/vision-proposals.json and name its exact SHA-256.'
  },
  'vision-board launch': {
    module: './commands/vision-board-launch.mjs',
    options: ['board'],
    help: 'Open the pinned board runtime, preserving the scratch draft.\nUsage: {entry} vision-board launch --repo <path>|--workspace <path> --board <scratch-board.html> [--json]\nRead runtimeOutput and run the returned listener in the terminal for author feedback.'
  },
  'vision-board verdicts': {
    module: './commands/vision-board-verdicts.mjs',
    options: ['board', 'input', 'draft'],
    help: 'Validate a complete review round and save the agent-revised draft in new scratch.\nUsage: {entry} vision-board verdicts --repo <path>|--workspace <path> --board <scratch-board.html> --input <round.json> --draft <revised.md> [--json]\nInput follows schemas/vision-verdicts.json. Previous draft and reasoning remain available. The resulting draft still needs explicit author approval.'
  },
  'contract-test': {
    module: './commands/contract-test.mjs',
    options: ['input', 'schema'],
    help: 'Validate shared schema and joining-ID contracts without writes.\nUsage: {entry} contract-test --repo <path>|--workspace <path> --input <file> [--schema <file>] [--json]\n--schema selects a schema definition for subset validation tests.'
  },
  'kit scaffold': {
    module: './commands/kit-scaffold.mjs',
    options: ['plan', 'update'],
    help: 'Render the selected verification kit as a reviewable change set in scratch.\nUsage: {entry} kit scaffold --repo <path> --plan <file> [--update] [--json]\nPlan follows schemas/kit-plan.json. Returns the change set path, its planDigest and the exact diff. Without --update, existing kit files are never overwritten. With --update, the change set also replaces kit files that differ from the plan, creates missing ones and deletes feature files the plan no longer lists; when nothing differs it returns no change set. Review with apply --dry-run, then apply the unchanged change set.'
  },
  'kit check': {
    module: './commands/kit-check.mjs',
    options: ['app'],
    help: 'Check an applied verification kit for drift without running the product or writing.\nUsage: {entry} kit check --repo <path> --app <name> [--json]\nFails with one problem per drifted file, missing file, orphan feature file, missing AGENTS.md pointer or feature source path that matches no file: file-drift, file-missing, orphan-feature-file, pointer-missing, source-path-missing. It compares the kit with what kit.json renders and with the repo, and does not judge whether the feature files are true; drive them with kit prove.'
  },
  'kit prove': {
    module: './commands/kit-prove.mjs',
    options: ['app', 'feature'],
    help: 'Run the applied kit end to end once: launch, doctor, drive one feature, capture evidence, clean up and confirm the evidence survived.\nUsage: {entry} kit prove --repo <path> --app <name> --feature <id> [--json]\nReads .agents/skills/verify-<name>/kit.json. Cleanup stops only the process the proof started. A failed proof still cleans up and keeps its evidence.'
  },
  'formal scaffold': {
    module: './commands/formal-scaffold.mjs',
    options: ['plan', 'update'],
    help: 'Render the selected formal verification suite as a reviewable change set in scratch.\nUsage: {entry} formal scaffold --repo <path> --plan <file> [--update] [--json]\nPlan follows schemas/formal-plan.json. Returns the change set path, its planDigest and the exact diff. Rejects a plan whose model step cites no atomic code step, cites code outside the property\'s source paths or cites a line that does not exist. Without --update, existing suite files are never overwritten. With --update, the change set also replaces suite files that differ from the plan, creates missing ones and deletes property and model files the plan no longer lists; when nothing differs it returns no change set. Review with apply --dry-run, then apply the unchanged change set.'
  },
  'formal check': {
    module: './commands/formal-check.mjs',
    options: ['suite', 'sync-commit'],
    help: 'Check an applied formal verification suite for drift without running the model checker or writing.\nUsage: {entry} formal check --repo <path> --suite <name> [--sync-commit <sha>] [--json]\nFails with one problem per finding: file-drift, file-missing, source-paths-missing, table-drift, orphan-property-file, orphan-model-file, pointer-missing, source-path-missing, step-code-missing, design-citation problems, source-changed-since-sync, sync-commit-missing and tool-hash-mismatch. A missing tool file is blocked as tool-missing: the properties are unproven, never passing. It compares the suite with what suite.json renders, with the repo and with the pinned tool file\'s sha256, and does not judge whether a model is true; rerun every property check for that.\nA property records the commit its model was last confirmed at as syncCommit. source-changed-since-sync means its source paths differ between that commit and HEAD, which a change already on the base branch causes without the gate or the model check noticing. sync-commit-missing means the commit is absent or no longer in the repo, as after a rebase or squash; drift is then checked from the last commit that changed the suite, and the problem says so. Both route to maintain and neither fails the maintained check command. --sync-commit <sha> checks every property against that commit in place of the recorded ones, so maintain can prove a commit passes before it records it.'
  },
  'comment-check generate': {
    module: './commands/comment-check.mjs',
    options: ['language'],
    help: 'Generate a comment-ban checker that uses the target language\'s own tokenizer, in scratch.\nUsage: {entry} comment-check generate --repo <path> --language python|go|typescript [--json]\nThe checker is self-contained, runs without bstack and fails on every prose comment. Rule-specific machine directives and license headers are exempt. --baseline <file> accepts temporary debt entries and --list prints the current violations as rule/path/key objects. Propose it as a selected create edit and wire it into the maintained check command.'
  }
}
