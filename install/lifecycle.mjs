import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, rmdir, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { resolvePath } from '../skills/repo-audit/scripts/lib/paths.mjs'
import { saveRecovery } from '../skills/repo-audit/scripts/lib/protected-write.mjs'
import { CommandError } from '../skills/repo-audit/scripts/lib/result.mjs'

function blocked(code, message) {
  throw new CommandError('blocked', [{ code, message, fix: 'Preserve the installation and journal. Review the reported paths before retrying.' }])
}

export async function verifyDestination(entry) {
  const record = entry.recovery?.record ?? entry.previous
  let destination
  try { destination = await resolvePath(entry.parent, basename(entry.destination)) } catch (error) {
    if (!(error instanceof CommandError)) throw error
    blocked('changed-destination', 'Installation destination no longer matches its canonical path.')
  }
  if (destination !== entry.destination || record && record.destination !== entry.destination) {
    blocked('changed-destination', 'Installation destination no longer matches its canonical path.')
  }
}

export async function runtimeIdentity(path) {
  const stat = await lstat(path, { bigint: true })
  if (!stat.isDirectory() || stat.isSymbolicLink()) blocked('runtime-conflict', 'Runtime is not a regular directory.')
  return { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }
}

export async function ownsRuntime(path, runtime) {
  if (!runtime?.created || runtime.path !== path || !runtime.identity) return false
  try {
    if (await resolvePath(dirname(path), basename(path)) !== path) return false
    return canonicalJSON(await runtimeIdentity(path)) === canonicalJSON(runtime.identity)
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof CommandError) return false
    throw error
  }
}

async function runtimeEntry(path, name) {
  const stat = await lstat(path, { bigint: true })
  const identity = { dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) }
  const item = { path: name, identity }
  if (stat.isDirectory()) return { ...item, type: 'directory' }
  else if (stat.isFile()) return { ...item, hash: hashBytes(await readFile(path)) }
  else if (stat.isSymbolicLink()) return { ...item, link: await readlink(path) }
  else blocked('runtime-conflict', 'Runtime contains an unsupported entry.')
}

async function runtimeEntries(directory, prefix = '') {
  const entries = []
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name)
    const item = await runtimeEntry(path, prefix + name)
    entries.push(item)
    if (item.type === 'directory') entries.push(...await runtimeEntries(path, item.path + '/'))
  }
  return entries
}

async function verifyRuntimeRemoval(entry, removal) {
  await verifyDestination(entry)
  if (removal.entries.some(item => !item.path || item.path.split('/').some(part => part === '..' || part === '') || item.path.startsWith('/'))) blocked('journal-mismatch', 'Runtime removal entry path changed.')
  if (!await exists(removal.path)) return
  if (canonicalJSON(await runtimeIdentity(removal.path)) !== canonicalJSON(removal.identity)) blocked('runtime-conflict', 'Runtime directory identity changed during removal.')
  const expected = new Map(removal.entries.map(item => [item.path, canonicalJSON(item)]))
  for (const item of await runtimeEntries(removal.path)) {
    if (expected.get(item.path) !== canonicalJSON(item)) blocked('runtime-conflict', 'Runtime contents changed during removal.')
  }
}

async function removeRuntime(entry, path, owned, removals, key, save) {
  if (!removals[key]) {
    if (!await ownsRuntime(path, { ...owned, path })) blocked('runtime-conflict', 'Runtime directory identity changed before removal.')
    const removal = { path, identity: owned.identity, entries: await runtimeEntries(path) }
    if (!await matchesAcceptedRuntime(entry, entry.recovery?.record ?? entry.previous, entry.recovery)) blocked('runtime-conflict', 'Accepted runtime contents changed before removal.')
    removals[key] = removal
    await save()
  }
  const removal = removals[key]
  if (removal.path !== path || canonicalJSON(removal.identity) !== canonicalJSON(owned.identity)) blocked('journal-mismatch', 'Runtime removal identity changed.')
  await verifyRuntimeRemoval(entry, removal)
  for (const item of [...removal.entries].reverse()) {
    const target = join(path, item.path)
    if (!await exists(target)) continue
    await verifyDestination(entry)
    if (canonicalJSON(await runtimeEntry(target, item.path)) !== canonicalJSON(item)) blocked('runtime-conflict', 'Runtime entry changed during removal.')
    if (item.type === 'directory') await rmdir(target)
    else await unlink(target)
  }
  await verifyRuntimeRemoval(entry, removal)
  if (await exists(path)) await rmdir(path)
}

