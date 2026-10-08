import { lstat, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path'
import { CommandError } from './result.mjs'

export function isInside(root, path) {
  const offset = relative(root, path)
  return offset === '' || (!isAbsolute(offset) && offset !== '..' && !offset.startsWith(`..${sep}`))
}

export async function resolvePath(root, input) {
  if (typeof input !== 'string' || !input || input.includes('\0') || isAbsolute(input) || win32.isAbsolute(input) || /^[A-Za-z]:/.test(input) || input.split(/[\\/]/).includes('..')) {
    throw new CommandError('usage-error', [{ code: 'unsafe-path', message: 'Paths must be relative and contain no parent traversal.', fix: 'Supply a path inside the selected target.', path: String(input) }])
  }
  const destination = resolve(root, input)
  let resolved
  try {
    resolved = await resolveLinks(destination)
  } catch {
    throw new CommandError('blocked', [{ code: 'unresolved-path', message: 'An existing path or link cannot be resolved.', fix: 'Repair the link or select a resolvable path.', path: input }])
  }
  if (!isInside(root, resolved)) {
    throw new CommandError('usage-error', [{ code: 'escaping-path', message: 'The path resolves outside the selected target.', fix: 'Remove the escaping link or select an internal path.', path: input }])
  }
  return resolved
}

export async function resolveLinks(destination) {
  let parent = destination
  const missing = []
  for (;;) {
    try {
      await lstat(parent)
      break
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      missing.unshift(relative(dirname(parent), parent))
      parent = dirname(parent)
    }
  }
  return join(await realpath(parent), ...missing)
}

export async function resolveFilePath(root, input) {
  const path = await resolvePath(root, input)
  if (/[*?\[\]{}]/.test(input)) {
    throw new CommandError('failed', [{ code: 'invalid-scope', message: 'Reviewed scope cannot contain globs.', fix: 'List concrete file paths, including planned absent files.', path: input }])
  }
  try {
    if ((await stat(path)).isFile()) return path
  } catch (error) {
    if (error.code === 'ENOENT') return path
    throw error
  }
  throw new CommandError('failed', [{ code: 'invalid-scope', message: 'Reviewed scope must identify a regular file or a planned absent file.', fix: 'List concrete file paths, including planned absent files.', path: input }])
}
