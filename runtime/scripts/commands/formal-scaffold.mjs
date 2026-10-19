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
import { agentsPointer, managedFiles, readFormalPlan, stepProblems, suiteDirectory, validateFormalPlan } from '../lib/formal-suite.mjs'

async function original(path) {
  const bytes = await fileBytes(path)
  return bytes === null ? null : bytes.toString('utf8')
}

function finding(plan, suite, scope, update) {
  return update ? {
    id: 'F-001', problem: `The formal-${plan.target} suite files disagree with suite.json or lack files the plan requires.`,
    files: [scope[0]], command: null,
    principle: 'A formal suite is rendered from one reviewed plan, so its model, properties and transition table cannot drift apart unseen.',
    consequence: 'Agents following the suite would trust a model or table that no longer matches the code it claims to check.',
    fix: `Regenerate the differing suite files at ${suite}/ from the reviewed plan.`, scope,
    verification: 'Run formal check to confirm no drift remains, then rerun every changed property check and prove it can still fail.',
    blocksNextChange: false, category: 'debt', status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['suite-plan']
  } : {
    id: 'F-001', problem: 'The spot has no machine-checked proof that its stated property holds however the steps interleave.',
    files: [`${suite}/suite.json`], command: null,
    principle: 'A model check is a Detect-rung check: it finds the interleavings and inputs that tests sample only by luck.',
    consequence: 'A mistake that depends on timing or a rare input reaches users, because tests and review rarely hit the one failing order.',
    fix: `Add the suite at ${suite}/, with a thin pointer for Claude Code and an AGENTS.md pointer.`, scope,
    verification: 'Run the property check on the current code, then prove it can fail with rule-proof and a scratch break in the real code.',
    blocksNextChange: false, category: 'missing-protection', status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['suite-plan']
  }
}

export async function run(options) {
  if (!options.plan) throw new CommandError('usage-error', [{ code: 'missing-plan', message: '--plan is required.', fix: 'Supply a suite plan following schemas/formal-plan.json.' }])
  const target = await resolveTarget(options)
  let plan
  try { plan = inspectJSON(await readFile(options.plan, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('failed', [{ code: 'invalid-input', message: 'The suite plan must be readable JSON.', path: options.plan, fix: 'Supply a suite plan following schemas/formal-plan.json.' }])
  }
  validateFormalPlan(plan)
  const problems = await stepProblems(target.root, plan)
  if (problems.length) throw new CommandError('failed', problems)
  const update = options.update === true
  const suite = suiteDirectory(plan.target)
  const previous = update && await original(await resolveFilePath(target.root, `${suite}/suite.json`)) !== null ? await readFormalPlan(target.root, plan.target) : null
  const edits = []
  const reviewedScope = []
  async function stage(path, operation, payload) {
    const resolvedPath = await resolveFilePath(target.root, path)
    const before = await original(resolvedPath)
    if (operation === 'create' && before !== null && !update) {
      throw new CommandError('blocked', [{ code: 'suite-exists', message: `${path} already exists.`, path,
        fix: path.startsWith(suite) ? 'Run maintain on the existing suite instead of creating another, or pass --update to correct it.' : 'Move the existing file aside or choose another target name.' }])
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
    const present = await Promise.all(['properties', 'model'].map(folder => readdir(join(target.root, suite, folder))
      .then(names => names.map(name => `${suite}/${folder}/${name}`), error => error.code === 'ENOENT' ? [] : Promise.reject(error))))
    const obsolete = new Set([...(previous ? managedFiles(previous).map(file => file.path) : []), ...present.flat()])
    for (const path of [...obsolete].sort()) if (!known.has(path) && await original(await resolveFilePath(target.root, path)) !== null) await stage(path, 'delete', {})
  }
  if (!edits.length) return { inputs: { target, plan: options.plan }, data: { path: null, planDigest: null, files: [], diff: '' } }
  const head = spawnSync('git', ['-C', target.root, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined } })
  const revision = head.status === 0 ? head.stdout.trim() : null
  const scope = reviewedScope.map(entry => entry.path)
  const findings = {
    schemaVersion: 1, stage: 'audit', target: { mode: 'repo', root: target.root, revision },
    nextChange: `${update ? 'Correct' : 'Create'} the formal-${plan.target} formal verification suite`, reviewedScope: scope,
    sources: [{ id: 'suite-plan', pointer: `${suite}/suite.json:1`, intent: 'observed', summary: plan.description }],
    findings: [finding(plan, suite, scope, update)],
    selectedFindingIds: ['F-001'], requiredOutcomes: ['starting-checks', 'rule-proof'], execution: [],
    limitations: ['The suite is a draft until its property check has run on the current code and rule-proof has shown it can fail.']
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
