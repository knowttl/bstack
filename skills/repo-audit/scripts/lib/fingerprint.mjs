import { createHash } from 'node:crypto'
import { readFile, stat, realpath, lstat, readlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { resolvePath, resolveLinks } from './paths.mjs'
import { readGit, repoFiles } from './discovery.mjs'

export function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function fingerprint(target, { baseCommit, paths, inputs, evidencePath }) {
  const portable = inputs.repo === '.'
  const root = await realpath(target.root)
  const evidenceFile = evidencePath ? await resolveLinks(resolve(root, evidencePath), true) : null
  const gitlinks = new Map(readGit(root, ['ls-files', '--stage', '-z']).stdout.split('\0')
    .filter(entry => entry.startsWith('160000 ')).map(entry => [entry.slice(entry.indexOf('\t') + 1), entry.split(' ')[1]]))
  const files = []
  for (const path of [...new Set(paths)].sort()) {
    const resolved = await resolvePath(root, path, undefined, true)
    let linkTarget = null
    try {
      if ((await lstat(resolve(root, path))).isSymbolicLink()) linkTarget = await readlink(resolve(root, path))
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
    }
    try {
      const info = await stat(resolved)
      let contentHash = null
      if (info.isFile() && resolved !== evidenceFile) contentHash = hashBytes(await readFile(resolved))
      else if (info.isDirectory() && gitlinks.has(path)) {
        const head = readGit(resolved, ['rev-parse', '--show-toplevel'])
        const initialized = head.status === 0 && await realpath(head.stdout.trim()) === resolved
        const contents = initialized ? await fingerprint({ root: resolved }, { baseCommit: readGit(resolved, ['rev-parse', 'HEAD']).stdout.trim(),
          paths: [...await repoFiles(resolved), ...readGit(resolved, ['ls-files', '-z']).stdout.split('\0').filter(Boolean)], inputs: portable ? { repo: '.' } : {}, evidencePath: evidenceFile }) : null
        contentHash = hashBytes(canonicalJSON({ gitlink: gitlinks.get(path), contents: contents?.fingerprint ?? null }))
      }
      files.push({ path, present: true, mode: info.mode, linkTarget,
        contentHash })
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
      files.push({ path, present: false, mode: null, linkTarget, contentHash: null })
    }
  }
  // Only the explicitly named derived fields are omitted, never arbitrary nested data.
  const { fingerprint: derivedFingerprint, execution, ...substantive } = inputs
  if (portable && substantive.foundation) substantive.foundation = { ...substantive.foundation,
    record: { ...substantive.foundation.record, target: { ...substantive.foundation.record.target, root: '.' } } }
  const state = { root: portable ? '.' : root, baseCommit,
    files: portable ? files.map(file => ({ ...file, mode: file.mode === null ? null : file.mode & 0o111 })) : files,
    inputs: substantive }
  return { fingerprint: hashBytes(canonicalJSON(state)), state }
}
