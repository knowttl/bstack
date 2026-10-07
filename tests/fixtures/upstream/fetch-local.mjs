import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A file-backed network boundary exercises pinned URLs without network access.
const root = dirname(fileURLToPath(import.meta.url))

globalThis.fetch = async url => {
  const parsed = new URL(url)
  if (parsed.origin !== 'https://raw.githubusercontent.com') throw new Error(`Unexpected origin: ${url}`)
  const parts = parsed.pathname.slice(1).split('/')
  if (parts[0] !== 'fixture' || parts[1] !== 'source' || parts[2] !== 'a'.repeat(40)) {
    throw new Error(`Unexpected repository or pin: ${url}`)
  }
  try {
    return new Response(await readFile(join(root, 'remote', ...parts.slice(3))))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return new Response('Not Found', { status: 404 })
  }
}