export async function legacyRuntimeDecision(entry, record, runtimeVersion) {
  const path = join(entry.destination, 'node_modules')
  if (!record.runtime?.created || record.runtime.path !== path || record.runtime.identity) return null
  await verifyDestination(entry)
  let identity
  try { identity = await runtimeIdentity(path) } catch (error) {
    if (error.code === 'ENOENT' || error instanceof CommandError) return null
    throw error
  }
  if (!await runtimeVersion(entry.destination, record.runtime.version)) return null
  const value = await runtimeFingerprint(entry, { ...record.runtime, identity }, path)
  return { value, decision: `--adopt-runtime ${value}`, runtime: { ...record.runtime, identity } }
}

async function runtimeFingerprint(entry, runtime, directory) {
  await verifyDestination(entry)
  const identity = await runtimeIdentity(directory)
  if (runtime.identity && canonicalJSON(runtime.identity) !== canonicalJSON(identity)) blocked('runtime-conflict', 'Accepted runtime directory identity changed.')
  const contents = []
  async function collect(directory, prefix = '') {
    for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + item.name
      const target = join(directory, item.name)
      if (item.isDirectory()) { contents.push({ path: name, type: 'directory' }); await collect(target, name + '/') }
      else if (item.isFile()) contents.push({ path: name, hash: hashBytes(await readFile(target)) })
      else if (item.isSymbolicLink()) contents.push({ path: name, link: await readlink(target) })
      else blocked('runtime-conflict', 'Legacy runtime contains an unsupported entry.')
    }
  }
  await collect(directory)
  await verifyDestination(entry)
  if (canonicalJSON(identity) !== canonicalJSON(await runtimeIdentity(directory))) blocked('runtime-conflict', 'Legacy runtime directory changed during verification.')
  return `${entry.host}:${hashBytes(Buffer.from(canonicalJSON({ path: runtime.path, identity, contents })))}`
}

async function matchesAcceptedRuntime(entry, record, journal) {
  if (!record.acceptedAdoption) return true
  const path = record.runtime.path
  const moved = journal?.stage && join(journal.stage, 'previous-runtime')
  const removal = entry.cleanup?.runtimeRemovals?.['previous-runtime'] ?? journal?.runtimeRemoval
  if (removal) {
    if (removal.path !== (entry.cleanup?.runtimeRemovals?.['previous-runtime'] ? moved : path) ||
        canonicalJSON(removal.identity) !== canonicalJSON(record.runtime.identity)) return false
    await verifyRuntimeRemoval(entry, removal)
    return true
  }
  const directory = moved && await exists(moved) ? moved : path
  if (await ownsRuntime(directory, { ...record.runtime, path: directory })) {
    return await runtimeFingerprint(entry, record.runtime, directory) === record.acceptedAdoption.value
  }
  return Boolean(journal?.plan?.uninstall && !await exists(path))
}

export async function matchesReplacement(entry, decision) {
  const plan = entry.plan ?? entry.recovery?.plan ?? entry.recovery?.update?.plan
  const operation = plan?.operations.find(operation => `${entry.host}:${operation.path}:${operation.originalHash ?? 'absent'}` === decision)
  if (!operation) return false
  await verifyDestination(entry)
  const actual = await state(entry.destination, operation.path)
  return actual.hash === operation.originalHash || actual.hash === operation.proposedHash
}

export async function matchesRuntimeAdoption(entry, decision, runtimeVersion) {
  if (entry.adoptRuntime === decision) return true
  const record = entry.recovery?.update?.previous ?? entry.recovery?.record ?? entry.previous
  if (record?.acceptedAdoption?.value !== decision || record.acceptedAdoption.binding !== entry.adoptionBinding) return false
  await verifyDestination(entry)
  if (!await matchesAcceptedRuntime(entry, record, entry.recovery)) return false
  if (entry.recovery?.runtimeRemoval || entry.cleanup?.runtimeRemovals?.['previous-runtime']) return true
  const path = join(entry.destination, 'node_modules')
  if (await ownsRuntime(path, record.runtime)) {
    const actual = await legacyRuntimeDecision(entry, { ...record, runtime: { ...record.runtime, identity: undefined } }, runtimeVersion)
    return actual?.value === decision
  }
  if (!entry.recovery?.plan?.runtimeAllowed) return false
  return !await exists(path) || await ownsRuntime(path, entry.recovery.stagedRuntime && { ...entry.recovery.stagedRuntime, path }) &&
    await runtimeVersion(entry.destination, entry.recovery.plan.runtime)
}

