import { resolveTarget } from '../lib/repo.mjs'
import { loadJournal, inspectJournal } from '../lib/protected-write.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!options.run) throw new CommandError('usage-error', [{ code: 'missing-run', message: '--run is required.', fix: 'Supply the run ID returned by apply.' }])
  const target = await resolveTarget(options, { draftOnly: true })
  const { journal } = await loadJournal(target, options.run)
  if (!journal) throw new CommandError('blocked', [{ code: 'missing-journal', message: 'No journal exists for this target and run.', fix: 'Use a run ID returned by apply for this target.' }])
  return { inputs: { target }, data: await inspectJournal(journal) }
}
