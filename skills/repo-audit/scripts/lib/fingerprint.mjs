import { createHash } from 'node:crypto'
import { readFile, stat, realpath } from 'node:fs/promises'
import { resolvePath } from './paths.mjs'

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
  const root = await realpath(target.root)
  const files = []
  for (const path of [...new Set(paths)].sort()) {
    const resolved = await resolvePath(root, path)
    try {
      const info = await stat(resolved)
      files.push({ path, present: true, mode: info.mode,
        contentHash: path === evidencePath ? null : hashBytes(await readFile(resolved)) })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      files.push({ path, present: false, mode: null, contentHash: null })
    }
  }
  // Only the explicitly named derived fields are omitted, never arbitrary nested data.
  const { fingerprint: derivedFingerprint, execution, ...substantive } = inputs
  const state = { root, baseCommit, files, inputs: substantive }
  return { fingerprint: hashBytes(canonicalJSON(state)), state }
}
