import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

// Tests execute the installed interface from a disposable cwd.
const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function git(repo, ...args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

export function build(t, name) {
  const result = spawnSync(process.execPath, [join(checkout, 'tests', 'fixtures', 'build.mjs'), name], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const fixture = JSON.parse(result.stdout.trim())
  t.after(() => rm(fixture.path, { recursive: true, force: true }))
  return fixture.path
}

export async function emptyRepo(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack discovery ü & [scope] '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repo = join(directory, 'target')
  await mkdir(repo)
  git(repo, 'init', '-q')
  return { directory, repo }
}

export function run(command, repo, env = process.env, extra = []) {
  const result = spawnSync(process.execPath, [join(checkout, 'skills', 'repo-audit', 'scripts', 'repo-audit.mjs'), command, '--repo', repo, '--json', ...extra], { encoding: 'utf8', cwd: tmpdir(), env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

export async function snapshot(directory) {
  const files = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    files[entry.name] = entry.isDirectory() ? await snapshot(path) : createHash('sha256').update(await readFile(path)).digest('hex')
  }
  return files
}
