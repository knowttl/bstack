import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolvePath } from './paths.mjs'
import { hashBytes } from './fingerprint.mjs'
import { CommandError } from './result.mjs'

// A file citation is { location: "path:line", state: { kind: "sha256" | "revision", value } } and resolves only against the exact bytes it records.
export async function fileCitationProblems(root, citation) {
  const [, path, number] = citation.location.match(/^(.*):([1-9][0-9]*)$/u)
  const problems = []
  const problem = (code, message) => problems.push({ code, message, path: citation.location, fix: 'Reopen the cited source and regenerate its location and state.' })
  let bytes
  try { bytes = await readFile(await resolvePath(root, path)) } catch (error) {
    if (error instanceof CommandError) return error.problems
    problem('citation-file-unavailable', 'Cited path must be a readable file.')
    return problems
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
    const recorded = spawnSync('git', ['-C', root, 'rev-parse', `${value}:${path}`], { encoding: 'utf8', env })
    const current = spawnSync('git', ['-C', root, 'hash-object', '--stdin'], { input: bytes, encoding: 'utf8', env })
    if (recorded.error || current.error || recorded.status !== 0 || current.status !== 0) problem('citation-revision-unavailable', 'Cited revision or file object is unavailable.')
    else if (recorded.stdout.trim() !== current.stdout.trim()) problem('stale-citation', 'Current file bytes differ from the cited revision.')
  }
  return problems
}
