import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { resolvePath } from '../skills/repo-audit/scripts/lib/paths.mjs'
import { runCommand } from '../skills/repo-audit/scripts/lib/run.mjs'
import { saveRecovery } from '../skills/repo-audit/scripts/lib/protected-write.mjs'
import { CommandError, emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'

// Installation always selects the complete skill beside this installer.
const checkout = fileURLToPath(new URL('../', import.meta.url))
// These directories contain runtime or scratch data rather than authored files.
const excluded = new Set(['node_modules', '.git', '.cache', 'scratch'])
// Both human and machine output describe the same supported slice.
const help = 'Usage: node install/install.mjs --scope user|project [--project <path>] --host claude|agents|all [--dry-run] [--json]\nCopy installs require Node 24+, Git, npm and root development dependencies (npm ci).\nUser scope uses the current home. Project scope requires an existing --project directory.\n--link and --uninstall are reserved and currently blocked. Updates and interrupted-run resume are pending.\nExamples:\n  node install/install.mjs --scope user --host agents --dry-run\n  node install/install.mjs --scope project --project ./example --host all --json'

function reject(status, code, message, fix) {
  throw new CommandError(status, [{ code, message, fix }])
}

function options(args) {
  const values = {}
  for (let index = 0; index < args.length; index++) {
    const key = args[index].replace(/^--/, '')
    if (!args[index].startsWith('--') || !['scope', 'project', 'host', 'dry-run', 'json', 'link', 'uninstall'].includes(key) || Object.hasOwn(values, key)) {
      reject('usage-error', 'invalid-arguments', `Unknown or repeated argument: ${args[index]}`, help)
    }
    if (['scope', 'project', 'host'].includes(key)) {
      const value = args[++index]
      if (!value || value.startsWith('--')) reject('usage-error', 'missing-value', `--${key} requires a value.`, help)
      values[key] = value
    } else values[key] = true
  }
  if (!['user', 'project'].includes(values.scope) || !['claude', 'agents', 'all'].includes(values.host) ||
      (values.scope === 'project') !== Boolean(values.project)) reject('usage-error', 'invalid-target', 'Select --scope and --host, with --project only for project scope.', help)
  if (values.link || values.uninstall) reject('blocked', 'unsupported-lifecycle', 'Link and uninstall modes are not available in C25a.', 'Use copy installation. C25b owns removal and C25c owns links.')
  return values
}

async function exists(path) {
  try { return await lstat(path) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function authored(directory, prefix = '') {
  const files = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (excluded.has(entry.name)) continue
    const path = join(directory, entry.name)
    const name = prefix + entry.name
    if (entry.isDirectory()) files.push(...await authored(path, name + '/'))
    else if (entry.isFile()) {
      const bytes = await readFile(path)
      files.push({ path: name, bytes, hash: hashBytes(bytes), mode: (await lstat(path)).mode })
    } else reject('blocked', 'unsupported-source-entry', `Authored source must contain regular files and directories: ${name}`, 'Restore the complete source package before installing.')
  }
  return files
}

async function child(root, executable, args, versionArgs = ['--version']) {
  const env = executable === 'git' ? { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_DIR: undefined, GIT_WORK_TREE: undefined,
    GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined } : process.env
  return runCommand({ root }, { executable, args, versionArgs, cwd: '.', timeoutMs: 120000 }, { env })
}

async function runtimeVersion(directory, expected) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, 'node_modules/lavish-axi/package.json'), 'utf8'))
    if (manifest.version !== expected) return false
    const result = await child(directory, 'node', [join(directory, 'node_modules/lavish-axi/dist/cli.mjs'), '--version'])
    return result.status === 'passed' && result.stdout.trim() === expected
  } catch { return false }
}

