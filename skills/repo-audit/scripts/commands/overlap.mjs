import { readFile } from 'node:fs/promises'
import { resolveTarget } from '../lib/repo.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { pathGlob, sharedPath } from '../lib/glob.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!options.plans) throw new CommandError('usage-error', [{ code: 'missing-plans', message: '--plans requires two files.', fix: 'Supply --plans <file> <file>.' }])
  const target = await resolveTarget(options)
  const schema = JSON.parse(await readFile(new URL('../../schemas/overlap-plan.json', import.meta.url), 'utf8'))
  const plans = []
  for (const file of options.plans) {
    let plan
    try { plan = JSON.parse(await readFile(file, 'utf8')) } catch {
      throw new CommandError('failed', [{ code: 'invalid-plan', path: file, message: 'Plan must be readable JSON.', fix: 'Supply a plan matching schemas/overlap-plan.json.' }])
    }
    validateData(schema, plan)
    validateIds(plan.contracts, '$/contracts')
    plans.push(plan)
  }
  validateIds(plans, '$/plans')
  const writes = plans.map(plan => plan.writePaths.map(pathGlob))
  const contracts = plans.map(plan => plan.contracts.map(contract => ({ ...contract, globs: contract.files.map(pathGlob) })))
  function compare(left, right) {
    const intersections = []
    for (const a of left) for (const b of right) {
      const path = sharedPath(a, b)
      if (path !== null) intersections.push({ left: a.pattern, right: b.pattern, examplePath: path })
    }
    return intersections
  }
  const sharedContracts = []
  for (const a of contracts[0]) for (const b of contracts[1]) {
    const files = compare(a.globs, b.globs)
    if (a.id === b.id || files.length) sharedContracts.push({ leftId: a.id, rightId: b.id, sameId: a.id === b.id, files })
  }
  return { inputs: { repo: target.root, plans: options.plans }, data: { planIds: plans.map(plan => plan.id),
    sharedPaths: compare(writes[0], writes[1]), sharedContracts,
    limitations: ['Declared path intersections and changing contracts are signals. Disjoint declarations do not prove semantic independence or predict merge conflicts.'] } }
}
