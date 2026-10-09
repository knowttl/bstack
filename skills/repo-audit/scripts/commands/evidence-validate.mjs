import { readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolvePath } from '../lib/paths.mjs'
import { readGit, repoFiles } from '../lib/discovery.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { canonicalJSON, fingerprint, hashBytes } from '../lib/fingerprint.mjs'
import { pathGlob, matchesPath } from '../lib/glob.mjs'
import { scratchDirectory } from '../lib/scratch.mjs'
import { CommandError } from '../lib/result.mjs'
import { baseText, previousPolicy, mapInventory } from '../lib/evidence-policy.mjs'
import { collectInventory } from './evidence.mjs'
import { loadContract } from './contract.mjs'
import { checkInputState } from './run-checks.mjs'
import { validateFindings } from './findings.mjs'

// Literal bundled resources remain discoverable to the package validator.
const schemaPaths = {
  'evidence.schema.json': new URL('../../schemas/evidence.schema.json', import.meta.url),
  'impact-assessment.json': new URL('../../schemas/impact-assessment.json', import.meta.url),
  'check-plan.json': new URL('../../schemas/check-plan.json', import.meta.url)
}

async function schema(name) {
  return JSON.parse(await readFile(schemaPaths[name], 'utf8'))
}

// This conservative normalization rejects cosmetic proof, not semantic disagreement.
function meaningful(text) {
  return text.replace(/(`{3,}|"(?:\\[\s\S]|[^"\\\r\n])*"|'(?:\\[\s\S]|[^'\\\r\n])*'|`(?:\\[\s\S]|[^`\\])*`)|<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
    (match, literal) => literal ?? '')
    .replace(/^\s*(?:date|updated|last[- ]updated|timestamp)\s*:.*$/gim, '')
    .replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?\b/g, '').replace(/\s+/g, '')
}

function successful(result) {
  return result?.status === 'passed' && result.exitCode === 0 && result.signal === null && result.error === null &&
    result.cancelled === false && result.timedOut === false && typeof result.stdout === 'string' && typeof result.stderr === 'string' &&
    Number.isFinite(result.durationMs) && result.durationMs >= 0
}

export async function run(options) {
  if (!options.base || !options.assessment) throw new CommandError('usage-error', [{ code: 'missing-evidence-input',
    message: 'Explicit base and assessment are required.', fix: 'Supply --base <ref> --assessment <file> [--contract <path>].' }])
  const target = await resolveTarget(options)
  const inventory = collectInventory(target.root, options.base)
  if (inventory.head && readGit(target.root, ['merge-base', '--is-ancestor', inventory.base.objectId, inventory.head]).status !== 0) {
    throw new CommandError('blocked', [{ code: 'unsupported-comparison-base', message: 'The base must be an ancestor of HEAD.', fix: 'Select the agreed ancestor commit, or empty only before the first commit.' }])
  }
  const removed = new Set(inventory.changes.filter(change => change.status === 'D' || change.oldPath).map(change => change.oldPath ?? change.path))
  const proposed = await loadContract(target, options.contract, removed)
  const previous = await previousPolicy(target.root, inventory.base, proposed.path, inventory.paths)
  const contracts = [proposed.contract, ...(previous ? [previous.contract] : [])]
  const mapping = mapInventory(inventory, contracts)
  let assessment
  try { assessment = inspectJSON(await readFile(options.assessment, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('blocked', [{ code: 'assessment-unavailable', message: 'Assessment file is unavailable.', fix: 'Collect and complete an assessment, then pass its readable path with --assessment.' }])
  }
  validateData(await schema('evidence.schema.json'), assessment)
  validateIds(assessment.decisions, 'decisions')
  const problems = []
  const problem = (code, message) => problems.push({ code, message, fix: 'Review the live diff and prior policy, complete the assessment, bind its current fingerprint and recapture required checks.' })
  const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b)
  for (const key of ['base', 'head', 'changes', 'paths']) if (!equal(assessment[key], inventory[key])) problem('inventory-mismatch', `Assessment ${key} does not match the complete live comparison.`)
  if (assessment.repo !== target.root || assessment.contract !== proposed.path) problem('target-mismatch', 'Assessment names a different repo or contract.')
  if (!equal(assessment.mappings, mapping.mappings) || !equal(assessment.unmappedPaths, mapping.unmappedPaths) ||
      !equal(assessment.documents.map(({ id, path }) => ({ id, path })), mapping.candidateDocuments) ||
      !equal(assessment.unmappedAssessments.map(item => item.path), mapping.unmappedPaths)) problem('coverage-mismatch', 'Assessments omit or replace live previous/proposed document or unmapped-path coverage.')
  if (!previous) {
    const foundation = assessment.foundation
    if (foundation) {
      await validateFindings(foundation.record, target)
      const finding = foundation.record.findings.find(item => item.id === foundation.findingId)
      if (foundation.record.stage !== 'foundation' || foundation.record.target.root !== target.root ||
          foundation.record.target.revision !== inventory.head || !foundation.record.selectedFindingIds.includes(foundation.findingId) ||
          finding?.status !== 'selected' || !finding.scope.includes(proposed.path)) problem('unselected-foundation', 'Initial contract needs a selected foundation finding covering this contract and target.')
    } else problem('previous-contract-unavailable', 'Prerequisite: restore the previous contract or supply the explicitly selected initial foundation finding.')
  }
  const citedPaths = []
  async function citation(cite) {
    validateData((await schema('impact-assessment.json')).properties.citations.items, cite)
    const path = await resolvePath(target.root, cite.path)
    citedPaths.push(cite.path)
    const text = cite.version === 'base' ? baseText(target.root, inventory.base, cite.path) : await readFile(path, 'utf8').catch(() => '')
    if (!text.includes(cite.pointer)) problem('citation-unavailable', `Citation ${cite.path} does not contain the ${cite.version} source pointer.`)
  }
  async function impact(entry, document) {
    if (!entry.assessment) { problem('missing-assessment', `Missing substantive assessment for ${entry.path}.`); return }
    const value = entry.assessment
    validateData(await schema('impact-assessment.json'), value)
    if (value.changedPaths.some(path => !inventory.paths.includes(path))) problem('unsupported-impact-path', `Assessment ${entry.path} names unchanged paths.`)
    const expected = document ? mapping.mappings.filter(item => item.documentIds.includes(entry.id) || item.path === entry.path).map(item => item.path) : [entry.path]
    if (expected.some(path => !value.changedPaths.includes(path))) problem('omitted-impact-path', `Assessment ${entry.path} omits changed behaviour inputs.`)
    for (const cite of value.citations) await citation(cite)
    if (document && !value.citations.some(cite => cite.path === entry.path)) problem('missing-document-citation', `Assessment ${entry.path} must cite its authoritative document.`)
    if (value.result === 'decision-needed') {
      if (!value.dependentWork.length) problem('missing-dependent-work', `Decision for ${entry.path} must name affected work.`)
      problem('decision-needed', `Decision for ${entry.path} blocks ${value.dependentWork.join(', ') || 'dependent work'}.`)
    }
    if (value.result === 'updated') {
      const before = baseText(target.root, inventory.base, entry.path)
      const after = await readFile(await resolvePath(target.root, entry.path), 'utf8').catch(() => '')
      const delta = value.delta
      const oldDocument = meaningful(before)
      const newDocument = meaningful(after)
      const oldExcerpt = delta?.before.replace(/\s+/g, '')
      const newExcerpt = delta?.after.replace(/\s+/g, '')
      if (!document || !delta || oldDocument === newDocument || oldExcerpt === newExcerpt ||
          !before.includes(delta.before) || !after.includes(delta.after) ||
          !oldDocument.includes(oldExcerpt) || !newDocument.includes(newExcerpt) ||
          (delta.before && newDocument.includes(oldExcerpt)) || (delta.after && oldDocument.includes(newExcerpt))) {
        problem('meaningless-document-delta', `Updated ${entry.path} needs an actual changed definition or rule excerpt, beyond dates, whitespace or comments.`)
      }
    }
  }
  for (const entry of assessment.documents) await impact(entry, true)
  for (const entry of assessment.unmappedAssessments) await impact(entry, false)
  const sources = contracts.flatMap(contract => contract.acceptanceSources)
  for (const source of sources) {
    const before = baseText(target.root, inventory.base, source.path)
    const after = await readFile(await resolvePath(target.root, source.path), 'utf8').catch(() => '')
    if (before === after) continue
    const decision = assessment.decisions.find(item => item.source === source.path && item.status === 'approved')
    if (!decision || !decision.approval || !(before ? before.includes(decision.oldCase) : decision.oldCase === '[absent]') ||
        !(after ? after.includes(decision.newCase) : decision.newCase === '[absent]') ||
        sources.some(item => item.path === decision.approval.path)) problem('acceptance-decision-required', `Acceptance source ${source.path} needs old case, approved new case, affected work and a separate approval citation.`)
    else await citation(decision.approval)
  }
  for (const decision of assessment.decisions) if (decision.status !== 'approved') problem('unresolved-decision', `Decision ${decision.id} blocks ${decision.affectedWork.join(', ')}.`)
  const affectedRules = contracts.flatMap(contract => contract.rules.filter(rule => mapping.mappings.some(item => item.ruleIds.includes(rule.id) || item.path === rule.path)))
  const requiredChecks = contracts.flatMap(contract => contract.checks.filter(check => affectedRules.some(rule => rule.checkIds.includes(check.id)) ||
    inventory.paths.some(path => check.inputScopes.some(scope => matchesPath(pathGlob(scope), path))) || inventory.paths.includes(proposed.path) || inventory.paths.includes(previous?.path)))
    .filter((check, i, all) => all.findIndex(item => equal(item, check)) === i)
  for (const rule of affectedRules) if (!assessment.coverage.includes(rule.id)) problem('missing-rule-coverage', `Rule ${rule.id} from previous/proposed policy has no assessment coverage.`)
  const captures = []
  for (const record of assessment.execution) {
    try {
      const plan = inspectJSON(await readFile(record.plan, 'utf8')).value
      validateData(await schema('check-plan.json'), plan)
      const capture = JSON.parse(await readFile(join(await scratchDirectory(target, record.runId), 'checks.json'), 'utf8'))
      const current = await checkInputState(target, plan, record.plan)
      if (capture.schemaVersion !== 1 || capture.runId !== record.runId || capture.phase !== 'after' || capture.status !== 'passed' ||
          capture.planDigest !== hashBytes(canonicalJSON(plan)) || capture.originalState?.fingerprint !== current.fingerprint ||
          capture.finalState?.fingerprint !== current.fingerprint) problem('stale-execution', `Capture ${record.runId} does not match current check inputs.`)
      else captures.push({ plan, capture, current })
    } catch { problem('execution-unavailable', `Capture ${record.runId} or its plan is unavailable or invalid.`) }
  }
  const policyInputs = [...new Set([proposed.path, ...(previous ? [previous.path] : []), ...contracts.flatMap(contract =>
    [...contract.documents, ...contract.rules, ...contract.acceptanceSources].map(item => item.path))])]
  for (const check of requiredChecks) {
    if (!captures.some(({ plan, capture, current }) => {
      const declared = plan.checks.find(item => item.id === check.id && item.required && equal(item.command, check.command) && check.inputScopes.every(scope => item.inputScopes.includes(scope)))
      const executed = capture.checks?.find(item => item.id === check.id && item.required && item.satisfied && item.status === 'passed' && equal(item.command, check.command))
      const result = executed?.execution
      const relevant = [...policyInputs, ...inventory.paths.filter(path => check.inputScopes.some(scope => matchesPath(pathGlob(scope), path)))]
      return declared && successful(result) && successful(result.toolVersion) &&
        relevant.every(path => current.state.files.some(file => file.path === path))
    })) problem('required-check-missing', `Required previous/proposed check ${check.id} has no successful matching capture.`)
  }
  const files = await repoFiles(target.root)
  const scopes = contracts.flatMap(contract => contract.checks.flatMap(check => check.inputScopes)).map(pathGlob)
  const paths = [...inventory.paths, proposed.path, ...(previous ? [previous.path] : []), ...citedPaths,
    ...contracts.flatMap(contract => [...contract.documents, ...contract.rules, ...contract.acceptanceSources].map(item => item.path)),
    ...contracts.flatMap(contract => contract.checks.flatMap(check => check.inputScopes.filter(scope => !/[*?]/.test(scope)))),
    ...files.filter(path => scopes.some(scope => matchesPath(scope, path)))]
  const binding = await fingerprint(target, { baseCommit: inventory.base.objectId, paths, inputs: assessment,
    evidencePath: relative(target.root, resolve(options.assessment)) })
  if (assessment.fingerprint !== binding.fingerprint) problem('stale-review', 'Substantive review inputs changed or have not been bound to the current fingerprint.')
  return { status: problems.length ? 'blocked' : 'passed', problems, inputs: { repo: target.root, base: options.base, assessment: options.assessment, contract: proposed.path },
    data: { ...inventory, ...mapping, previousContract: previous?.path ?? null, requiredCheckIds: [...new Set(requiredChecks.map(check => check.id))],
      fingerprint: binding.fingerprint, limitations: ['Structural validation cannot prove that explanations or document deltas agree semantically with code, or authenticate owner approval. The selected review process must assess these claims.', 'Local execution records are not authenticated portable attestations. Captures cover declared inputs only; transient changes restored before capture completion are not detected.'] } }
}
