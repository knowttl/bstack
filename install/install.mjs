import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { isInside, resolvePath } from '../skills/repo-audit/scripts/lib/paths.mjs'
import { runCommand } from '../skills/repo-audit/scripts/lib/run.mjs'
import { saveRecovery } from '../skills/repo-audit/scripts/lib/protected-write.mjs'
import { CommandError, emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'
import { planLifecycle, applyLifecycle, finishLifecycle, verifyCleanup, resumeCopy, inspectInstallation, inspectCompletion, previewRecovery, verifyDestination, runtimeIdentity, ownsRuntime, legacyRuntimeDecision, matchesReplacement, matchesRuntimeAdoption } from './lifecycle.mjs'

// Installation always selects the complete skill beside this installer.
const checkout = fileURLToPath(new URL('../', import.meta.url))
// These directories contain runtime or scratch data rather than authored files.
const excluded = new Set(['node_modules', '.git', '.cache', 'scratch'])
// Both human and machine output describe the same supported slice.
const help = 'Usage: node install/install.mjs --scope user|project [--project <path>] --host claude|agents|all [--dry-run] [--uninstall] [--replace <host>:<path>:<actual-hash|absent>] [--adopt-runtime <host>:<displayed-hash>] [--json]\nCopy installs require Node 24+, Git, npm and root development dependencies (npm ci).\nUser scope uses the current home. Project scope requires an existing --project directory.\nRepeat --replace for specific conflicts after reviewing their diff. Use the displayed --adopt-runtime decision to confirm legacy runtime ownership. Interrupted runs resume automatically.\n--link is deferred to C25c.\nExamples:\n  node install/install.mjs --scope user --host agents --dry-run\n  node install/install.mjs --scope project --project ./example --host all --uninstall --json'

function reject(status, code, message, fix) {
  throw new CommandError(status, [{ code, message, fix }])
}

function options(args) {
  const values = {}
  for (let index = 0; index < args.length; index++) {
    const key = args[index].replace(/^--/, '')
    if (!args[index].startsWith('--') || !['scope', 'project', 'host', 'dry-run', 'json', 'link', 'uninstall', 'replace', 'adopt-runtime'].includes(key) || (!['replace', 'adopt-runtime'].includes(key) && Object.hasOwn(values, key))) {
      reject('usage-error', 'invalid-arguments', `Unknown or repeated argument: ${args[index]}`, help)
    }
    if (['scope', 'project', 'host', 'replace', 'adopt-runtime'].includes(key)) {
      const value = args[++index]
      if (!value || value.startsWith('--')) reject('usage-error', 'missing-value', `--${key} requires a value.`, help)
      if (['replace', 'adopt-runtime'].includes(key)) {
        if (!(key === 'replace' ? /^(claude|agents):.+:(?:[a-f0-9]{64}|absent)$/ : /^(claude|agents):[a-f0-9]{64}$/).test(value)) reject('usage-error', 'invalid-replacement', 'Decision must match the displayed host and hash.', help)
        values[key] ??= []
        values[key].push(value)
      } else values[key] = value
    } else values[key] = true
  }
  if (!['user', 'project'].includes(values.scope) || !['claude', 'agents', 'all'].includes(values.host) ||
      (values.scope === 'project') !== Boolean(values.project)) reject('usage-error', 'invalid-target', 'Select --scope and --host, with --project only for project scope.', help)
  if (values.link) reject('blocked', 'unsupported-lifecycle', 'Link lifecycle is deferred to C25c.', 'Use copy installation.')
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
  const hosts = selected.host === 'all' ? ['claude', 'agents'] : [selected.host]
  const destinations = []
  for (const host of hosts) {
    const parent = await resolvePath(root, `.${host}/skills`)
    const destination = join(parent, 'repo-audit')
    if (destinations.some(entry => entry.destination === destination)) continue
    destinations.push({ host, parent, destination, sourceFiles: files, ownership: join(parent, '.bstack-install.json'),
      journal: join(parent, '.bstack-install-journal.json') })
  }
  const cleanupPath = join(root, '.bstack-install-cleanup.json')
  const generatedPaths = [cleanupPath, ...destinations.flatMap(entry => [entry.destination, entry.ownership])]
  const generatedParents = destinations.map(entry => entry.parent)
  for (const host of ['claude', 'agents'].filter(host => !hosts.includes(host))) {
    let parent
    try { parent = await realpath(join(root, `.${host}/skills`)) } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) continue
      throw error
    }
    generatedPaths.push(join(parent, 'repo-audit'), join(parent, '.bstack-install.json'))
    generatedParents.push(parent)
  }
  for (const parent of new Set([root, ...generatedParents].filter(path => isInside(checkout, path)))) {
    let names
    try { names = await readdir(parent) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    for (const name of names) {
      const match = /^\.bstack-recovery-(\.bstack-install(?:-journal|-cleanup)?\.json)-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.tmp$/.exec(name)
      if (match && (match[1] === '.bstack-install-cleanup.json' ? parent === root : generatedParents.includes(parent)) &&
          (await lstat(join(parent, name))).isFile()) generatedPaths.push(join(parent, name))
    }
    for (const name of names.filter(name => /^\.bstack-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.tmp$/.test(name))) {
      const path = join(parent, name)
      if (!(await lstat(path)).isFile()) continue
      let value
      try { value = JSON.parse(await readFile(path, 'utf8')) } catch { continue }
      if (value?.schemaVersion !== 1) continue
      const destination = join(parent, 'repo-audit')
      const ownership = join(parent, '.bstack-install.json')
      const record = value.record ?? value
      const hostWrite = generatedParents.includes(parent) && record.mode === 'copy' && record.destination === destination &&
        record.files && record.sourceVersion && (!value.record || value.ownership === ownership &&
          ['staging', 'prepared', 'activated', 'completed', 'applying'].includes(value.state))
      const cleanupWrite = parent === root && /^[0-9a-f]{64}$/.test(value.binding ?? '') && Array.isArray(value.entries) &&
        value.entries.length > 0 && value.entries.every(saved => generatedParents.some(parent => join(parent, 'repo-audit') === saved.destination))
      if (hostWrite || cleanupWrite) generatedPaths.push(path)
    }
  }
  const dirty = await child(checkout, 'git', ['status', '--porcelain', '--untracked-files=no'])
  const untracked = await child(checkout, 'git', ['ls-files', '--others', '--exclude-standard', '--', '.',
    ...['claude', 'agents'].flatMap(host => [
      `:(glob,exclude)**/.${host}/skills/repo-audit/**`,
      `:(glob,exclude)**/.${host}/skills/.bstack-stage-*/**`,
      `:(glob,exclude)**/.${host}/skills/.bstack-backup-*/**`,
      `:(glob,exclude)**/.${host}/skills/.bstack-install-journal.json`,
      `:(glob,exclude)**/.${host}/skills/.bstack-install.json`]),
    ...generatedPaths.filter(path => isInside(checkout, path))
      .map(path => `:(literal,exclude)${relative(checkout, path).replaceAll('\\', '/')}`),
    ...generatedParents.filter(path => isInside(checkout, path)).flatMap(path => {
      const parent = relative(checkout, path).replaceAll('\\', '/').replace(/[*?\[\]]/g, '\\$&')
      return ['.bstack-stage-*/**', '.bstack-backup-*/**', '.bstack-install-journal.json']
        .map(pattern => `:(glob,exclude)${parent ? parent + '/' : ''}${pattern}`)
    })])
  const sourceDirty = Boolean(dirty.stdout.trim() || untracked.stdout.trim())
  const version = tag.status === 'passed' && /^v\d+\.\d+\.\d+$/.test(tag.stdout.trim()) && dirty.status === 'passed' && untracked.status === 'passed' && !sourceDirty ?
    tag.stdout.trim() : `development:${revision.status === 'passed' ? revision.stdout.trim() : 'unversioned'}${sourceDirty ? ':dirty' : ''}`
  const hashes = Object.fromEntries(files.map(file => [file.path, file.hash]))
  const cleanupBinding = hashBytes(Buffer.from(canonicalJSON({ destinations: destinations.map(entry => entry.destination), uninstall: Boolean(selected.uninstall), version, hashes, runtime })))
  let cleanup
  if (await exists(cleanupPath)) {
    if (await resolvePath(root, '.bstack-install-cleanup.json') !== cleanupPath) reject('blocked', 'changed-destination', 'Cleanup record canonical path changed.', help)
    cleanup = JSON.parse(await readFile(cleanupPath, 'utf8'))
    if (cleanup.schemaVersion !== 1 || cleanup.binding !== cleanupBinding) reject('blocked', 'pending-recovery', 'Resume the original command before changing cleanup inputs or hosts.', help)
  }
  for (const entry of destinations) {
    const { destination, ownership, journal } = entry
    entry.adoptionBinding = hashBytes(Buffer.from(canonicalJSON({ destination, uninstall: Boolean(selected.uninstall), version, hashes, runtime })))
    await verifyDestination(entry)
    if (cleanup) {
      const saved = cleanup.entries.find(saved => saved.destination === destination)
      if (!saved) reject('blocked', 'journal-mismatch', 'Cleanup record does not match selected hosts.', help)
      entry.cleanup = saved
      entry.recovery = saved.recovery
      entry.previous = saved.previous
      entry.action = 'cleanup'
      continue
    }
    if (await exists(journal)) {
      entry.recovery = JSON.parse(await readFile(journal, 'utf8'))
      if (Boolean(entry.recovery.plan?.uninstall) !== Boolean(selected.uninstall)) reject('blocked', 'pending-recovery', 'Resume the original operation before changing lifecycle mode.', help)
      entry.action = 'resume'
      continue
    }
    let previous
    if (await exists(ownership)) previous = JSON.parse(await readFile(ownership, 'utf8'))
    let action = selected.uninstall ? 'no-op' : 'copy'
    if (await exists(destination)) {
      if (!previous || previous.destination !== destination || previous.mode !== 'copy' || previous.schemaVersion !== 1) reject('blocked', 'unowned-collision', `Occupied unowned destination: ${destination}`, 'Preserve the existing folder and select an empty installation destination.')
      if ((await lstat(destination)).isSymbolicLink()) reject('blocked', 'unsupported-lifecycle', `Destination is a link: ${destination}`, 'Link lifecycle support is pending C25c.')
      entry.runtimeDecision = await legacyRuntimeDecision(entry, previous, runtimeVersion)
      if (entry.runtimeDecision && selected['adopt-runtime']?.includes(entry.runtimeDecision.value)) {
        entry.adoptRuntime = entry.runtimeDecision.value
        previous.runtime = entry.runtimeDecision.runtime
      }
      entry.previous = previous
      let unchanged = !selected.uninstall && previous.sourceVersion === version && canonicalJSON(previous.files) === canonicalJSON(hashes)
      if (unchanged) {
        for (const [path, hash] of Object.entries(previous.files)) {
          const installedPath = join(destination, path)
          if (!(await exists(installedPath))?.isFile() || hashBytes(await readFile(await resolvePath(destination, path))) !== hash) {
            unchanged = false
            break
          }
        }
      }
      if (!unchanged ||
          previous.runtime?.path !== join(destination, 'node_modules') || !previous.runtime.created ||
          !await ownsRuntime(join(destination, 'node_modules'), previous.runtime) ||
          !await runtimeVersion(destination, runtime)) {
        entry.previous = previous
        entry.plan = await planLifecycle(entry, files, version, runtime, selected)
        action = selected.uninstall ? 'uninstall' : 'update'
      } else action = 'no-op'
    } else if (previous) {
      entry.previous = previous
      entry.plan = await planLifecycle(entry, files, version, runtime, selected)
      action = selected.uninstall ? 'uninstall' : 'update'
    }
    entry.action = action
  }
  const data = { sourceVersion: version, mode: 'copy', preview: Boolean(selected['dry-run']), destinations, changes: [], installations: [] }
  const report = () => ({ ...data, destinations: destinations.map(({ host, parent, destination, ownership, journal, action, plan }) =>
    ({ host, parent, destination, ownership, journal, action, ...(plan ? { conflicts: plan.conflicts } : {}) })) })
  try {
    data.changes = (await Promise.all(destinations.map(async entry => entry.action === 'cleanup' || entry.action === 'no-op' ? [] : entry.action === 'resume' && entry.recovery.plan ? await previewRecovery(entry, runtimeVersion) : entry.plan ? [
      ...entry.plan.operations.map(operation => ({ action: operation.proposedHash === null ? 'remove' : 'replace', path: join(entry.destination, operation.path), hash: operation.proposedHash })),
      ...entry.plan.conflicts.map(conflict => ({ action: 'preserve', path: join(entry.destination, conflict.path) })),
      ...(entry.plan.runtimeAllowed ? [{ action: selected.uninstall ? 'runtime-remove' : 'runtime-install', path: join(entry.destination, 'node_modules'), version: runtime }] : [])
    ] : [
      ...files.map(file => ({ action: 'copy', path: join(entry.destination, file.path), hash: file.hash })),
      { action: 'runtime-install', path: join(entry.destination, 'node_modules'), version: runtime },
      { action: 'ownership', path: entry.ownership }, { action: 'journal', path: entry.journal }]))).flat()
    for (const decision of selected.replace ?? []) {
      if (!(await Promise.all(destinations.map(entry => matchesReplacement(entry, decision)))).some(Boolean)) reject('usage-error', 'stale-replacement', 'Replacement does not match a current conflict hash.', 'Review the current conflict and use its exact --replace value.')
    }
    for (const decision of selected['adopt-runtime'] ?? []) {
      if (!(await Promise.all(destinations.map(entry => matchesRuntimeAdoption(entry, decision, runtimeVersion)))).some(Boolean)) reject('usage-error', 'stale-runtime-decision', 'Runtime decision does not match current verified legacy ownership.', 'Review the current runtime and use its displayed decision.')
    }
    for (const entry of destinations.filter(entry => entry.adoptRuntime)) data.changes.push({ action: 'runtime-adopt', path: entry.previous.runtime.path }, { action: 'ownership', path: entry.ownership })
    if (selected['dry-run']) {
      for (const entry of destinations.filter(entry => entry.cleanup)) await verifyCleanup(entry, runtimeVersion)
      for (const entry of destinations.filter(entry => entry.action === 'resume' && !entry.recovery.plan)) data.installations.push(await resumeCopy(entry, files, runtime, checkPackage, runtimeVersion, selected, child))
      return report()
    }
    for (const entry of destinations) {
      if (entry.cleanup) {
        await verifyCleanup(entry, runtimeVersion)
        data.installations.push(structuredClone(entry.cleanup.report))
        continue
      }
      if (entry.adoptRuntime) {
        const previous = JSON.parse(await readFile(entry.ownership, 'utf8'))
        const actual = await legacyRuntimeDecision(entry, previous, runtimeVersion)
        if (actual?.value !== entry.adoptRuntime) reject('usage-error', 'stale-runtime-decision', 'Runtime changed before legacy ownership could be saved.', 'Review the current runtime and use its displayed decision.')
        entry.previous = { ...previous, runtime: actual.runtime, acceptedAdoption: { value: entry.adoptRuntime, binding: entry.adoptionBinding } }
        await saveRecovery(entry.ownership, entry.previous)
      }
      if (entry.action === 'no-op') {
        if (!selected.uninstall) {
          const installation = await inspectCompletion(entry, files, runtime, runtimeVersion)
          if (installation.conflicts.length) {
            const record = JSON.parse(await readFile(entry.ownership, 'utf8'))
            await saveRecovery(entry.ownership, { ...record, fileVersions: installation.fileVersions, sourceVersion: 'mixed' })
          }
          data.installations.push(installation)
        }
        continue
      }
      if (entry.action === 'resume') {
        if (entry.recovery.plan) {
          data.installations.push(await applyLifecycle(entry, entry.recovery.plan, entry.recovery.stage, runtimeVersion))
        } else data.installations.push(await resumeCopy(entry, files, runtime, checkPackage, runtimeVersion, selected, child))
        continue
      }
      if (entry.action === 'uninstall') {
        data.installations.push(await applyLifecycle(entry, entry.plan, null, runtimeVersion))
        continue
      }
      await mkdir(entry.parent, { recursive: true })
      const stage = await mkdtemp(join(entry.parent, '.bstack-stage-'))
      const record = { schemaVersion: 1, mode: 'copy', sourceVersion: version, destination: entry.destination, files: hashes,
        fileVersions: Object.fromEntries(Object.keys(hashes).map(path => [path, version])),
        runtime: { path: join(entry.destination, 'node_modules'), created: true, version: runtime } }
      const journal = { schemaVersion: 1, state: 'staging', stage, ownership: entry.ownership, record,
        ...(entry.plan ? { update: { previous: entry.previous, plan: entry.plan } } : {}) }
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
        record.runtime.identity = await runtimeIdentity(join(stage, 'node_modules'))
        await saveRecovery(entry.journal, journal)
        if (entry.action === 'update') {
          // The validated stage becomes the recoverable per-file update plan.
          entry.recovery = null
          data.installations.push(await applyLifecycle(entry, entry.plan, stage, runtimeVersion, { ...record.runtime, path: join(stage, 'node_modules') }))
          continue
        }
        // Check the empty destination again after dependency scripts have finished.
        if (await exists(entry.destination) || await exists(entry.ownership) || await resolvePath(root, `.${entry.host}/skills`) !== entry.parent) reject('blocked', 'changed-destination', 'Installation destination changed during staging.', 'Preserve the new content and inspect the journal.')
        await rename(stage, entry.destination)
        journal.state = 'activated'
        await saveRecovery(entry.journal, journal)
        await saveRecovery(entry.ownership, record)
        journal.state = 'completed'
        await saveRecovery(entry.journal, journal)
        const installation = await inspectCompletion(entry, files, runtime, runtimeVersion)
        if (installation.conflicts.length) await saveRecovery(entry.ownership, { ...record, fileVersions: installation.fileVersions, sourceVersion: 'mixed' })
        // A completed journal is no longer recovery state.
        entry.recovery = journal
        data.installations.push(installation)
      } catch (error) {
        // Per-file application owns its journal once staging has finished.
        if (entry.action !== 'update' || journal.state !== 'prepared') {
          journal.error = error.message
          await saveRecovery(entry.journal, journal)
        }
        throw error
      }
      data.limitations = limitations
    }
    if (!cleanup && destinations.some(entry => entry.recovery || entry.previous?.acceptedAdoption)) {
      cleanup = { schemaVersion: 1, binding: cleanupBinding, entries: [] }
      for (const entry of destinations) {
        const saved = { destination: entry.destination, recovery: entry.recovery, previous: entry.previous,
          record: await exists(entry.ownership) ? JSON.parse(await readFile(entry.ownership, 'utf8')) : null,
          report: data.installations.find(installation => installation.destination === entry.destination) ?? { destination: entry.destination, files: {}, runtime: null, sourceVersion: 'not-installed' } }
        entry.cleanup = saved
        cleanup.entries.push(saved)
      }
      await saveRecovery(cleanupPath, cleanup)
    }
    for (const entry of destinations.filter(entry => entry.cleanup)) {
      entry.saveCleanup = () => saveRecovery(cleanupPath, cleanup)
      await finishLifecycle(entry, data.installations.find(installation => installation.destination === entry.destination), runtimeVersion)
    }
    if (cleanup) await unlink(cleanupPath)
  } catch (error) {
    for (const entry of destinations) {
      const index = data.installations.findIndex(installation => installation.destination === entry.destination)
      const actual = await inspectInstallation(entry, runtimeVersion, index === -1 ? entry.cleanup?.report : data.installations[index])
      const refreshed = { ...(index === -1 ? entry.cleanup?.report : data.installations[index]), ...actual }
      if (index === -1) data.installations.push(refreshed)
      else data.installations[index] = refreshed
    }
    error.data = report()
    throw error
  }
  data.blocked = data.installations.some(installation => installation.conflicts?.length)
  return report()
}