async function install(selected) {
  if (Number(process.versions.node.split('.')[0]) < 24) reject('blocked', 'node-version', 'Node 24 or later is required.', 'Install a supported Node release.')
  const root = await realpath(selected.scope === 'user' ? homedir() : resolve(selected.project))
  if (!(await lstat(root)).isDirectory()) reject('blocked', 'invalid-directory', 'Installation root must be an existing directory.', 'Select an existing home or project directory.')
  const source = join(checkout, 'skills/repo-audit')
  let checkPackage
  try { ({ checkPackage } = await import('../scripts/check-package.mjs')) } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    reject('blocked', 'missing-checker-prerequisite', 'Package validation dependencies are unavailable in the source checkout.', 'Run npm ci in the source checkout, then retry installation.')
  }
  const problems = await checkPackage(source, { sourcePreflight: true })
  if (problems.length) throw new CommandError('failed', problems)
  const files = await authored(source)
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
  const lock = JSON.parse(await readFile(join(source, 'package-lock.json'), 'utf8'))
  const runtime = manifest.dependencies?.['lavish-axi']
  if (!/^\d+\.\d+\.\d+$/.test(runtime ?? '') || lock.lockfileVersion !== 3 ||
      canonicalJSON(manifest.dependencies) !== canonicalJSON(lock.packages?.['']?.dependencies ?? {}) ||
      lock.packages?.['node_modules/lavish-axi']?.version !== runtime) reject('failed', 'runtime-lock', 'Runtime manifest and lock must agree on the exact pinned lavish-axi version.', 'Restore the pinned runtime manifest and lockfile.')
  for (const tool of ['git', 'npm']) {
    const result = await child(checkout, tool, ['--version'])
    if (result.status !== 'passed') reject('blocked', 'missing-prerequisite', `${tool} is unavailable.`, `Install ${tool} and make it available on PATH.`)
  }
  const revision = await child(checkout, 'git', ['rev-parse', '--verify', 'HEAD'])
  const tag = await child(checkout, 'git', ['describe', '--tags', '--exact-match', 'HEAD'])
  const dirty = await child(checkout, 'git', ['status', '--porcelain', '--untracked-files=all'])
  const version = tag.status === 'passed' && /^v\d+\.\d+\.\d+$/.test(tag.stdout.trim()) && dirty.status === 'passed' && !dirty.stdout.trim() ?
    tag.stdout.trim() : `development:${revision.status === 'passed' ? revision.stdout.trim() : 'unversioned'}${dirty.stdout.trim() ? ':dirty' : ''}`
  const hashes = Object.fromEntries(files.map(file => [file.path, file.hash]))
  const hosts = selected.host === 'all' ? ['claude', 'agents'] : [selected.host]
  const destinations = []
  for (const host of hosts) {
    const parent = await resolvePath(root, `.${host}/skills`)
    const destination = join(parent, 'repo-audit')
    if (destinations.some(entry => entry.destination === destination)) continue
    const ownership = join(parent, '.bstack-install.json')
    const journal = join(parent, '.bstack-install-journal.json')
    if (await exists(journal)) reject('blocked', 'pending-recovery', `A pending installation journal exists: ${journal}`, 'Preserve the journal and staged files for inspection. Automated resume is pending C25b.')
    let previous
    if (await exists(ownership)) previous = JSON.parse(await readFile(ownership, 'utf8'))
    let action = 'copy'
    if (await exists(destination)) {
      if (!previous || previous.destination !== destination || previous.mode !== 'copy' || previous.schemaVersion !== 1) reject('blocked', 'unowned-collision', `Occupied unowned destination: ${destination}`, 'Preserve the existing folder and select an empty installation destination.')
      if ((await lstat(destination)).isSymbolicLink()) reject('blocked', 'unsupported-lifecycle', `Destination is a link: ${destination}`, 'Link lifecycle support is pending C25c.')
      const actual = Object.fromEntries((await authored(destination)).map(file => [file.path, file.hash]))
      if (previous.sourceVersion !== version || canonicalJSON(previous.files) !== canonicalJSON(hashes) ||
          Object.entries(hashes).some(([path, hash]) => actual[path] !== hash) ||
          previous.runtime?.path !== join(destination, 'node_modules') || !previous.runtime.created ||
          !await runtimeVersion(destination, runtime)) reject('blocked', 'update-pending', `Installation differs from this source or runtime: ${destination}`, 'Preserve installed files. Update and conflict handling are pending C25b.')
      action = 'no-op'
    } else if (previous) reject('blocked', 'ownership-conflict', `Ownership exists without its installation: ${ownership}`, 'Preserve the ownership record for recovery inspection.')
    destinations.push({ host, parent, destination, ownership, journal, action })
  }
  const changes = destinations.flatMap(entry => entry.action === 'no-op' ? [] : [
    ...files.map(file => ({ action: 'copy', path: join(entry.destination, file.path), hash: file.hash })),
    { action: 'runtime-install', path: join(entry.destination, 'node_modules'), version: runtime },
    { action: 'ownership', path: entry.ownership }, { action: 'journal', path: entry.journal }])
  const data = { sourceVersion: version, mode: 'copy', preview: Boolean(selected['dry-run']), destinations, changes }
  if (selected['dry-run']) return data
  for (const entry of destinations.filter(entry => entry.action === 'copy')) {
    await mkdir(entry.parent, { recursive: true })
    const stage = await mkdtemp(join(entry.parent, '.bstack-stage-'))
    const record = { schemaVersion: 1, mode: 'copy', sourceVersion: version, destination: entry.destination, files: hashes,
      runtime: { path: join(entry.destination, 'node_modules'), created: true, version: runtime } }
    const journal = { schemaVersion: 1, state: 'staging', stage, ownership: entry.ownership, record }
    const limitations = await saveRecovery(entry.journal, journal)
    try {
      for (const file of files) {
        const path = join(stage, file.path)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, file.bytes, { flag: 'wx', mode: file.mode })
      }
      const result = await child(stage, 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'])
      if (result.status !== 'passed') {
        journal.runtimeResult = result
        reject(result.status, 'runtime-install-failed', `Pinned runtime installation failed. Recovery: ${entry.journal}`, 'Inspect the staged package and journal. The destination has not been activated.')
      }
      const stagedProblems = await checkPackage(stage)
      if (stagedProblems.length) throw new CommandError('failed', stagedProblems)
      if (canonicalJSON(Object.fromEntries((await authored(stage)).map(file => [file.path, file.hash]))) !== canonicalJSON(hashes) || !await runtimeVersion(stage, runtime)) {
        reject('failed', 'staged-package-changed', 'Staged authored files or pinned runtime do not match the validated source.', 'Inspect the preserved stage and runtime installation output.')
      }
      journal.state = 'prepared'
      await saveRecovery(entry.journal, journal)
      // Check the empty destination again after dependency scripts have finished.
      if (await exists(entry.destination) || await exists(entry.ownership) || await resolvePath(root, `.${entry.host}/skills`) !== entry.parent) reject('blocked', 'changed-destination', 'Installation destination changed during staging.', 'Preserve the new content and inspect the journal.')
      await rename(stage, entry.destination)
      journal.state = 'activated'
      await saveRecovery(entry.journal, journal)
      await saveRecovery(entry.ownership, record)
      journal.state = 'completed'
      await saveRecovery(entry.journal, journal)
      // A completed journal is no longer recovery state.
      await unlink(entry.journal)
    } catch (error) {
      journal.error = error.message
      await saveRecovery(entry.journal, journal)
      throw error
    }
    data.limitations = limitations
  }
  return data
}

try {
  const args = process.argv.slice(2)
  if (!args.length || (args.length === 1 && args[0] === '--help')) console.log(help)
  else {
    const selected = options(args)
    const data = await install(selected)
    if (!selected.json) console.log([`source: ${data.sourceVersion}`, ...data.destinations.map(entry => `${entry.action}: ${entry.destination}`),
      ...data.changes.map(change => `${change.action}: ${change.path}`)].join('\n'))
    emitResult({ command: 'install', status: 'passed', data }, selected.json)
  }
} catch (error) {
  emitResult({ command: 'install', status: error instanceof CommandError ? error.status : 'blocked',
    problems: error instanceof CommandError ? error.problems : [{ code: 'install-io-failure', message: error.message, fix: 'Check source and destination access. Preserve any journal and stage for inspection.' }] }, process.argv.includes('--json'))
}
