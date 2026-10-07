import { mkdir, realpath } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { isInside, resolveLinks } from './paths.mjs'
import { CommandError } from './result.mjs'

export async function createScratch(target) {
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
  // Real target identity survives aliases, while each invocation keeps its own run.
  const key = createHash('sha256').update(target.root).digest('hex')
  const directory = await resolveLinks(join(base, key, randomUUID()))
  if (isInside(target.root, directory)) {
    throw new CommandError('blocked', [{ code: 'scratch-inside-target', message: 'Scratch links resolve inside the target.', fix: 'Repair the cache link or select a different cache directory.', path: directory }])
  }
  await mkdir(directory, { recursive: true })
  return await realpath(directory)
}
