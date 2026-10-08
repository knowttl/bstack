import { readFile, realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveTarget } from './repo.mjs'
import { isInside } from './paths.mjs'
import { hashBytes } from './fingerprint.mjs'
import { validateData, validateIds } from './schema.mjs'
import { CommandError } from './result.mjs'

export async function readBoard(options) {
  if (!options.board) throw new CommandError('usage-error', [{ code: 'missing-input', message: '--board is required.', fix: 'Supply the scratch board path returned by build.' }])
  const target = await resolveTarget(options, { draftOnly: true })
  const board = await realpath(options.board)
  const scratch = dirname(board)
  if (isInside(target.root, scratch)) throw new CommandError('failed', [{ code: 'board-inside-target', message: 'The board must remain outside the target.', fix: 'Use the scratch board returned by build.' }])
  const manifest = JSON.parse(await readFile(join(scratch, 'board.json'), 'utf8'))
  const draft = await readFile(join(scratch, 'draft.md'))
  const proposals = JSON.parse(await readFile(join(scratch, 'proposals.json'), 'utf8'))
  const schema = JSON.parse(await readFile(new URL('../../schemas/vision-proposals.json', import.meta.url), 'utf8'))
  validateData(schema, proposals)
  validateIds(proposals.cards, '$/cards')
  if (manifest.schemaVersion !== 1 || typeof manifest.runId !== 'string' || !manifest.runId ||
      manifest.target?.root !== target.root || manifest.target?.mode !== target.mode ||
      manifest.draftRevision !== hashBytes(draft) || proposals.draftRevision !== manifest.draftRevision ||
      JSON.stringify(manifest.cardIds) !== JSON.stringify(proposals.cards.map(card => card.id))) {
    throw new CommandError('failed', [{ code: 'incompatible-board', message: 'Board metadata, target or draft no longer match.', fix: 'Resume the original unchanged scratch run or build a reviewed new round.' }])
  }
  return { target, board, scratch, manifest }
}
