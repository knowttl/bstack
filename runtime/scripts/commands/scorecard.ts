import { resolveTarget } from '../lib/repo.ts'
import { ledgerPath, loadConstraints, rungs } from '../lib/constraints.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn } from '../lib/result.ts'

const principles = {
  'conventional-structure': 'Conventional structure and co-location',
  'hard-boundaries': 'Hard boundaries enforced by dependency graphs',
  'illegal-states': 'Types and structure that make illegal states unrepresentable',
  'footgun-bans': 'Lint rules and CI that ban footguns',
  'early-rejection': 'Early helpful rejection'
}

export async function run(options: Options<'contract'>) {
  const target = await resolveTarget(options)
  const loaded = await loadConstraints(target.root, options.contract)
  const constraints = (loaded?.entries ?? []).flatMap(entry => entry.constraint ?? [])
  return { inputs: { repo: target.root }, data: {
    ledger: loaded ? ledgerPath : null,
    principles: Object.entries(principles).map(([principle, title]) => {
      const held = constraints.filter(constraint => constraint.principle === principle)
      const rung = rungs.find(rung => held.some(constraint => constraint.rung === rung)) ?? null
      return { principle, title, rung, proven: held.some(constraint => constraint.rung === rung && constraint.check && loaded!.checkIds?.includes(constraint.check.id)) }
    }),
    limitations: !loaded ? [`No constraint ledger at ${ledgerPath}, so no rung is recorded.`]
      : !loaded.checkIds ? [`No check configuration at ${loaded.contractFile}, so no rung is proven.`] : []
  } } satisfies CommandReturn
}
