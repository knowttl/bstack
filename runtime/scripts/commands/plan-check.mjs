import { readFile } from 'node:fs/promises'
import { resolveTarget } from '../lib/repo.mjs'
import { fileCitationProblems } from '../lib/citations.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!options.plan) throw new CommandError('usage-error', [{ code: 'missing-plan', message: '--plan is required.', fix: 'Supply --plan <plan.json>.' }])
  const target = await resolveTarget(options, { draftOnly: true })
  let plan
  try { plan = JSON.parse(await readFile(options.plan, 'utf8')) } catch {
    throw new CommandError('failed', [{ code: 'invalid-plan', message: 'Plan must be readable JSON.', path: options.plan, fix: 'Supply a readable plan record.' }])
  }
  validateData(JSON.parse(await readFile(new URL('../../schemas/plan.json', import.meta.url), 'utf8')), plan)
  validateIds(plan.units, '$/units')
  const units = new Map(plan.units.map(unit => [unit.id, unit]))
  const problems = []
  let citationsChecked = 0
  for (const [index, unit] of plan.units.entries()) {
    const at = `$/units/${index}`
    if (!unit.evidence.length) problems.push({ code: 'unit-no-evidence', message: `Unit ${unit.id} names no check or kit feature that proves it.`, path: `${at}/evidence`, fix: 'Name the check or kit feature that proves the unit, or merge the unit into one that has evidence.' })
    for (const dependency of unit.dependsOn.filter(id => !units.has(id))) {
      problems.push({ code: 'unknown-dependency', message: `Unit ${unit.id} depends on ${dependency}, which is not a unit.`, path: `${at}/dependsOn`, fix: 'Depend only on units in this plan.' })
    }
    for (const citation of unit.design) {
      problems.push(...(await fileCitationProblems(target.root, citation)).map(problem => ({ ...problem, path: `${at}/design: ${problem.path}` })))
      citationsChecked++
    }
  }
  // Dependencies come before dependents, so the order doubles as a build sequence for the reviewer.
  const order = []
  const state = new Map()
  const visit = (id, ancestors) => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'active') {
      problems.push({ code: 'dependency-cycle', message: `Dependency cycle: ${[...ancestors.slice(ancestors.indexOf(id)), id].join(' -> ')}`, path: '$/units', fix: 'Remove a dependency or split a unit so the order of work is acyclic.' })
      return
    }
    state.set(id, 'active')
    for (const dependency of units.get(id).dependsOn.filter(dependency => units.has(dependency))) visit(dependency, [...ancestors, id])
    state.set(id, 'done')
    order.push(id)
  }
  for (const id of units.keys()) visit(id, [])
  if (problems.length) throw new CommandError('failed', problems)
  return { inputs: { target, plan: options.plan }, data: { units: order.length, citationsChecked, order } }
}
