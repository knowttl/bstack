import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { resolvePath } from '../lib/paths.mjs'
import { hashBytes } from '../lib/fingerprint.mjs'
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
      const [, path, number] = citation.location.match(/^(.*):([1-9][0-9]*)$/u)
      const problem = (code, message) => problems.push({ code, message, path: citation.location, fix: 'Reopen the cited source and regenerate its location and state.' })
      let bytes
      try { bytes = await readFile(await resolvePath(target.root, path)) } catch (error) {
        if (error instanceof CommandError) problems.push(...error.problems)
        else problem('citation-file-unavailable', 'Cited path must be a readable file.')
        continue
      }
      const text = bytes.toString('utf8')
      const lines = text ? text.split(/\r\n|\r|\n/u).length - (/[\r\n]$/u.test(text) ? 1 : 0) : 0
      if (!Number.isSafeInteger(Number(number)) || Number(number) > lines) problem('citation-line-out-of-range', `Cited line ${number} exceeds ${lines} file lines.`)
      const { kind, value } = citation.state
      if (value.length !== (kind === 'sha256' ? 64 : 40)) {
        problem('invalid-citation-state', `Wrong digest length for ${kind}.`)
      } else if (kind === 'sha256') {
        if (hashBytes(bytes) !== value) problem('stale-citation', 'Cited exact file bytes have changed.')
      } else {
        const env = { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined }
        const recorded = spawnSync('git', ['-C', target.root, 'rev-parse', `${value}:${path}`], { encoding: 'utf8', env })
        const current = spawnSync('git', ['-C', target.root, 'hash-object', '--stdin'], { input: bytes, encoding: 'utf8', env })
        if (recorded.error || current.error || recorded.status !== 0 || current.status !== 0) problem('citation-revision-unavailable', 'Cited revision or file object is unavailable.')
        else if (recorded.stdout.trim() !== current.stdout.trim()) problem('stale-citation', 'Current file bytes differ from the cited revision.')
      }
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
