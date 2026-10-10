import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { hashBytes, canonicalJSON } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { resolvePath } from '../skills/repo-audit/scripts/lib/paths.mjs'
import { saveRecovery } from '../skills/repo-audit/scripts/lib/protected-write.mjs'
import { CommandError } from '../skills/repo-audit/scripts/lib/result.mjs'

function blocked(code, message) {
  throw new CommandError('blocked', [{ code, message, fix: 'Preserve the installation and journal. Review the reported paths before retrying.' }])
}

export async function previewRecovery(entry, runtimeVersion) {
  const journal = entry.recovery
  if (journal.schemaVersion !== 1 || journal.state !== 'applying' || journal.record.mode !== 'copy' ||
      journal.record.destination !== entry.destination || journal.ownership !== entry.ownership ||
      journal.stage && (dirname(journal.stage) !== entry.parent || !basename(journal.stage).startsWith('.bstack-stage-'))) blocked('journal-mismatch', 'Journal does not match the selected installation.')
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

export async function inspectInstallation(entry, runtimeVersion) {
  let record
  try { record = JSON.parse(await readFile(entry.ownership, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!record) return { destination: entry.destination, sourceVersion: 'not-installed' }
  const files = {}
  const fileVersions = { ...Object.fromEntries(Object.keys(record.files).map(path => [path, record.sourceVersion])), ...record.fileVersions }
  for (const path of Object.keys(record.files)) files[path] = (await state(entry.destination, path)).hash
  let journal
  try { journal = JSON.parse(await readFile(entry.journal, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  for (const operation of journal?.plan?.operations ?? []) {
    const actual = await state(entry.destination, operation.path)
    if (actual.hash === operation.proposedHash) {
      if (actual.hash === null) { delete files[operation.path]; delete fileVersions[operation.path] }
      else { files[operation.path] = actual.hash; fileVersions[operation.path] = operation.version }
    }
  }
  let runtime = record.runtime
  if (runtime) {
    let version = null
    try { version = JSON.parse(await readFile(join(entry.destination, 'node_modules/lavish-axi/package.json'), 'utf8')).version } catch {}
    runtime = { ...runtime, version, verified: version !== null && await runtimeVersion(entry.destination, version) }
  }
  return { destination: entry.destination, files, fileVersions, runtime,
    sourceVersion: canonicalJSON(files) === canonicalJSON(record.files) && (!runtime || runtime.verified && runtime.version === record.runtime.version) ? record.sourceVersion : 'mixed' }
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

export async function planLifecycle(entry, files, version, runtime, selected) {
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
  const runtimeAllowed = !runtimeStat || Boolean(previous.runtime?.created && previous.runtime.path === runtimePath && runtimeStat.isDirectory() && !runtimeStat.isSymbolicLink())
  if (!runtimeAllowed && (!selected.uninstall || previous.runtime?.created)) conflicts.push({ path: 'node_modules', actualHash: 'unowned-runtime', diff: 'Preserve runtime directory whose ownership or type cannot be verified.', decision: 'Review runtime ownership before retrying.' })
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

export async function applyLifecycle(entry, plan, stage, runtimeVersion) {
  let journal = entry.recovery
  if (!journal) {
    journal = { schemaVersion: 1, state: 'applying', stage, ownership: entry.ownership, record: entry.previous,
      plan, files: { ...entry.previous.files }, fileVersions: { ...Object.fromEntries(Object.keys(entry.previous.files)
        .map(path => [path, entry.previous.sourceVersion])), ...entry.previous.fileVersions } }
    await saveRecovery(entry.journal, journal)
  }
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
          if (error.code !== 'EEXIST' || hashBytes(await readFile(backup)) !== actual.hash) throw error
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
        try {
          const bytes = await readFile(temporary)
          if (bytes.length > proposed.length || !bytes.equals(proposed.subarray(0, bytes.length))) blocked('temporary-changed', 'Installation temporary contains unrelated bytes.')
        } catch (error) { if (error.code !== 'ENOENT') throw error }
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
    if (current && (!current.isDirectory() || current.isSymbolicLink() || !runtime?.created)) blocked('runtime-conflict', 'Runtime ownership or type changed before activation.')
    if (journal.plan.uninstall) {
      if (runtime?.created) await rm(target, { recursive: true, force: true })
      runtime = null
    } else if (!await runtimeVersion(entry.destination, journal.plan.runtime)) {
      const old = join(journal.stage, 'previous-runtime')
      if (!await runtimeVersion(journal.stage, journal.plan.runtime)) blocked('runtime-conflict', 'Staged pinned runtime changed before activation.')
      if (current && await exists(old)) blocked('runtime-conflict', 'An occupied runtime appeared after the old runtime was saved.')
      await mkdir(entry.destination, { recursive: true })
      // Save the old directory before activating the staged runtime.
      journal.runtimeChanging = true
      await saveRecovery(entry.journal, journal)
      try { await lstat(target); await rename(target, old) } catch (error) { if (error.code !== 'ENOENT') throw error }
      await rename(join(journal.stage, 'node_modules'), target)
      runtime = { path: target, created: true, version: journal.plan.runtime }
    } else runtime = { path: target, created: true, version: journal.plan.runtime }
  }
  const actualFiles = {}
  for (const path of Object.keys(journal.files)) actualFiles[path] = (await state(entry.destination, path)).hash
  const complete = !journal.plan.uninstall && !conflicts.length && canonicalJSON(journal.files) === canonicalJSON(journal.plan.desired) &&
    canonicalJSON(actualFiles) === canonicalJSON(journal.plan.desired) && runtime?.version === journal.plan.runtime
  const record = { ...journal.record, files: journal.files, fileVersions: journal.fileVersions, runtime,
    sourceVersion: complete ? journal.plan.version : journal.plan.uninstall && !Object.keys(journal.files).length && !runtime ? 'uninstalled' : 'mixed' }
  await saveRecovery(entry.ownership, record)
  const report = { destination: entry.destination, sourceVersion: record.sourceVersion, files: actualFiles,
    fileVersions: record.fileVersions, runtime, conflicts, backup: journal.backup }
  if (journal.plan.uninstall) {
    await removeEmpty(entry.destination, Object.keys(journal.record.files))
    try { report.retained = await retained(entry.destination) } catch (error) { if (error.code !== 'ENOENT') throw error; report.retained = [] }
    if (!Object.keys(record.files).length && !runtime) await unlink(entry.ownership)
  }
  await unlink(entry.journal)
  if (journal.stage) {
    for (const [path, hash] of Object.entries(journal.plan.desired)) {
      if ((await state(journal.stage, path)).hash === hash) await unlink(join(journal.stage, path))
    }
    for (const name of ['node_modules', 'previous-runtime']) await rm(join(journal.stage, name), { recursive: true, force: true })
    await removeEmpty(journal.stage, Object.keys(journal.plan.desired))
    if (await exists(journal.stage)) report.retainedStage = journal.stage
  }
  return report
}

export async function resumeCopy(entry, files, runtime, checkPackage, runtimeVersion, selected, child) {
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
  if (journal.update) {
    entry.previous = journal.update.previous
    entry.recovery = null
    return applyLifecycle(entry, journal.update.plan, journal.stage, runtimeVersion)
  }
  if (!activated) {
    if (await exists(entry.destination) || await exists(entry.ownership)) blocked('recovery-conflict', 'Destination became occupied before activation.')
    await rename(journal.stage, entry.destination)
  }
  await saveRecovery(entry.ownership, journal.record)
  await unlink(entry.journal)
  return { destination: entry.destination, sourceVersion: journal.record.sourceVersion, resumed: true }
}

async function exists(path) {
  try { await lstat(path); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
