import { readdir, readFile, writeFile } from 'node:fs/promises'
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
import { agentsPointer, kitDirectory, managedFiles, readKitPlan, validateKitPlan } from '../lib/kit.mjs'

async function original(path) {
  const bytes = await fileBytes(path)
  return bytes === null ? null : bytes.toString('utf8')
}

function createFinding(plan, kit, scope) {
  return {
    id: 'F-001', problem: 'The project has no scripted way to launch and drive the real product and prove a change on it.',
    files: [`${kit}/kit.json`], command: null,
    principle: 'P2 Every project keeps one verification kit: a stable driver plus a feature map of how a user reaches each feature.',
    consequence: 'Agents cannot show that a change works for a user, so completion rests on unit tests and summaries.',
    fix: `Add the kit at ${kit}/, with thin pointers for Claude Code and AGENTS.md.`, scope,
    verification: 'Prove the applied kit once with kit prove: launch, doctor, drive one feature, keep the evidence through cleanup.',
    blocksNextChange: false, category: 'missing-protection', status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['kit-plan']
  }
}

function updateFinding(plan, kit, scope) {
  return {
    id: 'F-001', problem: `The verify-${plan.app} kit files disagree with kit.json or lack files the plan requires.`,
    files: [scope[0]], command: null,
    principle: 'P2 Every project keeps one verification kit: a stable driver plus a feature map of how a user reaches each feature.',
    consequence: 'Agents following the kit would drive the product from stale or hand-edited instructions and miss features.',
    fix: `Regenerate the differing kit files at ${kit}/ from the reviewed plan.`, scope,
    verification: 'Run kit check to confirm no drift remains, then kit prove for every changed feature.',
    blocksNextChange: false, category: 'debt', status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['kit-plan']
  }
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
  const update = options.update === true
  const kit = kitDirectory(plan.app)
  const previous = update && await original(await resolveFilePath(target.root, `${kit}/kit.json`)) !== null ? await readKitPlan(target.root, plan.app) : null
  const edits = []
  const reviewedScope = []
  async function stage(path, operation, payload) {
    const resolvedPath = await resolveFilePath(target.root, path)
    const before = await original(resolvedPath)
    if (operation === 'create' && before !== null && !update) {
      throw new CommandError('blocked', [{ code: 'kit-exists', message: `${path} already exists.`, path,
        fix: path.startsWith(kit) ? 'Run maintain on the existing kit instead of creating another, or pass --update to correct it.' : 'Move the existing file aside or choose another app name.' }])
    }
    const proposedContent = proposedEdit({ path, operation, payload }, before)
    if (update && proposedContent === before) return
    edits.push({ id: `E-${String(edits.length + 1).padStart(3, '0')}`, findingId: 'F-001', path,
      originalHash: before === null ? null : hashBytes(Buffer.from(before)), proposedHash: proposedContent === null ? null : hashBytes(Buffer.from(proposedContent)),
      operation, payload, proposedContent, diff: exactDiff(path, before, proposedContent) })
    reviewedScope.push({ path, resolvedPath })
  }
  const managed = managedFiles(plan)
  for (const file of managed) {
    const exists = await original(await resolveFilePath(target.root, file.path)) !== null
    await stage(file.path, update && exists ? 'replace-file' : 'create', { content: file.content })
  }
  const pointer = agentsPointer(plan)
  const agents = await original(join(target.root, 'AGENTS.md'))
  if (agents === null) await stage('AGENTS.md', 'create', { content: `# Agent instructions\n\n${pointer}\n` })
  else await stage('AGENTS.md', 'append-line-once', { line: pointer })
  if (update) {
    const known = new Set(managed.map(file => file.path))
    const present = await readdir(join(target.root, kit, 'features')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
    const obsolete = new Set([...(previous ? managedFiles(previous).map(file => file.path) : []), ...present.map(name => `${kit}/features/${name}`)])
    for (const path of [...obsolete].sort()) if (!known.has(path) && await original(await resolveFilePath(target.root, path)) !== null) await stage(path, 'delete', {})
  }
  if (!edits.length) return { inputs: { target, plan: options.plan }, data: { path: null, planDigest: null, files: [], diff: '' } }
  const head = spawnSync('git', ['-C', target.root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined } })
  const revision = head.status === 0 ? head.stdout.trim() : null
  const scope = reviewedScope.map(entry => entry.path)
  const findings = {
    schemaVersion: 1, stage: 'audit', target: { mode: 'repo', root: target.root, revision },
    nextChange: `${update ? 'Correct' : 'Create'} the verify-${plan.app} verification kit`, reviewedScope: scope,
    sources: [{ id: 'kit-plan', pointer: `${kit}/kit.json:1`, intent: 'observed', summary: plan.description }],
    findings: [(update ? updateFinding : createFinding)(plan, kit, scope)],
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