function printInstallations(data) {
  for (const installation of data?.installations ?? []) {
    console.log(`installation: ${installation.destination}\ninstalled state: ${installation.sourceVersion}`)
    for (const [path, hash] of Object.entries(installation.files ?? {})) console.log(`file: ${path} ${hash ?? 'absent'}`)
    if (installation.runtime) console.log(`runtime: ${installation.runtime.version ?? 'unknown'} verified=${installation.runtime.verified}`)
    for (const conflict of installation.conflicts ?? []) console.log(`${conflict.diff}\nDecision: ${conflict.decision}`)
    if (installation.retained?.length) console.log(`retained: ${installation.retained.join(', ')}`)
    if (installation.backup) console.log(`backup: ${installation.backup}`)
  }
}

try {
  const args = process.argv.slice(2)
  if (!args.length || (args.length === 1 && args[0] === '--help')) console.log(help)
  else {
    const selected = options(args)
    const data = await install(selected)
    if (!selected.json) console.log([`source: ${data.sourceVersion}`, ...data.destinations.map(entry => `${entry.action}: ${entry.destination}`),
      ...data.changes.map(change => `${change.action}: ${change.path}`)].join('\n'))
    if (!selected.json) printInstallations(data)
    emitResult({ command: 'install', status: data.blocked ? 'blocked' : 'passed', data }, selected.json)
  }
} catch (error) {
  if (!process.argv.includes('--json')) printInstallations(error.data)
  emitResult({ command: 'install', status: error instanceof CommandError ? error.status : 'blocked',
    data: error.data,
    problems: error instanceof CommandError ? error.problems : [{ code: 'install-io-failure', message: error.message, fix: 'Check source and destination access. Preserve any journal and stage for inspection.' }] }, process.argv.includes('--json'))
}
