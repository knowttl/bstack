import { lstat, mkdir, mkdtemp, readFile, readlink, realpath, rename, rmdir, symlink, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { canonicalJSON, hashBytes } from '../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { isInside, resolvePath } from '../skills/repo-audit/scripts/lib/paths.mjs'
import { saveRecovery } from '../skills/repo-audit/scripts/lib/protected-write.mjs'
import { CommandError } from '../skills/repo-audit/scripts/lib/result.mjs'
import { runtimeIdentity, ownsRuntime, removeEmpty } from './lifecycle.mjs'

function blocked(code, message) {
  throw new CommandError('blocked', [{ code, message, fix: 'Preserve the source, link and journal. Restore the recorded paths before retrying.' }])
}

async function stat(path) {
  try { return await lstat(path, { bigint: true }) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function record(path) {
  return await stat(path) ? JSON.parse(await readFile(path, 'utf8')) : null
}

async function linkIdentity(path) {
  const info = await stat(path)
  if (!info?.isSymbolicLink()) blocked('changed-link', 'Owned link is missing or replaced by another entry.')
  return { dev: String(info.dev), ino: String(info.ino), birthtimeNs: String(info.birthtimeNs), target: await readlink(path) }
}

async function verifyLink(path, saved) {
  if (canonicalJSON(await linkIdentity(path)) !== canonicalJSON(saved.link)) blocked('changed-link', 'Owned link identity or target changed.')
}

// Link ownership covers the directory entry, never the files reached through it.
export async function installLinks(context) {
  const { root, source, files, hashes, version, runtime, destinations, selected, child, runtimeVersion, checkPackage, authored } = context
  const data = { mode: 'link', sourceVersion: version, preview: Boolean(selected['dry-run']), destinations: [], changes: [], installations: [] }
  const sourceIdentity = selected.uninstall ? null : await runtimeIdentity(source)
  const verifySource = async () => {
    if (canonicalJSON(await runtimeIdentity(source)) !== canonicalJSON(sourceIdentity) ||
        canonicalJSON(Object.fromEntries((await authored(source)).map(file => [file.path, file.hash]))) !== canonicalJSON(hashes)) blocked('journal-source-changed', 'Source identity or authored bytes changed during link installation.')
  }
  if (selected.replace?.length || selected['adopt-runtime']?.length) blocked('link-decision', 'Copy replacement and runtime adoption decisions do not apply to links.')
  if (await stat(join(root, '.bstack-install-cleanup.json'))) blocked('pending-recovery', 'Complete pending copy cleanup before selecting link mode.')
  const parentUnchanged = async entry => {
    if (await resolvePath(root, `.${entry.host}/skills`) !== entry.parent) blocked('changed-destination', 'Link parent changed.')
    for (const path of [entry.ownership, entry.journal]) {
      if (await resolvePath(entry.parent, basename(path)) !== path) blocked('changed-destination', 'Ownership or journal path changed.')
    }
  }
  for (const entry of destinations) {
    if (isInside(source, entry.destination)) blocked('invalid-target', 'A link destination cannot be inside its source skill folder.')
    await parentUnchanged(entry)
    entry.previous = await record(entry.ownership)
    entry.recovery = await record(entry.journal)
    const saved = entry.recovery?.record ?? entry.previous
    if (saved && (saved.schemaVersion !== 1 || saved.mode !== 'link' || saved.destination !== entry.destination || saved.source !== source)) blocked('unowned-collision', 'Ownership does not identify this source and link destination.')
    if (saved && !selected.uninstall && canonicalJSON(saved.sourceIdentity) !== canonicalJSON(sourceIdentity)) blocked('changed-link', 'Source directory identity changed.')
    if (entry.recovery && (entry.recovery.schemaVersion !== 1 || entry.recovery.ownership !== entry.ownership ||
        entry.recovery.uninstall !== Boolean(selected.uninstall))) blocked('pending-recovery', 'Resume the original link operation before changing lifecycle mode.')
    for (const [path, parent] of [[entry.recovery?.runtimeStage, dirname(source)], [entry.recovery?.linkStage, entry.parent]]) {
      if (path && (dirname(path) !== parent || !basename(path).startsWith('.bstack-stage-'))) blocked('journal-mismatch', 'Recorded stage does not match its preparation parent.')
    }
    if (entry.recovery?.runtimeStage && await stat(entry.recovery.runtimeStage) && canonicalJSON(await runtimeIdentity(entry.recovery.runtimeStage)) !== canonicalJSON(entry.recovery.stageIdentity)) blocked('runtime-conflict', 'Runtime preparation stage was replaced.')
    if (entry.recovery && !selected.uninstall && (saved.sourceVersion !== version || canonicalJSON(saved.files) !== canonicalJSON(hashes) || saved.runtime.version !== runtime)) blocked('journal-source-changed', 'Interrupted link installation requires its original source bytes and runtime.')
    const occupied = await stat(entry.destination)
    if (occupied) {
      if (!saved?.link) blocked('unowned-collision', 'Occupied destination is not the recorded owned link.')
      await verifyLink(entry.destination, saved)
      if (!selected.uninstall && await realpath(entry.destination) !== source) blocked('changed-link', 'Link no longer resolves to the source folder.')
    } else if (entry.previous && !entry.recovery?.uninstall) blocked('changed-link', 'Recorded link disappeared.')
    entry.action = selected.uninstall ? saved ? 'unlink' : 'no-op' : entry.recovery ? 'resume-link' : entry.previous ?
      entry.previous.sourceVersion === version && canonicalJSON(entry.previous.files) === canonicalJSON(hashes) ? 'no-op' : 'linked-checkout-update' : 'link'
    data.destinations.push({ host: entry.host, destination: entry.destination, ownership: entry.ownership, journal: entry.journal, action: entry.action })
    if (entry.action !== 'no-op') data.changes.push({ action: selected.uninstall ? 'unlink' : entry.action, path: entry.destination, target: source })
  }
  const ready = selected.uninstall || await runtimeVersion(source, runtime)
  if (!ready) {
    const pending = destinations.find(entry => entry.recovery?.runtime)?.recovery.runtime
    if (await stat(join(source, 'node_modules')) && !await ownsRuntime(join(source, 'node_modules'), pending)) blocked('runtime-conflict', 'Existing source runtime differs from the pin. Prepare it explicitly in the developer checkout.')
    data.changes.unshift({ action: 'source-runtime-install', path: join(source, 'node_modules'), version: runtime })
    for (const entry of destinations.filter(entry => entry.action === 'no-op')) {
      entry.action = 'linked-checkout-update'
      data.destinations.find(destination => destination.destination === entry.destination).action = entry.action
    }
  }
  for (const entry of destinations.filter(entry => entry.action !== 'no-op')) {
    data.changes.push({ action: selected.uninstall ? 'ownership-remove' : 'ownership', path: entry.ownership },
      { action: 'journal', path: entry.journal })
  }
  if (selected['dry-run']) return data
  try {
    for (const entry of destinations) {
      if (entry.action === 'no-op') {
        if (!selected.uninstall) {
          await verifyLink(entry.destination, entry.previous)
          await verifySource()
          data.installations.push({ destination: entry.destination, mode: 'link', sourceVersion: version, target: source, runtime: { version: runtime, verified: true } })
        }
        continue
      }
      await parentUnchanged(entry)
      await mkdir(entry.parent, { recursive: true })
      const journal = entry.recovery ?? { schemaVersion: 1, state: 'staging', ownership: entry.ownership, uninstall: Boolean(selected.uninstall),
        record: selected.uninstall ? entry.previous : { ...entry.previous, schemaVersion: 1, mode: 'link', destination: entry.destination, source, sourceIdentity, sourceVersion: version, files: hashes, runtime: { version: runtime } } }
      entry.recovery = journal
      data.limitations = await saveRecovery(entry.journal, journal)
      if (selected.uninstall) {
        if (await stat(entry.destination)) {
          await verifyLink(entry.destination, journal.record)
          await unlink(entry.destination)
        }
        if (await stat(entry.ownership)) await unlink(entry.ownership)
        await unlink(entry.journal)
        data.installations.push({ destination: entry.destination, mode: 'link', sourceVersion: 'uninstalled', retainedTarget: source })
        continue
      }
      if (!await runtimeVersion(source, runtime)) {
        if (!journal.runtime) {
          if (await stat(join(source, 'node_modules'))) blocked('runtime-conflict', 'Source runtime appeared before preparation.')
          // Failed stages stay available for inspection; retries never erase them.
          const stage = await mkdtemp(join(dirname(source), '.bstack-stage-'))
          journal.runtimeStage = stage
          journal.runtimeStages = [...(journal.runtimeStages ?? entry.previous?.runtimeStages ?? []), stage]
          journal.stageIdentity = await runtimeIdentity(stage)
          await saveRecovery(entry.journal, journal)
          for (const file of files) {
            await mkdir(dirname(join(stage, file.path)), { recursive: true })
            await writeFile(join(stage, file.path), file.bytes, { flag: 'wx', mode: file.mode })
          }
          const result = await child(stage, 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'])
          if (result.status !== 'passed') {
            journal.runtimeResult = result
            await saveRecovery(entry.journal, journal)
            blocked('runtime-install-failed', 'Pinned runtime failed; source and destination have not been activated. Failed stage is retained.')
          }
          if (!await runtimeVersion(stage, runtime) || canonicalJSON(Object.fromEntries((await authored(stage)).map(file => [file.path, file.hash]))) !== canonicalJSON(hashes)) blocked('staged-package-changed', 'Runtime preparation changed the authored package or did not produce the pin.')
          journal.runtime = { path: join(source, 'node_modules'), version: runtime, created: true, identity: await runtimeIdentity(join(stage, 'node_modules')) }
          await saveRecovery(entry.journal, journal)
        }
        if (!await ownsRuntime(join(source, 'node_modules'), journal.runtime)) {
          if (await stat(join(source, 'node_modules'))) blocked('runtime-conflict', 'Source runtime changed before activation.')
          const stageRuntime = join(journal.runtimeStage, 'node_modules')
          if (!await ownsRuntime(stageRuntime, { ...journal.runtime, path: stageRuntime })) blocked('runtime-conflict', 'Prepared runtime identity changed.')
          if (!await runtimeVersion(journal.runtimeStage, runtime)) blocked('runtime-conflict', 'Prepared runtime version changed.')
          await verifySource()
          await rename(stageRuntime, join(source, 'node_modules'))
        }
      }
      await verifySource()
      if (!await runtimeVersion(source, runtime)) blocked('runtime-conflict', 'Source runtime is not the requested pin.')
      const problems = await checkPackage(source)
      if (problems.length) throw new CommandError('blocked', problems)
      await verifySource()
      await parentUnchanged(entry)
      if (!await stat(entry.destination)) {
        if (!journal.linkStage) {
          journal.linkStage = await mkdtemp(join(entry.parent, '.bstack-stage-'))
          await rmdir(journal.linkStage)
          await symlink(source, journal.linkStage, process.platform === 'win32' ? 'junction' : 'dir')
          journal.record.link = await linkIdentity(journal.linkStage)
          await saveRecovery(entry.journal, journal)
        }
        await verifyLink(journal.linkStage, journal.record)
        await rename(journal.linkStage, entry.destination)
      }
      await verifyLink(entry.destination, journal.record)
      journal.record = { ...journal.record, sourceVersion: version, files: hashes,
        ...(journal.runtimeStages ? { runtimeStages: journal.runtimeStages } : {}),
        runtime: { version: runtime, path: join(source, 'node_modules'), created: false } }
      await saveRecovery(entry.ownership, journal.record)
      if (journal.runtimeStage) {
        if (await stat(journal.runtimeStage) && canonicalJSON(await runtimeIdentity(journal.runtimeStage)) !== canonicalJSON(journal.stageIdentity)) blocked('runtime-conflict', 'Runtime stage changed before cleanup.')
        for (const file of files) {
          const path = join(journal.runtimeStage, file.path)
          if ((await stat(path))?.isFile() && await resolvePath(journal.runtimeStage, file.path) === path && hashBytes(await readFile(path)) === file.hash) await unlink(path)
        }
        await removeEmpty(journal.runtimeStage, files.map(file => file.path))
      }
      await unlink(entry.journal)
      data.installations.push({ destination: entry.destination, mode: 'link', sourceVersion: version, target: source, runtime: { version: runtime, verified: true },
        ...(journal.runtimeStage && await stat(journal.runtimeStage) ? { retainedStage: journal.runtimeStage } : {}) })
    }
    return data
  } catch (error) {
    error.data = data
    throw error
  }
}
