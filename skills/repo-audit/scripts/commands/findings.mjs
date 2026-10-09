import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { fingerprint, hashBytes } from '../lib/fingerprint.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { CommandError } from '../lib/result.mjs'
import schema from '../../schemas/findings.schema.json' with { type: 'json' }

// Audit assesses the starting state. Foundation additionally reviews selected setup.
const stageOutcomes = { audit: ['starting-checks'], foundation: ['journey', 'foundation-review'] }

function invalid(code, message, path) {
  throw new CommandError('failed', [{ code, message, path, fix: 'Regenerate findings for the reviewed target, scope and selections.' }])
}

function render(findings, assessment) {
  const lines = ['# Proposed repo audit record', '', `Result: ${assessment.result}`, '',
    `Stage: ${findings.stage}`, `Target: ${findings.target.root}`, `Revision: ${findings.target.revision ?? 'no commit'}`,
    `Stated next change: ${findings.nextChange}`, `Reviewed scope: ${findings.reviewedScope.join(', ')}`,
    `Current fingerprint: ${assessment.fingerprint}`, '', '## Readiness evidence', '']
  for (const reason of assessment.reasons) lines.push(`- ${reason}`)
  for (const record of findings.execution) lines.push(`- ${record.outcome}: ${record.status}. Method: ${record.method}. Artifact: ${record.artifact}. Fingerprint: ${record.fingerprint}.`)
  for (const [intent, title] of [['documented', 'Documented intent'], ['observed', 'Observed behaviour'], ['inferred', 'Inferred intent']]) {
    lines.push('', `## ${title}`, '')
    for (const source of findings.sources.filter(source => source.intent === intent)) lines.push(`- ${source.id}: ${source.summary} (${source.pointer})`)
  }
  for (const [category, title] of [['debt', 'Observed debt'], ['missing-protection', 'Missing protections'], ['decision', 'Design decisions']]) {
    lines.push('', `## ${title}`, '')
    for (const finding of findings.findings.filter(finding => finding.category === category)) {
      lines.push(`### ${finding.id}: ${finding.problem}`, '',
        `Status: ${finding.status}. Resolved: ${finding.resolved}. Blocks next change: ${finding.blocksNextChange}.`,
        `Files: ${finding.files.join(', ') || 'none'}. Command: ${finding.command ?? 'none'}.`,
        `Principle${finding.newPrinciple ? ' (proposed new principle)' : ''}: ${finding.principle}`,
        `Consequence: ${finding.consequence}`, `Fix: ${finding.fix}`, `Scope: ${finding.scope.join(', ')}`,
        `Verification: ${finding.verification}`, `Sources: ${finding.sourceIds.join(', ')}`, '')
    }
  }
  lines.push('', '## Proposed new principles', '', ...findings.findings.filter(finding => finding.newPrinciple).map(finding => `- ${finding.id}: ${finding.principle} (${finding.status})`),
    '', '## Selected findings', '', ...findings.selectedFindingIds.map(id => `- ${id}`), '', '## Limitations', '', ...findings.limitations.map(limit => `- ${limit}`))
  return `${lines.join('\n')}\n`
}

export async function validateFindings(findings, target, deletionScope = []) {
  validateData(schema, findings)
  for (const collection of ['sources', 'findings', 'execution']) validateIds(findings[collection], `$/` + collection)
  if (findings.target.root !== target.root || findings.target.mode !== target.mode) invalid('target-mismatch', 'Reviewed identity differs from the selected target.', '$/target')
  if (target.mode === 'workspace' && findings.target.revision !== null) invalid('target-mismatch', 'A draft workspace has no Git revision.', '$/target/revision')
  for (const path of findings.reviewedScope) {
    const deleted = deletionScope.find(entry => entry.path === path)
    await resolveFilePath(target.root, path, deleted?.resolvedPath, deleted !== undefined)
  }
  for (const finding of findings.findings) {
    if (!finding.files.length && finding.command === null) invalid('missing-location', 'A finding needs files or a failing command.', finding.id)
    for (const path of [...finding.scope, ...finding.files]) {
      if (!findings.reviewedScope.includes(path)) invalid('scope-mismatch', 'Finding paths must be inside the reviewed file scope.', finding.id)
    }
    for (const id of finding.sourceIds) {
      if (!findings.sources.some(source => source.id === id)) invalid('unknown-source', `Unknown source ID: ${id}`, finding.id)
    }
  }
  const selected = findings.findings.filter(finding => finding.status === 'selected').map(finding => finding.id)
  if (selected.length !== findings.selectedFindingIds.length || selected.some(id => !findings.selectedFindingIds.includes(id))) invalid('selection-mismatch', 'Selected IDs must match selected finding statuses.', '$/selectedFindingIds')
  for (const outcome of stageOutcomes[findings.stage]) {
    if (!findings.requiredOutcomes.includes(outcome)) invalid('missing-stage-outcome', `Stage requires outcome: ${outcome}`, '$/requiredOutcomes')
  }
  if (new Set(findings.execution.map(record => record.outcome)).size !== findings.execution.length) invalid('duplicate-outcome', 'Use one current record per outcome.', '$/execution')
}

export async function run(options, command) {
  if (!options.findings) throw new CommandError('usage-error', [{ code: 'missing-findings', message: '--findings is required.', fix: 'Supply --findings <file>.' }])
  const target = await resolveTarget(options, { draftOnly: true })
  let findings
  try { findings = inspectJSON(await readFile(options.findings, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    invalid('invalid-findings', 'Findings must be readable JSON.', options.findings)
  }
  await validateFindings(findings, target)
  const current = await fingerprint(target, { baseCommit: findings.target.revision, paths: findings.reviewedScope, inputs: findings })
  const reasons = []
  if (target.mode === 'repo') {
    const env = { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined }
    const head = spawnSync('git', ['-C', target.root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', env })
    if (head.error || (head.status !== 0 && findings.target.revision !== null) || (head.status === 0 && head.stdout.trim() !== findings.target.revision)) reasons.push('Reviewed Git revision is not current or cannot be resolved.')
  }
  for (const outcome of findings.requiredOutcomes) {
    if (!findings.execution.some(record => record.outcome === outcome)) reasons.push(`Missing required outcome: ${outcome}.`)
  }
  for (const record of findings.execution) {
    if (record.status !== 'passed') reasons.push(`Outcome ${record.outcome} is ${record.status}.`)
    if (record.fingerprint !== current.fingerprint) reasons.push(`Outcome ${record.outcome} has stale evidence.`)
    try {
      if (hashBytes(await readFile(resolve(record.artifact))) !== record.artifactHash) reasons.push(`Outcome ${record.outcome} artifact changed.`)
    } catch { reasons.push(`Outcome ${record.outcome} artifact is unavailable.`) }
  }
  const decisions = findings.findings.filter(finding => (!finding.resolved && (finding.category === 'decision' || finding.blocksNextChange)) || (finding.newPrinciple && finding.status === 'proposed'))
  const result = reasons.length ? 'verification blocked' : decisions.length ? 'decisions needed' : 'ready for the stated next change'
  reasons.push(...decisions.map(finding => `Unresolved finding: ${finding.id}.`))
  const assessment = { result, reasons, fingerprint: current.fingerprint }
  if (command === 'findings render') {
    const path = join(await createScratch(target), 'repo-audit.md')
    await writeFile(path, render(findings, assessment))
    assessment.path = path
  }
  return { inputs: { target, findings: options.findings }, data: assessment }
}
