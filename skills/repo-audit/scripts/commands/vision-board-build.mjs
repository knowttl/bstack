import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { CommandError } from '../lib/result.mjs'

function html(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function scriptJSON(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

export async function run(options) {
  if (!options.draft || !options.proposals) {
    throw new CommandError('usage-error', [{ code: 'missing-input', message: '--draft and --proposals are required.', fix: 'Supply a UTF-8 Markdown draft and a matching proposals JSON file.' }])
  }
  const target = await resolveTarget(options, { draftOnly: true })
  let draft, proposals
  try {
    draft = await readFile(options.draft)
    proposals = JSON.parse(await readFile(options.proposals, 'utf8'))
  } catch {
    throw new CommandError('failed', [{ code: 'invalid-input', message: 'Draft or proposals cannot be read, or proposals are not JSON.', fix: 'Supply readable draft and proposals files.' }])
  }
  const schema = JSON.parse(await readFile(new URL('../../schemas/vision-proposals.json', import.meta.url), 'utf8'))
  validateData(schema, proposals)
  validateIds(proposals.cards, '$/cards')
  const draftRevision = createHash('sha256').update(draft).digest('hex')
  if (proposals.draftRevision !== draftRevision) {
    throw new CommandError('failed', [{ code: 'stale-draft', message: 'Proposals do not match the exact draft bytes.', fix: 'Review proposals against the current draft and update draftRevision to its SHA-256.' }])
  }
  if (!draft.toString('utf8').trim() || !Buffer.from(draft.toString('utf8')).equals(draft)) {
    throw new CommandError('failed', [{ code: 'invalid-draft', message: 'Draft must be nonempty UTF-8 Markdown.', fix: 'Supply a nonempty UTF-8 draft.' }])
  }
  const review = { schemaVersion: 1, runId: randomUUID(), draftRevision }
  const template = await readFile(new URL('../../assets/vision/review-template.html', import.meta.url), 'utf8')
  const slots = { PROJECT: html(proposals.project), RUN_NOTE: html(proposals.runNote), DRAFT_MARKDOWN: scriptJSON(draft.toString('utf8')), REVIEW: scriptJSON(review) }
  // Replace once so literal slot names in project text never become template instructions.
  const board = template.replace(/const CARDS = \[[\s\S]*?\];|\{\{(PROJECT|RUN_NOTE|DRAFT_MARKDOWN|REVIEW)\}\}/g,
    (match, slot) => slot ? slots[slot] : `const CARDS = ${scriptJSON(proposals.cards)};`)
  const scratch = await createScratch(target)
  const boardPath = join(scratch, 'board.html')
  await writeFile(join(scratch, 'draft.md'), draft)
  await writeFile(join(scratch, 'proposals.json'), JSON.stringify(proposals, null, 2) + '\n')
  await writeFile(join(scratch, 'board.json'), JSON.stringify({ ...review, target, cardIds: proposals.cards.map(card => card.id) }, null, 2) + '\n')
  await copyFile(new URL('../../assets/vision/review.css', import.meta.url), join(scratch, 'review.css'))
  await writeFile(boardPath, board)
  return { inputs: { target, draftRevision }, data: { scratch, board: boardPath, ...review, cardIds: proposals.cards.map(card => card.id) } }
}
