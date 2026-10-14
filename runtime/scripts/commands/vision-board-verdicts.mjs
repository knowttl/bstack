import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { readBoard } from '../lib/vision-board.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { hashBytes } from '../lib/fingerprint.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!options.input || !options.draft) throw new CommandError('usage-error', [{ code: 'missing-input', message: '--input and --draft are required.', fix: 'Supply complete-round context JSON and the agent-revised UTF-8 draft.' }])
  const context = await readBoard(options)
  let input, draft
  try {
    input = JSON.parse(await readFile(options.input, 'utf8'))
    draft = await readFile(options.draft)
  } catch {
    throw new CommandError('failed', [{ code: 'invalid-input', message: 'Verdicts or revised draft cannot be read, or verdicts are not JSON.', fix: 'Supply readable files in the documented format.' }])
  }
  const schema = JSON.parse(await readFile(new URL('../../schemas/vision-verdicts.json', import.meta.url), 'utf8'))
  validateData(schema, input)
  validateIds(input.verdicts, '$/verdicts')
  if (input.runId !== context.manifest.runId || input.draftRevision !== context.manifest.draftRevision) {
    throw new CommandError('failed', [{ code: 'stale-verdicts', message: 'Verdicts belong to a different run or draft revision.', fix: 'Use the complete-round context from this board review.' }])
  }
  if (input.verdicts.length !== context.manifest.cardIds.length || input.verdicts.some(item => !context.manifest.cardIds.includes(item.id))) {
    throw new CommandError('failed', [{ code: 'card-mismatch', message: 'Verdicts must cover every known card exactly once.', fix: 'Return the complete round, preserving all original card IDs.' }])
  }
  if (!draft.toString('utf8').trim() || !Buffer.from(draft.toString('utf8')).equals(draft)) {
    throw new CommandError('failed', [{ code: 'invalid-draft', message: 'The revised draft must be nonempty UTF-8 Markdown.', fix: 'Supply the semantic revision derived from author reasoning.' }])
  }
  const scratch = await createScratch(context.target)
  const draftPath = join(scratch, 'draft.md')
  const revision = { ...input, previousBoard: context.board, previousDraft: join(context.scratch, 'draft.md'), draftRevision: hashBytes(draft), reviewedDraftRevision: input.draftRevision }
  await writeFile(draftPath, draft)
  await writeFile(join(scratch, 'review.json'), JSON.stringify(revision, null, 2) + '\n')
  return { inputs: { target: context.target, runId: input.runId, draftRevision: input.draftRevision },
    data: { scratch, draft: draftPath, draftRevision: revision.draftRevision, previousDraft: revision.previousDraft, review: join(scratch, 'review.json'), approval: 'pending-author-review' } }
}
