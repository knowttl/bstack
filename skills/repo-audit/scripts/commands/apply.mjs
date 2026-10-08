import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { canonicalJSON, hashBytes } from '../lib/fingerprint.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { proposedEdit, exactDiff } from '../lib/proposed-edit.mjs'
import { CommandError } from '../lib/result.mjs'
import { validateFindings } from './findings.mjs'
import { loadJournal, journalOriginal, inspectJournal, fileBytes, applyWrites } from '../lib/protected-write.mjs'

function reject(code, message, path) {
  throw new CommandError('failed', [{ code, message, path, fix: 'Regenerate the plan from current findings and resolved scope, then review the exact proposed bytes again.' }])
}

async function input(file) {
  try { return inspectJSON(await readFile(file, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    reject('invalid-input', 'Input must be readable JSON.', file)
  }
}

export async function prepareChangeSet(options, target) {
  if (!options.plan) throw new CommandError('usage-error', [{ code: 'missing-plan', message: '--plan is required.', fix: 'Supply a reviewed change set.' }])
  const plan = await input(options.plan)
  validateData(JSON.parse(await readFile(new URL('../../schemas/change-set.schema.json', import.meta.url), 'utf8')), plan)
  const findings = await input(resolve(dirname(resolve(options.plan)), plan.findings))
  const { directory, journal } = options['dry-run'] ? { directory: null, journal: null } : await loadJournal(target, plan.planDigest)
  const deletionScope = plan.reviewedScope.filter(entry => journal?.edits.some(edit =>
    edit.originalHash !== null && edit.proposedHash === null && edit.resolvedPath === entry.resolvedPath))
  await validateFindings(findings, target, deletionScope)
  validateIds(plan.edits, '$/edits')
  const { planDigest, ...reviewed } = plan
  if (hashBytes(canonicalJSON(reviewed)) !== planDigest || hashBytes(canonicalJSON(findings)) !== plan.findingsDigest) reject('changed-plan', 'The reviewed plan or findings digest changed.')
  if (plan.target.root !== target.root || plan.target.mode !== target.mode || canonicalJSON(plan.target) !== canonicalJSON(findings.target)) reject('target-mismatch', 'Reviewed target identity differs from the selected target.')
  if (target.mode === 'workspace') {
    if (plan.target.revision !== null) reject('target-mismatch', 'A workspace has no Git revision.')
  } else {
    const env = { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined }
    const head = spawnSync('git', ['-C', target.root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', env })
    if (head.error || (head.status !== 0 && plan.target.revision !== null) || (head.status === 0 && head.stdout.trim() !== plan.target.revision)) reject('changed-revision', 'The reviewed Git revision is no longer current.')
  }
  const selected = findings.findings.filter(finding => finding.status === 'selected').map(finding => finding.id)
  if (plan.selectedFindingIds.length !== selected.length || selected.some(id => !plan.selectedFindingIds.includes(id))) reject('selection-mismatch', 'Plan selections must match the reviewed selected findings.')
  if (findings.findings.some(finding => finding.category === 'decision' && !finding.resolved)) reject('unresolved-decision', 'Resolve design decisions before reviewing edits.')
  const scope = new Map()
  const problems = []
  for (const entry of plan.reviewedScope) {
    try {
      const path = await resolveFilePath(target.root, entry.path, entry.resolvedPath, deletionScope.includes(entry))
      if (scope.has(entry.path)) reject('overlapping-scope', 'Reviewed scope paths must be unique.', entry.path)
      scope.set(entry.path, path)
    } catch (error) {
      if (!(error instanceof CommandError)) throw error
      problems.push(...error.problems)
    }
  }
  if (scope.size !== findings.reviewedScope.length || findings.reviewedScope.some(path => !scope.has(path))) problems.push({ code: 'scope-mismatch', message: 'Resolved scope must match reviewed findings scope.', fix: 'Review the complete scope again.' })
  const staged = []
  const destinations = new Set()
  for (const [index, edit] of plan.edits.entries()) {
    try {
      const finding = findings.findings.find(finding => finding.id === edit.findingId)
      if (!plan.selectedFindingIds.includes(edit.findingId)) reject('unselected-finding', 'Every edit requires a selected finding.', edit.path)
      if (!scope.has(edit.path) || !finding.scope.includes(edit.path)) reject('scope-mismatch', 'Edit is outside its reviewed finding scope.', edit.path)
      const path = scope.get(edit.path)
      if (destinations.has(path)) reject('overlapping-edits', 'Use one complete proposed edit per resolved file.', edit.path)
      destinations.add(path)
      const bytes = journal ? await journalOriginal(directory, journal, plan, edit, index) : await fileBytes(path)
      if ((bytes === null ? null : hashBytes(bytes)) !== edit.originalHash) reject('changed-precondition', 'Original file bytes no longer match review.', edit.path)
      let original = null
      try { original = bytes === null ? null : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) } catch { reject('unsupported-format', 'Mechanical edits require valid UTF-8.', edit.path) }
      if (original?.includes('\0')) reject('unsupported-format', 'Mechanical edits require text without NUL bytes.', edit.path)
      const proposed = proposedEdit(edit, original)
      if (proposed !== null && (proposed.includes('\0') || Buffer.from(proposed).toString('utf8') !== proposed)) reject('unsupported-format', 'Proposed text must encode as exact UTF-8 without NUL bytes.', edit.path)
      if (proposed !== edit.proposedContent || (proposed === null ? null : hashBytes(Buffer.from(proposed))) !== edit.proposedHash) reject('payload-mismatch', 'Complete proposed bytes or hash differ from the mechanical operation.', edit.path)
      staged.push({ id: edit.id, path: edit.path, originalHash: edit.originalHash, proposedHash: edit.proposedHash, proposedContent: proposed,
        originalBytes: bytes, resolvedPath: path, diff: exactDiff(edit.path, original, proposed) })
    } catch (error) {
      if (!(error instanceof CommandError)) throw error
      problems.push(...error.problems.map(problem => ({ ...problem, path: problem.path ?? edit.path })))
    }
  }
  if (problems.length) throw new CommandError('failed', problems)
  return { inputs: { target, plan: options.plan }, plan, staged, directory, journal, findings }
}

export async function run(options) {
  const target = await resolveTarget(options, { draftOnly: true })
  const { inputs, plan, staged, directory, journal, findings } = await prepareChangeSet(options, target)
  const { planDigest } = plan
  if (options['dry-run']) return { inputs, data: { planDigest, dryRun: true,
    edits: staged.map(({ originalBytes, resolvedPath, ...edit }) => edit), diff: staged.map(edit => edit.diff).join('') } }
  if (journal) {
    const state = await inspectJournal(journal)
    if (state.conflicting.length) return { inputs, status: 'blocked', problems: state.conflicting.map(path => ({ code: 'user-change', path,
      message: 'Target matches neither the original nor proposed bytes.', fix: 'Review the user change before continuing.' })), data: state }
  }
  const result = await applyWrites(target, plan, staged, directory, journal, findings.requiredOutcomes)
  return result.status ? { inputs, ...result } : { inputs, data: result }
}
