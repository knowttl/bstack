import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { repoFiles, readGit } from '../lib/discovery.mjs'
import { hashBytes } from '../lib/fingerprint.mjs'
import { selectCommand } from '../lib/run.mjs'

// Manifest detection describes the starting stack without executing project code.
const manifests = new Set(['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pyproject.toml', 'requirements.txt', 'Pipfile', 'Pipfile.lock', 'uv.lock', 'poetry.lock', 'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum', 'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock'])

export async function run(options) {
  const target = await resolveTarget(options)
  const problems = []
  const tools = new Set(['git', 'node'])
  const detected = []
  for (const path of await repoFiles(target.root)) {
    const name = path.split('/').at(-1)
    if (!manifests.has(name)) continue
    const bytes = await readFile(join(target.root, path))
    detected.push({ path, hash: hashBytes(bytes) })
    if (name === 'package.json') {
      try {
        const manifest = JSON.parse(bytes.toString('utf8'))
        const manager = manifest.packageManager?.split('@')[0]
        tools.add(['npm', 'pnpm', 'yarn', 'bun'].includes(manager) ? manager : 'npm')
      } catch {
        problems.push({ code: 'manifest-unreadable', path, message: 'The package manifest is not readable JSON.', fix: 'Restore a valid package.json before assessing its prerequisites.' })
      }
    }
    if (['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'package-lock.json', 'npm-shrinkwrap.json'].includes(name)) tools.add(name.startsWith('pnpm') ? 'pnpm' : name.startsWith('yarn') ? 'yarn' : name.startsWith('bun') ? 'bun' : 'npm')
    if (['pyproject.toml', 'requirements.txt', 'Pipfile'].includes(name)) tools.add(process.platform === 'win32' ? 'python' : 'python3')
    if (name === 'uv.lock') tools.add('uv')
    if (name === 'poetry.lock') tools.add('poetry')
    if (name === 'Pipfile.lock') tools.add('pipenv')
    if (name === 'Cargo.toml') tools.add('cargo')
    if (name === 'go.mod') tools.add('go')
    if (name === 'Gemfile') tools.add('bundle')
    if (name === 'composer.json') tools.add('composer')
  }
  const prerequisites = []
  for (const tool of [...tools].sort()) {
    let version
    try {
      const selected = await selectCommand(tool, [tool === 'go' ? 'version' : '--version'])
      version = spawnSync(selected.executable, selected.args, { cwd: target.root, encoding: 'utf8', timeout: 10000 })
    } catch (error) { version = { error } }
    const found = !version.error && version.status === 0
    if (!found) problems.push({ code: 'prerequisite-unavailable', tool, message: `Cannot obtain the ${tool} version.`, fix: `Install ${tool} and make its executable available on PATH.` })
    prerequisites.push({ tool, found, version: found ? (version.stdout || version.stderr).trim() : null })
  }
  const head = readGit(target.root, ['rev-parse', '--verify', 'HEAD'])
  let revision = head.status === 0 ? head.stdout.trim() : 'no commits'
  const branch = readGit(target.root, ['symbolic-ref', '-q', 'HEAD'])
  const unborn = branch.status === 0 && readGit(target.root, ['show-ref', '--verify', '--quiet', branch.stdout.trim()]).status === 1
  if (head.status !== 0 && !unborn) {
    revision = null
    problems.push({ code: 'history-unreadable', message: 'Git cannot resolve the starting revision.', fix: 'Restore readable Git history before continuing.' })
  } else if (head.status === 0 && readGit(target.root, ['log', '--format=']).status !== 0) {
    problems.push({ code: 'history-unreadable', message: 'Git cannot read the available commit history.', fix: 'Restore readable Git history before continuing.' })
  }
  const status = readGit(target.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  const changes = []
  if (status.status !== 0) problems.push({ code: 'working-tree-unreadable', message: 'Git cannot read working-tree changes.', fix: 'Restore readable Git working-tree state.' })
  else {
    const records = status.stdout.split('\0').filter(Boolean)
    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      const change = { status: record.slice(0, 2), path: record.slice(3) }
      if (/[RC]/.test(change.status)) change.originalPath = records[++index]
      changes.push(change)
    }
  }
  return { status: problems.length ? 'blocked' : 'passed', problems,
    data: { root: target.root, revision, changes, manifests: detected, prerequisites }, inputs: { repo: target.root } }
}
