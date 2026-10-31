import { after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readdir, readFile, readlink, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Seeds live only in this worker and are never handed to a test for mutation.
const seeds = new Map()
// Authored inputs are immutable for a worker; only disposable clones may be edited.
const inputHashes = new Map()
// Register at module scope so cleanup follows the whole file, not the first test using a seed.
const seedDirectories = []
after(() => Promise.all(seedDirectories.map(directory => rm(directory, { recursive: true, force: true }))))

export function cloneRepository(source, destination, env = process.env) {
  for (const args of [
    ['clone', '--quiet', '--local', '--no-hardlinks', source, destination],
    ['-C', destination, 'remote', 'remove', 'origin']
  ]) {
    const result = spawnSync('git', args, { encoding: 'utf8', env })
    assert.equal(result.status, 0, result.stderr)
  }
}

async function hashInputs(inputs) {
  const hash = createHash('sha256')
  async function collect(path, name) {
    const info = await lstat(path)
    hash.update(JSON.stringify(name))
    if (info.isSymbolicLink()) hash.update(JSON.stringify(['link', await readlink(path)]))
    else if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) {
        if (entry !== 'node_modules') await collect(join(path, entry), join(name, entry))
      }
    } else hash.update(JSON.stringify(['file', info.mode, (await readFile(path)).toString('base64')]))
  }
  for (const path of inputs) await collect(path, path)
  return hash.digest('hex')
}

export async function cloneSeed(t, inputs, variant, prepare, clone) {
  const inputKey = JSON.stringify(inputs)
  if (!inputHashes.has(inputKey)) inputHashes.set(inputKey, hashInputs(inputs))
  const key = createHash('sha256').update(await inputHashes.get(inputKey)).update(JSON.stringify(variant)).digest('hex')
  if (!seeds.has(key)) seeds.set(key, (async () => {
    const seed = await mkdtemp(join(tmpdir(), 'bstack seed '))
    seedDirectories.push(seed)
    await prepare(seed)
    return seed
  })())
  const seed = await seeds.get(key)
  const directory = await mkdtemp(join(tmpdir(), 'bstack fixture ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await clone(seed, directory)
  return directory
}