export async function previewRecovery(entry, runtimeVersion) {
  await verifyDestination(entry)
  const journal = entry.recovery
  if (journal.schemaVersion !== 1 || journal.state !== 'applying' || journal.record.mode !== 'copy' ||
      journal.record.destination !== entry.destination || journal.ownership !== entry.ownership ||
      journal.stage && (dirname(journal.stage) !== entry.parent || !basename(journal.stage).startsWith('.bstack-stage-'))) blocked('journal-mismatch', 'Journal does not match the selected installation.')
  const runtimePath = join(entry.destination, 'node_modules')
  if (journal.plan.runtimeAllowed && await exists(runtimePath) && !await ownsRuntime(runtimePath, journal.record.runtime) &&
      !await ownsRuntime(runtimePath, journal.stagedRuntime && { ...journal.stagedRuntime, path: runtimePath })) blocked('runtime-conflict', 'Runtime directory identity changed before recovery.')
  const changes = []
  for (const operation of journal.plan.operations) {
    const actual = await state(entry.destination, operation.path)
    if (actual.hash === operation.proposedHash) continue
    changes.push({ action: actual.hash !== operation.originalHash ? 'preserve' : operation.proposedHash === null ? 'remove' : 'replace',
      path: join(entry.destination, operation.path), hash: operation.proposedHash })
  }
  for (const conflict of journal.plan.conflicts) changes.push({ action: 'preserve', path: join(entry.destination, conflict.path) })
  if (journal.plan.runtimeAllowed && (journal.plan.uninstall ? await exists(join(entry.destination, 'node_modules')) : !await runtimeVersion(entry.destination, journal.plan.runtime))) changes.push({ action: journal.plan.uninstall ? 'runtime-remove' : 'runtime-install', path: join(entry.destination, 'node_modules') })
  changes.push({ action: 'ownership', path: entry.ownership }, { action: 'journal-remove', path: entry.journal })
  return changes
}

