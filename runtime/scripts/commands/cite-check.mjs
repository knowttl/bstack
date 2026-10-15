import { readFile } from 'node:fs/promises'
import { resolveTarget } from '../lib/repo.mjs'
import { fileCitationProblems } from '../lib/citations.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!options.report) throw new CommandError('usage-error', [{ code: 'missing-report', message: '--report is required.', fix: 'Supply --report <research-report.json>.' }])
  const target = await resolveTarget(options, { draftOnly: true })
  let report
  try { report = JSON.parse(await readFile(options.report, 'utf8')) } catch {
    throw new CommandError('failed', [{ code: 'invalid-report', message: 'Report must be readable JSON.', path: options.report, fix: 'Supply a readable research report.' }])
  }
  const schema = JSON.parse(await readFile(new URL('../../schemas/research-report.json', import.meta.url), 'utf8'))
  validateData(schema, report)
  validateIds(report.briefs, '$/briefs')
  const problems = []
  let filesChecked = 0
  let webRecorded = 0
  for (const brief of report.briefs) {
    for (const citation of brief.files) {
      problems.push(...await fileCitationProblems(target.root, citation))
      filesChecked++
    }
    for (const citation of brief.web) {
      try {
        const url = new URL(citation.url)
        if (!['http:', 'https:'].includes(url.protocol) || new Date(citation.readDate).toISOString().slice(0, 10) !== citation.readDate) throw new Error('Invalid web citation')
      } catch {
        problems.push({ code: 'invalid-web-citation', message: 'Web citations require an HTTP(S) URL and a real YYYY-MM-DD read date.', path: brief.id, fix: 'Record the source URL and actual read date.' })
      }
      webRecorded++
    }
  }
  if (problems.length) throw new CommandError('failed', problems)
  return { inputs: { target, report: options.report }, data: { mode: report.mode, filesChecked, webRecorded, webVerifiedByChecker: false } }
}
