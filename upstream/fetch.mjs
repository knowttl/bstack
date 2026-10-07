import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Copies and their manifest live beside this command, independent of the caller.
const root = dirname(fileURLToPath(import.meta.url))

try {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node upstream/fetch.mjs [--check]')
  }
  const check = args[0] === '--check'
  const sources = JSON.parse(await readFile(join(root, 'sources.json'), 'utf8'))
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('No upstream sources listed')
  const names = new Set()
  const copies = []
  for (const source of sources) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.name) || names.has(source.name)
      || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(source.repoUrl)
      || !/^[0-9a-f]{40}$/.test(source.commit)
      || !Array.isArray(source.files) || source.files.length === 0) {
      throw new Error('Invalid upstream source: require a unique name, GitHub repo URL, full commit and files')
    }
    names.add(source.name)
    const files = new Set()
    for (const file of source.files) {
      if (typeof file !== 'string' || file.split('/').some(part => !/^[\w.-]+$/.test(part) || part === '.' || part === '..')
        || files.has(file)) throw new Error(`Invalid or duplicate file in ${source.name}: ${file}`)
      files.add(file)
      copies.push({ source, file, path: join(root, source.name, ...file.split('/')) })
    }
  }
  // Fetch all inputs before writing, so a missing pinned file cannot leave a partial download.
  for (const copy of copies) {
    const { source, file, path } = copy
    const url = `https://raw.githubusercontent.com/${source.repoUrl.slice('https://github.com/'.length)}/${source.commit}/${file}`
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`${source.name}: ${file} absent or unavailable at ${source.commit} (HTTP ${response.status})`)
    copy.bytes = Buffer.from(await response.arrayBuffer())
    if (check) {
      let local
      try {
        local = await readFile(path)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        throw new Error(`${source.name}: missing local copy of ${file}. Run node upstream/fetch.mjs`)
      }
      if (!local.equals(copy.bytes)) throw new Error(`${source.name}: ${file} differs from ${source.commit}. Run node upstream/fetch.mjs`)
      console.log(`Present at ${source.commit}, local bytes match: ${source.name}/${file}`)
    }
  }
  if (!check) {
    for (const { path, bytes, source, file } of copies) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
      console.log(`Copied at ${source.commit}: ${source.name}/${file}`)
    }
  }
  console.log(`${check ? 'Checked' : 'Fetched'} ${copies.length} files from ${sources.length} pinned sources`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
