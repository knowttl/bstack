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
import { checkCommandPaths, checkInputState } from './run-checks.mjs'
import { validateFindings } from './findings.mjs'
import evidenceSchema from '../../schemas/evidence.schema.json' with { type: 'json' }
import impactSchema from '../../schemas/impact-assessment.json' with { type: 'json' }
import checkSchema from '../../schemas/check-plan.json' with { type: 'json' }

// This conservative normalization rejects cosmetic proof, not semantic disagreement.
function meaningful(text, excerpt, path) {
  const screened = text.split('')
  const literals = new Set()
  const hashLanguages = /^(?:yaml|yml|python|py|shell|sh|bash|zsh)$/i
  const sourceLanguage = path?.split('.').at(-1) ?? ''
  let language = sourceLanguage
  let fence = null
  const erase = (start, end) => { for (let i = start; i < end; i++) if (!/[\r\n]/.test(text[i])) screened[i] = ' ' }
  const protect = (start, end) => { for (let i = start; i < end; i++) literals.add(i) }
  function scan(start, expression = false, shellEnd = null) {
    let braces = 0
    let parentheses = 0
    const heredocs = []
    for (let i = start; i < text.length;) {
      if (literals.has(i)) { i++; continue }
      if (text[i] === '\n' && heredocs.length) {
        let end = i + 1
        for (const { delimiter, tabs } of heredocs) {
          while (end < text.length) {
            const newline = text.indexOf('\n', end)
            const next = newline < 0 ? text.length : newline + 1
            const line = text.slice(end, newline < 0 ? text.length : newline).replace(/\r$/, '')
            end = next
            if ((tabs ? line.replace(/^\t*/, '') : line) === delimiter) break
          }
        }
        protect(i + 1, end)
        heredocs.length = 0
        i = end
        continue
      }
      if (!expression && (i === 0 || text[i - 1] === '\n')) {
        const delimiter = text.slice(i).match(/^[ \t]*(`{3,}|~{3,})([^\r\n]*)/)
        if (delimiter && (!fence || (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && !delimiter[2].trim()))) {
          language = fence ? sourceLanguage : delimiter[2].trim().split(/\s+/)[0]
          fence = fence ? null : delimiter[1]
          i += delimiter[0].length
          continue
        }
      }
      const shell = /^(?:shell|sh|bash|zsh)$/i.test(language)
      if (shell && text[i] === '\\') { protect(i, i + 2); i += 2; continue }
      if (shellEnd && text.startsWith(shellEnd, i) && parentheses === 0) return i + shellEnd.length
      if (shellEnd?.endsWith(')') && text[i] === '(') parentheses++
      else if (shellEnd?.endsWith(')') && text[i] === ')') parentheses--
      if (shell && shellEnd !== '))' && text.startsWith('<<', i) && text[i - 1] !== '<' && text[i + 2] !== '<') {
        const heredoc = text.slice(i).match(/^<<(-?)[ \t]*((?:'[^'\r\n]*'|"[^"\r\n]*"|\\[^\r\n]|[^\s<>|&;()'"\\])+)/)
        if (heredoc) {
          heredocs.push({ delimiter: heredoc[2].replace(/'([^']*)'|"([^"]*)"|\\(.)/g, (_, single, double, escaped) => single ?? double ?? escaped), tabs: Boolean(heredoc[1]) })
          i += heredoc[0].length
          continue
        }
      }
      if (/^(?:yaml|yml)$/i.test(language) && /[|>]/.test(text[i]) &&
          /^[|>](?:[1-9][+-]?|[+-][1-9]?)?[ \t]*(?:#[^\r\n]*)?(?:\r?\n|$)/.test(text.slice(i))) {
        const lineStart = text.lastIndexOf('\n', i - 1) + 1
        const prefix = text.slice(lineStart, i)
        if (/(?:^\s*-\s*|:\s*)(?:[&!]\S+\s+)*$/.test(prefix)) {
          const indentation = prefix.match(/^ */)[0].length
          const explicit = text.slice(i).match(/^[|>][+-]?([1-9])/)
          let required = explicit ? indentation + Number(explicit[1]) : null
          let end = text.indexOf('\n', i) + 1
          const start = end
          while (end > 0 && end < text.length) {
            const newline = text.indexOf('\n', end)
            const line = text.slice(end, newline < 0 ? text.length : newline)
            const indent = line.match(/^ */)[0].length
            if (line.trim()) {
              if (required === null) required = indent > indentation ? indent : indentation + 1
              if (indent < required) break
            }
            end = newline < 0 ? text.length : newline + 1
          }
          protect(start, end)
        }
      }
      const url = text.slice(i).match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'`<>]*/)
      if (url) { i += url[0].length; continue }
      const hashComment = shellEnd !== '))' && text[i] === '#' && hashLanguages.test(language) &&
        (/^(?:python|py)$/i.test(language) || i === 0 || /\s/.test(text[i - 1]) ||
          (/^(?:shell|sh|bash|zsh)$/i.test(language) && /[;&|()]/.test(text[i - 1])))
      const cStyle = !hashLanguages.test(language)
      const comment = cStyle && text.startsWith('<!--', i) ? ['-->', 4] : cStyle && text.startsWith('/*', i) ? ['*/', 2] : cStyle && text.startsWith('//', i) ? ['\n', 2] : hashComment ? ['\n', 1] : null
      if (comment) {
        const end = text.indexOf(comment[0], i + comment[1])
        const next = end < 0 ? text.length : end + (comment[0] === '\n' ? 0 : comment[0].length)
        erase(i, next)
        i = next
        continue
      }
      if (text.startsWith('```', i)) { while (text[i] === '`') i++; continue }
      if (shell && (text.startsWith('$((', i) || text.startsWith('((', i))) {
        i = scan(i + (text[i] === '$' ? 3 : 2), false, '))')
        continue
      }
      if (shell && (text[i] === '`' || text.startsWith('$(', i))) {
        i = text[i] === '`' ? scan(i + 1, false, '`') : scan(i + 2, false, ')')
        continue
      }
      const triple = /^(?:python|py)$/i.test(language) && (text.startsWith('"""', i) || text.startsWith("'''", i))
      const quote = triple ? text.slice(i, i + 3) : text[i]
      const multiline = triple || shell || /^(?:yaml|yml)$/i.test(language)
      const closedLiteral = triple ? text.indexOf(quote, i + 3) >= 0 : multiline ?
        text.slice(i).match(/^(?:"(?:\\[\s\S]|[^"\\])*"|'[^']*')/) :
        text.slice(i).match(/^(?:"(?:\\[^\r\n]|[^"\\\r\n])*"|'(?:\\[^\r\n]|[^'\\\r\n])*'|`(?:\\[\s\S]|[^`\\])*`)/)
      if (closedLiteral && !(!multiline && quote === "'" && /[\p{L}\p{N}_]/u.test(text[i - 1] ?? ''))) {
        protect(i, i + quote.length)
        i += quote.length
        while (i < text.length) {
          if (text[i] === '\\' && (quote !== "'" || !multiline)) { literals.add(i++); literals.add(i++); continue }
          if (text.startsWith(quote, i)) { protect(i, i + quote.length); i += quote.length; break }
          if (!multiline && quote !== '`' && /[\r\n]/.test(text[i])) break
          if (shell && quote === '"' && (text[i] === '`' || text.startsWith('$(', i))) {
            i = text[i] === '`' ? scan(i + 1, false, '`') : text.startsWith('$((', i) ? scan(i + 3, false, '))') : scan(i + 2, false, ')')
            continue
          }
          if (quote === '`' && text.startsWith('${', i)) { i = scan(i + 2, true); continue }
          literals.add(i++)
        }
        continue
      }
      if (expression && text[i] === '}' && braces-- === 0) return i + 1
      if (expression && text[i] === '{') braces++
      i++
    }
    return text.length
  }
  scan(0)
  const document = screened.join('').replace(/^[ \t]*(?:updated|last[- ]updated)[ \t]*:.*$/gim,
    (match, offset) => literals.has(offset + match.search(/\S/)) ? match : ' '.repeat(match.length))
  if (excerpt === undefined) return document.replace(/\s+/g, '')
  if (!excerpt) return ''
  for (let index = text.indexOf(excerpt); index >= 0; index = text.indexOf(excerpt, index + 1)) {
    const value = document.slice(index, index + excerpt.length).replace(/\s+/g, '')
    if (value) return value
  }
  return ''
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
  const previous = await previousPolicy(target.root, inventory.base, proposed.path, inventory, options['previous-contract'])
  const contracts = [proposed.contract, ...(previous ? [previous.contract] : [])]
  const mapping = mapInventory(inventory, contracts)
  let assessment
  try { assessment = inspectJSON(await readFile(options.assessment, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('blocked', [{ code: 'assessment-unavailable', message: 'Assessment file is unavailable.', fix: 'Collect and complete an assessment, then pass its readable path with --assessment.' }])
  }
  validateData(evidenceSchema, assessment)
  validateIds(assessment.decisions, 'decisions')
  const problems = []
  const problem = (code, message) => problems.push({ code, message, fix: 'Review the live diff and prior policy, complete the assessment, bind its current fingerprint and recapture required checks.' })
  const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b)
  for (const key of ['base', 'head', 'changes', 'paths']) if (!equal(assessment[key], inventory[key])) problem('inventory-mismatch', `Assessment ${key} does not match the complete live comparison.`)
  if (assessment.repo !== target.root || assessment.contract !== proposed.path) problem('target-mismatch', 'Assessment names a different repo or contract.')
  if (assessment.previousContract !== (previous?.path ?? null)) problem('target-mismatch', 'Assessment names a different previous policy.')
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
    validateData(impactSchema.properties.citations.items, cite)
    const path = await resolvePath(target.root, cite.path)
    citedPaths.push(cite.path)
    const text = cite.version === 'base' ? baseText(target.root, inventory.base, cite.path) : await readFile(path, 'utf8').catch(() => '')
    if (!text.includes(cite.pointer)) problem('citation-unavailable', `Citation ${cite.path} does not contain the ${cite.version} source pointer.`)
  }
  async function impact(entry, document) {
    if (!entry.assessment) { problem('missing-assessment', `Missing substantive assessment for ${entry.path}.`); return }
    const value = entry.assessment
    validateData(impactSchema, value)
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
      const oldDocument = meaningful(before, undefined, entry.path)
      const newDocument = meaningful(after, undefined, entry.path)
      const oldExcerpt = delta && meaningful(before, delta.before, entry.path)
      const newExcerpt = delta && meaningful(after, delta.after, entry.path)
      if (!document || !delta || oldDocument === newDocument || oldExcerpt === newExcerpt ||
          (delta.before && !oldExcerpt) || (delta.after && !newExcerpt) ||
          !before.includes(delta.before) || !after.includes(delta.after) ||
          !oldDocument.includes(oldExcerpt) || !newDocument.includes(newExcerpt) ||
          (delta.before && newDocument.includes(oldExcerpt)) || (delta.after && oldDocument.includes(newExcerpt))) {
        problem('meaningless-document-delta', `Updated ${entry.path} needs an actual changed definition or rule excerpt, beyond timestamp metadata, whitespace or comments.`)
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
  const commandPaths = await checkCommandPaths(target, contracts.flatMap(contract => contract.checks), inventory.paths)
  const requiredChecks = contracts.flatMap(contract => contract.checks.filter(check => affectedRules.some(rule => rule.checkIds.includes(check.id)) ||
    commandPaths.get(check).some(path => inventory.paths.includes(path)) ||
    inventory.paths.some(path => check.inputScopes.some(scope => matchesPath(pathGlob(scope), path))) || inventory.paths.includes(proposed.path) || inventory.paths.includes(previous?.path)))
    .filter((check, i, all) => all.findIndex(item => equal(item, check)) === i)
  for (const rule of affectedRules) if (!assessment.coverage.includes(rule.id)) problem('missing-rule-coverage', `Rule ${rule.id} from previous/proposed policy has no assessment coverage.`)
  const captures = []
  for (const record of assessment.execution) {
    try {
      const plan = inspectJSON(await readFile(record.plan, 'utf8')).value
      validateData(checkSchema, plan)
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
      const relevant = [...policyInputs, ...commandPaths.get(check), ...inventory.paths.filter(path => check.inputScopes.some(scope => matchesPath(pathGlob(scope), path)))]
      return declared && successful(result) && successful(result.toolVersion) &&
        relevant.every(path => current.state.files.some(file => file.path === path))
    })) problem('required-check-missing', `Required previous/proposed check ${check.id} has no successful matching capture.`)
  }
  const files = await repoFiles(target.root)
  const scopes = contracts.flatMap(contract => contract.checks.flatMap(check => check.inputScopes)).map(pathGlob)
  const paths = [...inventory.paths, proposed.path, ...(previous ? [previous.path] : []), ...citedPaths,
    ...[...commandPaths.values()].flat(),
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
