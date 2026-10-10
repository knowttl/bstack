import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises'
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
  await collect(path)
  await verifyDestination(entry)
  if (canonicalJSON(identity) !== canonicalJSON(await runtimeIdentity(path))) blocked('runtime-conflict', 'Legacy runtime directory changed during verification.')
  const value = `${entry.host}:${hashBytes(Buffer.from(canonicalJSON({ path, identity, contents })))}`
  return { value, decision: `--adopt-runtime ${value}`, runtime: { ...record.runtime, identity } }
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

export async function inspectInstallation(entry, runtimeVersion) {
  let record
  try { record = JSON.parse(await readFile(entry.ownership, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  let journal
  try { journal = JSON.parse(await readFile(entry.journal, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!record && journal && !journal.update && !journal.plan && await exists(entry.destination) &&
      (['activated', 'completed'].includes(journal.state) || !await exists(journal.stage))) record = journal.record
  if (!record) return { destination: entry.destination, sourceVersion: 'not-installed' }
  const files = {}
  const fileVersions = { ...Object.fromEntries(Object.keys(record.files).map(path => [path, record.sourceVersion])), ...record.fileVersions }
  for (const path of Object.keys(record.files)) files[path] = (await state(entry.destination, path)).hash
  for (const operation of journal?.plan?.operations ?? []) {
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
  return { destination: entry.destination, files, fileVersions, runtime,
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
  const report = await inspectInstallation(entry, runtimeVersion)
  report.conflicts = [...conflicts]
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
      if (current) await rm(target, { recursive: true, force: true })
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
    if (!Object.keys(record.files).length && !runtime) await unlink(entry.ownership)
  }
  await unlink(entry.journal)
  if (journal.stage) {
    for (const [path, hash] of Object.entries(journal.plan.desired)) {
      if ((await state(journal.stage, path)).hash === hash) await unlink(join(journal.stage, path))
    }
    for (const [name, owned] of [['node_modules', journal.stagedRuntime], ['previous-runtime', journal.record.runtime]]) {
      const path = join(journal.stage, name)
      if (owned && await ownsRuntime(path, { ...owned, path })) await rm(path, { recursive: true, force: true })
    }
    await removeEmpty(journal.stage, Object.keys(journal.plan.desired))
    if (await exists(journal.stage)) report.retainedStage = journal.stage
  }
  return report
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
  await unlink(entry.journal)
  return { ...report, resumed: true }
}

async function exists(path) {
  try { await lstat(path); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
