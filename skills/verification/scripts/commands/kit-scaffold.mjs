import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { canonicalJSON, hashBytes } from '../lib/fingerprint.mjs'
import { fileBytes } from '../lib/protected-write.mjs'
import { exactDiff, proposedEdit } from '../lib/proposed-edit.mjs'
import { CommandError } from '../lib/result.mjs'
import { agentsPointer, kitDirectory, kitFiles, pointerDocument, validateKitPlan } from '../lib/kit.mjs'

async function original(path) {
  const bytes = await fileBytes(path)
  return bytes === null ? null : bytes.toString('utf8')
}

export async function run(options) {
  if (!options.plan) throw new CommandError('usage-error', [{ code: 'missing-plan', message: '--plan is required.', fix: 'Supply a kit plan following schemas/kit-plan.json.' }])
  const target = await resolveTarget(options)
  let plan
  try { plan = inspectJSON(await readFile(options.plan, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('failed', [{ code: 'invalid-input', message: 'The kit plan must be readable JSON.', path: options.plan, fix: 'Supply a kit plan following schemas/kit-plan.json.' }])
  }
  validateKitPlan(plan)
  const kit = kitDirectory(plan.app)
  const pointerPath = `.claude/skills/verify-${plan.app}/SKILL.md`
  const proposals = [...kitFiles(plan), { path: pointerPath, content: pointerDocument(plan) }].map(file => ({
    path: file.path, operation: 'create', payload: { content: file.content } }))
  const pointer = agentsPointer(plan)
  const agents = await original(join(target.root, 'AGENTS.md'))
  proposals.push(agents === null
    ? { path: 'AGENTS.md', operation: 'create', payload: { content: `# Agent instructions\n\n${pointer}\n` } }
    : { path: 'AGENTS.md', operation: 'append-line-once', payload: { line: pointer } })
  const edits = []
  const reviewedScope = []
  for (const [index, proposal] of proposals.entries()) {
    const resolvedPath = await resolveFilePath(target.root, proposal.path)
    const before = await original(resolvedPath)
    if (proposal.operation === 'create' && before !== null) {
      throw new CommandError('blocked', [{ code: 'kit-exists', message: `${proposal.path} already exists.`, path: proposal.path,
        fix: proposal.path.startsWith(kit) ? 'Run maintain on the existing kit instead of creating another.' : 'Move the existing file aside or choose another app name.' }])
    }
    const proposedContent = proposedEdit(proposal, before)
    edits.push({ id: `E-${String(index + 1).padStart(3, '0')}`, findingId: 'F-001', path: proposal.path,
      originalHash: before === null ? null : hashBytes(Buffer.from(before)), proposedHash: hashBytes(Buffer.from(proposedContent)),
      operation: proposal.operation, payload: proposal.payload, proposedContent, diff: exactDiff(proposal.path, before, proposedContent) })
    reviewedScope.push({ path: proposal.path, resolvedPath })
  }
  const head = spawnSync('git', ['-C', target.root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined } })
  const revision = head.status === 0 ? head.stdout.trim() : null
  const findings = {
    schemaVersion: 1, stage: 'audit', target: { mode: 'repo', root: target.root, revision },
    nextChange: `Create the verify-${plan.app} verification kit`, reviewedScope: reviewedScope.map(entry => entry.path),
    sources: [{ id: 'kit-plan', pointer: `${kit}/kit.json:1`, intent: 'observed', summary: plan.description }],
    findings: [{
      id: 'F-001', problem: 'The project has no scripted way to launch and drive the real product and prove a change on it.',
      files: [`${kit}/kit.json`], command: null,
      principle: 'P2 Every project keeps one verification kit: a stable driver plus a feature map of how a user reaches each feature.',
      consequence: 'Agents cannot show that a change works for a user, so completion rests on unit tests and summaries.',
      fix: `Add the kit at ${kit}/, with thin pointers for Claude Code and AGENTS.md.`, scope: reviewedScope.map(entry => entry.path),
      verification: 'Prove the applied kit once with kit prove: launch, doctor, drive one feature, keep the evidence through cleanup.',
      blocksNextChange: false, category: 'missing-protection', status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['kit-plan']
    }],
    selectedFindingIds: ['F-001'], requiredOutcomes: ['starting-checks', 'kit-proof'], execution: [],
    limitations: ['The kit is a draft until kit prove has run it end to end.']
  }
  const changeSet = { schemaVersion: 1, target: findings.target, findings: 'findings.json', findingsDigest: hashBytes(canonicalJSON(findings)),
    selectedFindingIds: ['F-001'], reviewedScope, edits: edits.map(({ diff, ...edit }) => edit) }
  changeSet.planDigest = hashBytes(canonicalJSON(changeSet))
  const directory = await createScratch(target)
  await writeFile(join(directory, 'findings.json'), `${JSON.stringify(findings, null, 2)}\n`)
  const path = join(directory, 'change-set.json')
  await writeFile(path, `${JSON.stringify(changeSet, null, 2)}\n`)
  return { inputs: { target, plan: options.plan }, data: { path, planDigest: changeSet.planDigest, files: edits.map(edit => edit.path), diff: edits.map(edit => edit.diff).join('') } }
}