export async function inspectInstallation(entry, runtimeVersion, previousReport) {
  let record
  try { record = JSON.parse(await readFile(entry.ownership, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  let journal
  try { journal = JSON.parse(await readFile(entry.journal, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  journal ??= entry.recovery ?? entry.cleanup?.recovery
  const plan = journal?.plan ?? journal?.update?.plan ?? entry.plan
  if (!record && journal && !journal.update && !journal.plan && await exists(entry.destination) &&
      (['activated', 'completed'].includes(journal.state) || !await exists(journal.stage))) record = journal.record
  record ??= entry.cleanup?.record
  if (!record) return { destination: entry.destination, sourceVersion: 'not-installed' }
  const files = {}
  const reportedConflicts = [...(plan?.conflicts ?? []), ...(entry.cleanup?.report.conflicts ?? []), ...(previousReport?.conflicts ?? [])]
  const proposals = new Map(Object.entries(record.files).map(([path, hash]) => [path, { path, ownedHash: hash, proposedHash: hash }]))
  for (const conflict of reportedConflicts.filter(conflict => conflict.path !== 'node_modules')) proposals.set(conflict.path, conflict)
  for (const operation of plan?.operations ?? []) proposals.set(operation.path, operation)
  const conflicts = []
  const fileVersions = { ...Object.fromEntries(Object.keys(record.files).map(path => [path, record.sourceVersion])), ...record.fileVersions }
  for (const path of new Set([...Object.keys(record.files), ...Object.keys(entry.cleanup?.report.files ?? {}),
    ...Object.keys(previousReport?.files ?? {}), ...Object.keys(journal?.record.files ?? {}),
    ...(plan?.operations ?? []).map(operation => operation.path),
    ...reportedConflicts.filter(conflict => conflict.path !== 'node_modules').map(conflict => conflict.path)])) {
    const actual = await state(entry.destination, path)
    if (Object.hasOwn(record.files, path) || actual.hash !== null) files[path] = actual.hash
    const proposal = proposals.get(path)
    if (!proposal || actual.hash === proposal.proposedHash || Object.hasOwn(proposal, 'originalHash') && actual.hash === proposal.originalHash) continue
    let bytes = Buffer.alloc(0)
    if (proposal.proposedHash !== null) {
      const source = entry.sourceFiles.find(file => file.path === path && file.hash === proposal.proposedHash)
      if (source) bytes = source.bytes
      else if (journal?.stage) bytes = await readFile(join(journal.stage, path))
      if (hashBytes(bytes) !== proposal.proposedHash) blocked('staged-package-changed', 'Conflict proposal differs from its recorded hash.')
    }
    conflicts.push(conflictFor(entry, path, actual, proposal.ownedHash ?? null, proposal.proposedHash, bytes))
  }
  for (const operation of plan?.operations ?? []) {
    const actual = await state(entry.destination, operation.path)
    if (actual.hash === operation.proposedHash) {
      if (actual.hash === null) { delete files[operation.path]; delete fileVersions[operation.path] }
      else { files[operation.path] = actual.hash; fileVersions[operation.path] = operation.version }
    }
  }
  const runtimePath = join(entry.destination, 'node_modules')
  let runtimeStat
  try { runtimeStat = await lstat(runtimePath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  let runtime = null
  if (record.runtime || runtimeStat) {
    let version = null
    try { version = JSON.parse(await readFile(join(entry.destination, 'node_modules/lavish-axi/package.json'), 'utf8')).version } catch {}
    const verifiedVersion = version
    const verified = version !== null && await runtimeVersion(entry.destination, version)
    version = null
    try { version = JSON.parse(await readFile(join(entry.destination, 'node_modules/lavish-axi/package.json'), 'utf8')).version } catch {}
    runtime = { path: runtimePath, created: await ownsRuntime(runtimePath, record.runtime),
      version, verified: verified && version === verifiedVersion }
  }
  if (reportedConflicts.some(conflict => conflict.path === 'node_modules')) {
    const decision = await legacyRuntimeDecision(entry, journal?.record ?? record, runtimeVersion)
    conflicts.push({ path: 'node_modules', actualHash: runtime?.version ?? 'absent',
      diff: `Expected runtime ${plan?.runtime ?? record.runtime?.version ?? 'absent'}; found ${runtime?.version ?? 'absent'} (${runtime?.verified ? 'verified' : 'unverified'}).`,
      decision: decision?.decision ?? 'Review runtime ownership and restore the pinned runtime before retrying.' })
  }
  return { destination: entry.destination, files, fileVersions, runtime,
    conflicts,
    backup: journal?.backup ?? previousReport?.backup ?? entry.cleanup?.report.backup,
    sourceVersion: canonicalJSON(files) === canonicalJSON(record.files) && (!runtime || runtime.verified && runtime.version === record.runtime?.version) ? record.sourceVersion : 'mixed' }
}

async function state(destination, path) {
  const target = join(destination, path)
  try {
    // A link is content to preserve, even when its target has the expected bytes.
    const stat = await lstat(target)
    if (!stat.isFile() || await resolvePath(destination, path) !== target) return { hash: 'non-file', bytes: null }
    const bytes = await readFile(target)
    return { hash: hashBytes(bytes), bytes }
  } catch (error) {
    if (error.code === 'ENOENT') return { hash: null, bytes: null }
    if (error instanceof CommandError || error.code === 'ENOTDIR') return { hash: 'non-file', bytes: null }
    throw error
  }
}

function conflictFor(entry, path, actual, original, proposed, bytes) {
  const before = actual.bytes?.toString('utf8').split('\n') ?? []
  const after = proposed === null ? [] : bytes.toString('utf8').split('\n')
  const diff = `--- installed/${path}\n+++ ${proposed === null ? 'removed' : 'source/' + path}\n` +
    `@@ -1,${before.length} +1,${after.length} @@\n` +
    (actual.bytes === null ? `Current: ${actual.hash ?? 'absent'}\n` : before.map(line => '-' + line).join('\n') + '\n') +
    after.map(line => '+' + line).join('\n')
  return { path, actualHash: actual.hash, ownedHash: original, proposedHash: proposed, diff,
    decision: actual.hash === 'non-file' ? 'Restore the owned regular file or review this path before retrying.' : `--replace ${entry.host}:${path}:${actual.hash ?? 'absent'}` }
}

export async function inspectCompletion(entry, files, runtime, runtimeVersion, conflicts = []) {
  const report = await inspectInstallation(entry, runtimeVersion, { conflicts })
  for (const file of files) {
    const actual = await state(entry.destination, file.path)
    if (actual.hash !== null || file.hash !== null) report.files[file.path] = actual.hash
    else delete report.files[file.path]
    if (actual.hash !== file.hash && !report.conflicts.some(conflict => conflict.path === file.path)) {
      report.conflicts.push(conflictFor(entry, file.path, actual, file.ownedHash ?? file.hash, file.hash, file.bytes))
    }
  }
  if (runtime !== null && (!report.runtime?.verified || report.runtime.version !== runtime || !report.runtime.created) &&
      !report.conflicts.some(conflict => conflict.path === 'node_modules')) {
    report.conflicts.push({ path: 'node_modules', actualHash: report.runtime?.version ?? 'absent',
      diff: `Expected runtime ${runtime}; found ${report.runtime?.version ?? 'absent'} (${report.runtime?.verified ? 'verified' : 'unverified'}).`,
      decision: 'Review runtime ownership and restore the pinned runtime before retrying.' })
  }
  if (report.conflicts.length) report.sourceVersion = 'mixed'
  return report
}

export async function planLifecycle(entry, files, version, runtime, selected) {
  await verifyDestination(entry)
  const previous = entry.previous
  const desired = selected.uninstall ? {} : Object.fromEntries(files.map(file => [file.path, file.hash]))
  const operations = []
  const conflicts = []
  for (const path of [...new Set([...Object.keys(previous.files), ...Object.keys(desired)])].sort()) {
    const original = previous.files[path] ?? null
    const proposed = desired[path] ?? null
    const actual = await state(entry.destination, path)
    if (actual.hash === proposed && original === proposed) continue
    if (original === null && proposed === null) continue
    const operation = { path, originalHash: actual.hash, proposedHash: proposed,
      ownedHash: original, version: proposed === null ? null : version }
    if (actual.hash !== original && !(selected.uninstall && actual.hash === null)) {
      const decision = `${entry.host}:${path}:${actual.hash ?? 'absent'}`
      const proposedBytes = files.find(file => file.path === path)?.bytes ?? Buffer.alloc(0)
      const conflict = conflictFor(entry, path, actual, original, proposed, proposedBytes)
      let replace = actual.hash !== 'non-file' && selected.replace?.includes(decision)
      if (!replace && !selected['dry-run'] && process.stdin.isTTY && process.stderr.isTTY && !selected.json && actual.hash !== 'non-file') {
        const prompt = createInterface({ input: process.stdin, output: process.stderr })
        try { replace = (await prompt.question(`${conflict.diff}\n${selected.uninstall || proposed === null ? 'Remove' : 'Replace'} ${entry.host}:${path}? Type yes: `)) === 'yes' } finally { prompt.close() }
      }
      if (!replace) { conflicts.push(conflict); continue }
      operation.backup = actual.bytes !== null
    }
    operations.push(operation)
  }
  const runtimePath = join(entry.destination, 'node_modules')
  let runtimeStat
  try { runtimeStat = await lstat(runtimePath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const runtimeAllowed = !runtimeStat || await ownsRuntime(runtimePath, previous.runtime)
  if (!runtimeAllowed && (!selected.uninstall || previous.runtime?.created)) conflicts.push({ path: 'node_modules', actualHash: 'unowned-runtime', diff: 'Preserve runtime directory whose ownership or type cannot be verified.', decision: entry.runtimeDecision?.decision ?? 'Review runtime ownership before retrying.' })
  return { operations, conflicts, desired, version, runtime, uninstall: Boolean(selected.uninstall),
    runtimeAllowed }
}

async function removeEmpty(directory, files) {
  const directories = new Set([directory])
  for (const path of files) {
    try { if (await resolvePath(directory, path) !== join(directory, path)) continue } catch (error) { if (error instanceof CommandError) continue; throw error }
    let parent = dirname(join(directory, path))
    while (parent !== directory) {
      directories.add(parent)
      parent = dirname(parent)
    }
  }
  for (const path of [...directories].sort((a, b) => b.length - a.length)) {
    try {
      if ((await lstat(path)).isDirectory()) await rmdir(path)
    } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error }
  }
}

async function retained(directory, prefix = '') {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name
    if (entry.isDirectory()) {
      const children = await retained(join(directory, entry.name), path + '/')
      paths.push(...children.length ? children : [path + '/'])
    }
    else paths.push(path)
  }
  return paths.sort()
}

export async function applyLifecycle(entry, plan, stage, runtimeVersion, stagedRuntime) {
  await verifyDestination(entry)
  let journal = entry.recovery
  if (!journal) {
    journal = { schemaVersion: 1, state: 'applying', stage, ownership: entry.ownership, record: entry.previous,
      plan, stagedRuntime, files: { ...entry.previous.files }, fileVersions: { ...Object.fromEntries(Object.keys(entry.previous.files)
        .map(path => [path, entry.previous.sourceVersion])), ...entry.previous.fileVersions } }
    await saveRecovery(entry.journal, journal)
  }
  entry.recovery = journal
  if (!await matchesAcceptedRuntime(entry, journal.record, journal)) blocked('runtime-conflict', 'Accepted runtime contents changed before recovery.')
  const conflicts = []
  for (const conflict of journal.plan.conflicts) {
    if (conflict.path === 'node_modules') conflicts.push(conflict)
    else {
      const actual = await state(entry.destination, conflict.path)
      const bytes = conflict.proposedHash === null ? Buffer.alloc(0) : await readFile(join(journal.stage, conflict.path))
      conflicts.push(conflictFor(entry, conflict.path, actual, conflict.ownedHash, conflict.proposedHash, bytes))
    }
  }
  for (const [index, operation] of journal.plan.operations.entries()) {
    const actual = await state(entry.destination, operation.path)
    if (operation.temporary) {
      const temporary = join(dirname(join(entry.destination, operation.path)), `.bstack-install-${index}.tmp`)
      if (operation.temporary !== temporary) blocked('journal-mismatch', 'Temporary does not match the recorded operation.')
      const pending = await state(entry.destination, relative(entry.destination, temporary))
      if (pending.hash !== null) {
        const proposed = await readFile(join(journal.stage, operation.path))
        if (hashBytes(proposed) !== operation.proposedHash) blocked('staged-package-changed', 'Staged file differs from the recorded plan.')
        if (!pending.bytes || pending.bytes.length > proposed.length || !pending.bytes.equals(proposed.subarray(0, pending.bytes.length))) blocked('temporary-changed', 'Installation temporary contains unrelated bytes.')
        await unlink(temporary)
      }
    }
    // A crash can follow a file rename and precede the journal update.
    if (actual.hash !== operation.proposedHash) {
      if (actual.hash !== operation.originalHash) {
        const bytes = operation.proposedHash === null ? Buffer.alloc(0) : await readFile(join(journal.stage, operation.path))
        conflicts.push(conflictFor(entry, operation.path, actual, operation.ownedHash, operation.proposedHash, bytes))
        continue
      }
      const target = join(entry.destination, operation.path)
      await resolvePath(entry.destination, operation.path, target)
      if (operation.backup) {
        journal.backup ??= await mkdtemp(join(entry.parent, '.bstack-backup-'))
        await saveRecovery(entry.journal, journal)
        const backup = join(journal.backup, operation.path)
        await mkdir(dirname(backup), { recursive: true })
        try { await writeFile(backup, actual.bytes, { flag: 'wx' }) } catch (error) {
          if (error.code !== 'EEXIST') throw error
          const saved = await state(journal.backup, operation.path)
          if (!saved.bytes || saved.bytes.length > actual.bytes.length || !saved.bytes.equals(actual.bytes.subarray(0, saved.bytes.length))) blocked('backup-changed', 'Recorded backup contains unrelated content.')
          if (saved.hash !== actual.hash) {
            if ((await state(entry.destination, operation.path)).hash !== operation.originalHash) blocked('changed-precondition', 'File changed before backup completion.')
            await writeFile(backup, actual.bytes)
          }
        }
      }
      if (operation.proposedHash === null) {
        if ((await state(entry.destination, operation.path)).hash !== actual.hash) blocked('changed-precondition', 'File changed before removal.')
        await unlink(target)
      } else {
        const staged = join(journal.stage, operation.path)
        const proposed = await readFile(staged)
        if (hashBytes(proposed) !== operation.proposedHash) blocked('staged-package-changed', 'Staged file differs from the recorded plan.')
        await mkdir(dirname(target), { recursive: true })
        const temporary = join(dirname(target), `.bstack-install-${index}.tmp`)
        // Temporary files are recorded before creation and verified before reuse.
        if (!operation.temporary) {
          try { await lstat(temporary); blocked('temporary-collision', 'An unrelated installation temporary exists.') } catch (error) { if (error.code !== 'ENOENT') throw error }
          operation.temporary = temporary
          await saveRecovery(entry.journal, journal)
        }
        await copyFile(staged, temporary)
        if ((await state(entry.destination, operation.path)).hash !== actual.hash) blocked('changed-precondition', 'File changed before replacement.')
        await rename(temporary, target)
      }
    }
    if (operation.proposedHash === null) {
      delete journal.files[operation.path]
      delete journal.fileVersions[operation.path]
    } else {
      journal.files[operation.path] = operation.proposedHash
      journal.fileVersions[operation.path] = operation.version
    }
    await saveRecovery(entry.journal, journal)
  }
  let runtime = journal.record.runtime
  if (journal.plan.runtimeAllowed) {
    const target = join(entry.destination, 'node_modules')
    let current
    try { current = await lstat(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
    await verifyDestination(entry)
    const activatedRuntime = journal.stagedRuntime && { ...journal.stagedRuntime, path: target }
    if (current && !await ownsRuntime(target, runtime) && !(await ownsRuntime(target, activatedRuntime) && await runtimeVersion(entry.destination, journal.plan.runtime))) blocked('runtime-conflict', 'Runtime directory identity changed before activation.')
    if (journal.plan.uninstall) {
      if (current) await removeRuntime(entry, target, runtime, journal, 'runtimeRemoval', () => saveRecovery(entry.journal, journal))
      runtime = null
    } else if (!await runtimeVersion(entry.destination, journal.plan.runtime)) {
      const old = join(journal.stage, 'previous-runtime')
      if (!await ownsRuntime(join(journal.stage, 'node_modules'), journal.stagedRuntime)) blocked('runtime-conflict', 'Staged runtime directory identity changed before activation.')
      if (!await runtimeVersion(journal.stage, journal.plan.runtime)) blocked('runtime-conflict', 'Staged pinned runtime changed before activation.')
      if (current && await exists(old)) blocked('runtime-conflict', 'An occupied runtime appeared after the old runtime was saved.')
      await mkdir(entry.destination, { recursive: true })
      // Save the old directory before activating the staged runtime.
      await verifyDestination(entry)
      if (await exists(target) && !await ownsRuntime(target, runtime)) blocked('runtime-conflict', 'Runtime directory identity changed before replacement.')
      try { await lstat(target); await rename(target, old) } catch (error) { if (error.code !== 'ENOENT') throw error }
      await rename(join(journal.stage, 'node_modules'), target)
      runtime = { ...journal.stagedRuntime, path: target }
    } else runtime = await ownsRuntime(target, runtime) ? runtime : activatedRuntime
  }
  const complete = !journal.plan.uninstall && !conflicts.length && canonicalJSON(journal.files) === canonicalJSON(journal.plan.desired) &&
    runtime?.version === journal.plan.runtime
  const record = { ...journal.record, files: journal.files, fileVersions: journal.fileVersions, runtime,
    sourceVersion: complete ? journal.plan.version : journal.plan.uninstall && !Object.keys(journal.files).length && !runtime ? 'uninstalled' : 'mixed' }
  delete record.acceptedAdoption
  await saveRecovery(entry.ownership, record)
  const expected = [
    ...await Promise.all(Object.entries(journal.plan.desired).map(async ([path, hash]) => {
      const bytes = await readFile(join(journal.stage, path))
      if (hashBytes(bytes) !== hash) blocked('staged-package-changed', 'Staged file differs from the recorded plan.')
      return { path, hash, bytes }
    })),
    ...Object.keys(journal.record.files).filter(path => !Object.hasOwn(journal.plan.desired, path))
      .map(path => ({ path, hash: null, bytes: Buffer.alloc(0), ownedHash: journal.record.files[path] }))
  ]
  const report = { ...await inspectCompletion(entry, expected, journal.plan.uninstall ? null : journal.plan.runtime, runtimeVersion, conflicts), backup: journal.backup }
  for (const conflict of report.conflicts) {
    if (conflict.path !== 'node_modules' && !Object.hasOwn(record.files, conflict.path) && conflict.ownedHash !== null) {
      record.files[conflict.path] = conflict.ownedHash
      record.fileVersions[conflict.path] = journal.record.fileVersions?.[conflict.path] ?? journal.record.sourceVersion
      report.fileVersions[conflict.path] = record.fileVersions[conflict.path]
    }
  }
  record.sourceVersion = report.sourceVersion
  await saveRecovery(entry.ownership, record)
  if (journal.plan.uninstall) {
    await removeEmpty(entry.destination, Object.keys(journal.record.files))
    try { report.retained = await retained(entry.destination) } catch (error) { if (error.code !== 'ENOENT') throw error; report.retained = [] }
  }
  return report
}

export async function finishLifecycle(entry, report, runtimeVersion) {
  await verifyDestination(entry)
  const journal = entry.recovery
  const record = entry.cleanup.record
  await verifyCleanup(entry, runtimeVersion)
  if (!record) return
  if (!await matchesAcceptedRuntime(entry, journal?.record ?? record, journal)) blocked('runtime-conflict', 'Accepted runtime contents changed before cleanup.')
  if (journal?.plan?.uninstall && !Object.keys(record.files).length && !record.runtime) {
    if (await exists(entry.ownership)) await unlink(entry.ownership)
  }
  else if (record.acceptedAdoption) {
    const saved = { ...record }
    delete saved.acceptedAdoption
    await saveRecovery(entry.ownership, saved)
  }
  if (journal?.plan && journal.stage) {
    for (const [name, owned] of [['node_modules', journal.stagedRuntime], ['previous-runtime', journal.record.runtime]]) {
      const path = join(journal.stage, name)
      if (name === 'previous-runtime' && !await matchesAcceptedRuntime(entry, journal.record, journal)) blocked('runtime-conflict', 'Accepted runtime contents changed before cleanup.')
      if (entry.cleanup.runtimeRemovals?.[name] || owned && await ownsRuntime(path, { ...owned, path })) {
        entry.cleanup.runtimeRemovals ??= {}
        await removeRuntime(entry, path, owned, entry.cleanup.runtimeRemovals, name, entry.saveCleanup)
      }
    }
    for (const [path, hash] of Object.entries(journal.plan.desired)) {
      if ((await state(journal.stage, path)).hash === hash) await unlink(join(journal.stage, path))
    }
    if (await exists(journal.stage)) await removeEmpty(journal.stage, Object.keys(journal.plan.desired))
    if (await exists(journal.stage)) report.retainedStage = journal.stage
  }
  if (journal && await exists(entry.journal)) await unlink(entry.journal)
}

export async function verifyCleanup(entry, runtimeVersion) {
  await verifyDestination(entry)
  const journal = entry.recovery
  if (journal && (journal.schemaVersion !== 1 || journal.ownership !== entry.ownership || journal.record.destination !== entry.destination ||
      journal.stage && (dirname(journal.stage) !== entry.parent || !basename(journal.stage).startsWith('.bstack-stage-')))) blocked('journal-mismatch', 'Cleanup journal paths do not match the selected installation.')
  const { record, report } = entry.cleanup
  const retiredOwnership = entry.recovery?.plan?.uninstall && !Object.keys(record.files).length && !record.runtime
  if (record && !retiredOwnership && !await exists(entry.ownership)) blocked('cleanup-conflict', 'Ownership disappeared before cleanup.')
  const paths = new Set([...Object.keys(entry.recovery?.record.files ?? {}), ...Object.keys(entry.recovery?.plan?.desired ?? {}), ...Object.keys(report.files ?? {})])
  for (const path of paths) {
    if ((await state(entry.destination, path)).hash !== (report.files[path] ?? null)) blocked('cleanup-conflict', `Installed file changed before cleanup: ${path}`)
  }
  const runtime = join(entry.destination, 'node_modules')
  if (report.runtime?.created ? !await ownsRuntime(runtime, record.runtime) : !report.runtime && await exists(runtime)) blocked('runtime-conflict', 'Installed runtime changed before cleanup.')
  if (report.runtime?.verified && !await runtimeVersion(entry.destination, report.runtime.version)) blocked('runtime-conflict', 'Installed runtime version changed before cleanup.')
}

export async function resumeCopy(entry, files, runtime, checkPackage, runtimeVersion, selected, child) {
  await verifyDestination(entry)
  const journal = entry.recovery
  if (journal.record.destination !== entry.destination || journal.ownership !== entry.ownership ||
      dirname(journal.stage) !== entry.parent || !basename(journal.stage).startsWith('.bstack-stage-')) blocked('journal-mismatch', 'Journal paths do not match the selected installation.')
  const hashes = Object.fromEntries(files.map(file => [file.path, file.hash]))
  if (canonicalJSON(journal.record.files) !== canonicalJSON(hashes) || journal.record.runtime.version !== runtime) blocked('journal-source-changed', 'Resume requires the original source package and pinned runtime.')
  const activated = ['activated', 'completed'].includes(journal.state) || !await exists(journal.stage)
  const directory = activated ? entry.destination : journal.stage
  for (const file of files) {
    const actual = await state(directory, file.path)
    if (actual.hash === file.hash) continue
    if (!activated && journal.state === 'staging' && (actual.hash === null || actual.bytes && actual.bytes.length < file.bytes.length && actual.bytes.equals(file.bytes.subarray(0, actual.bytes.length)))) {
      if (!selected['dry-run']) {
        const target = await resolvePath(directory, file.path)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, file.bytes, { flag: actual.hash === null ? 'wx' : 'w', mode: file.mode })
      }
    } else blocked('recovery-conflict', `Recovery file differs from its recorded hash: ${file.path}`)
  }
  if (selected['dry-run']) return { destination: entry.destination, sourceVersion: journal.record.sourceVersion, resume: journal.state }
  if (!await runtimeVersion(directory, runtime)) {
    if (activated || journal.state !== 'staging') blocked('pending-recovery', 'Recorded runtime differs from the prepared runtime.')
    const result = await child(directory, 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'])
    journal.runtimeResult = result
    await saveRecovery(entry.journal, journal)
    if (result.status !== 'passed') throw new CommandError(result.status, [{ code: 'runtime-install-failed', message: 'Pinned runtime installation failed during resume.', fix: 'Inspect the preserved stage and retry after restoring the runtime prerequisite.' }])
  }
  for (const file of files) if ((await state(directory, file.path)).hash !== file.hash) blocked('staged-package-changed', 'Runtime installation changed an authored file.')
  if (!await runtimeVersion(directory, runtime)) blocked('pending-recovery', 'Runtime installation did not produce the pinned runtime.')
  const problems = await checkPackage(directory)
  if (problems.length) throw new CommandError('blocked', problems)
  if (!journal.record.runtime.identity && !activated) {
    journal.record.runtime.identity = await runtimeIdentity(join(directory, 'node_modules'))
    await saveRecovery(entry.journal, journal)
  }
  if (journal.record.runtime.identity && !await ownsRuntime(join(directory, 'node_modules'), { ...journal.record.runtime, path: join(directory, 'node_modules') })) blocked('runtime-conflict', 'Prepared runtime directory identity changed before recovery.')
  if (journal.update) {
    entry.previous = journal.update.previous
    entry.recovery = null
    return applyLifecycle(entry, journal.update.plan, journal.stage, runtimeVersion, { ...journal.record.runtime, path: join(journal.stage, 'node_modules') })
  }
  if (!activated) {
    await verifyDestination(entry)
    if (await exists(entry.destination) || await exists(entry.ownership)) blocked('recovery-conflict', 'Destination became occupied before activation.')
    await rename(journal.stage, entry.destination)
  }
  await saveRecovery(entry.ownership, journal.record)
  const report = await inspectCompletion(entry, files, runtime, runtimeVersion)
  if (report.conflicts.length) await saveRecovery(entry.ownership, { ...journal.record, fileVersions: report.fileVersions, sourceVersion: 'mixed' })
  return { ...report, resumed: true }
}

async function exists(path) {
  try { await lstat(path); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
