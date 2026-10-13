import { mkdir, realpath } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { isInside, resolveLinks } from './paths.mjs'
import { CommandError } from './result.mjs'

export async function scratchDirectory(target, runId) {
  if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new CommandError('usage-error', [{ code: 'invalid-run', message: 'Run ID must contain only letters, digits and hyphens.', fix: 'Use the run ID returned by the command.' }])
  const cache = process.platform === 'win32' ? process.env.LOCALAPPDATA
    : process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches')
      : process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
  if (!cache || !isAbsolute(cache)) {
    throw new CommandError('blocked', [{ code: 'cache-unavailable', message: 'The OS cache directory must be absolute.', fix: 'Configure an absolute OS cache directory.' }])
  }
  const base = await resolveLinks(join(cache, 'bstack'))
  if (isInside(target.root, base)) {
    throw new CommandError('blocked', [{ code: 'scratch-inside-target', message: 'Scratch would be written inside the target.', fix: 'Select an OS cache directory outside the target.', path: base }])
  }
  // Real target identity survives aliases; the caller selects the run identity.
  const key = createHash('sha256').update(target.root).digest('hex')
  const directory = await resolveLinks(join(base, key, runId))
  if (isInside(target.root, directory)) {
    throw new CommandError('blocked', [{ code: 'scratch-inside-target', message: 'Scratch links resolve inside the target.', fix: 'Repair the cache link or select a different cache directory.', path: directory }])
  }
  return directory
}

export async function createScratch(target) {
  const directory = await scratchDirectory(target, randomUUID())
  await mkdir(directory, { recursive: true })
  return await realpath(directory)
}
