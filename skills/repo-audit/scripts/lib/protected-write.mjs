import { readFile, open, mkdir, rename, unlink, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { scratchDirectory } from './scratch.mjs'
import { resolveFilePath } from './paths.mjs'
import { canonicalJSON, hashBytes } from './fingerprint.mjs'
import { inspectJSON } from './json.mjs'
import { validateData, validateIds } from './schema.mjs'
import { CommandError } from './result.mjs'

export async function fileBytes(path) {
  try { return await readFile(path) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

export async function loadJournal(target, runId) {
  const directory = await scratchDirectory(target, runId)
  const bytes = await fileBytes(join(directory, 'journal.json'))
  if (bytes === null) return { directory, journal: null }
  const journal = inspectJSON(bytes.toString('utf8')).value
  validateData(JSON.parse(await readFile(new URL('../../schemas/resume-state.schema.json', import.meta.url), 'utf8')), journal)
  validateIds(journal.edits, '$/edits')
  if (journal.runId !== runId || journal.target.root !== target.root || journal.target.mode !== target.mode) {
    throw new CommandError('blocked', [{ code: 'journal-mismatch', message: 'Journal belongs to a different run or target.', fix: 'Use the original reviewed target and run ID.' }])
  }
  return { directory, journal }
}

export async function inspectJournal(journal) {
  const edits = []
  for (const edit of journal.edits) {
    try {
      const path = await resolveFilePath(journal.target.root, edit.path, edit.resolvedPath, edit.originalHash !== null && edit.proposedHash === null)
      const bytes = await fileBytes(path)
      const actualHash = bytes === null ? null : hashBytes(bytes)
      const state = actualHash === edit.proposedHash ? 'applied' : !edit.completed && actualHash === edit.originalHash ? 'pending' : 'conflicting'
      edits.push({ ...edit, actualHash, state })
    } catch (error) {
      edits.push({ ...edit, state: 'conflicting', problem: error.message })
    }
  }
  return { runId: journal.runId, planDigest: journal.planDigest, edits, affectedChecks: journal.affectedChecks,
    pending: edits.filter(edit => edit.state === 'pending').map(edit => edit.path),
    applied: edits.filter(edit => edit.state === 'applied').map(edit => edit.path),
    conflicting: edits.filter(edit => edit.state === 'conflicting').map(edit => edit.path) }
}

export async function journalOriginal(directory, journal, plan, edit, index) {
  const recorded = journal.edits[index]
  if (journal.planDigest !== plan.planDigest || canonicalJSON(journal.target) !== canonicalJSON(plan.target) || journal.edits.length !== plan.edits.length ||
      !recorded || ['id', 'path', 'originalHash', 'proposedHash'].some(key => recorded[key] !== edit[key]) ||
      recorded.resolvedPath !== plan.reviewedScope.find(entry => entry.path === edit.path)?.resolvedPath ||
      recorded.backup !== (edit.originalHash === null ? null : `original-${index}`)) {
    throw new CommandError('blocked', [{ code: 'journal-mismatch', message: 'Journal does not match the reviewed plan.', fix: 'Use the unchanged reviewed plan or review a new plan.' }])
  }
  const bytes = recorded.backup === null ? null : await fileBytes(join(directory, recorded.backup))
  if ((bytes === null ? null : hashBytes(bytes)) !== edit.originalHash) {
    throw new CommandError('blocked', [{ code: 'backup-mismatch', message: 'Recoverable original is missing or changed.', path: edit.path, fix: 'Restore the original backup before resuming.' }])
  }
  return bytes
}

async function syncDirectory(directory, limitations) {
  let handle
  try {
    handle = await open(directory, 'r')
    await handle.sync()
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM', 'EACCES'].includes(error.code)) throw error
    const message = 'Filesystem does not support directory flushes; durability across power loss is limited.'
    if (!limitations.includes(message)) limitations.push(message)
  } finally { await handle?.close() }
}

async function durableFile(path, bytes, mode) {
  const handle = await open(path, 'wx', mode)
  try {
    await handle.writeFile(bytes)
    if (mode !== undefined) await handle.chmod(mode)
    await handle.sync()
  } finally { await handle.close() }
}

async function durableDirectory(directory, limitations) {
  await mkdir(directory, { recursive: true })
  for (let path = directory; path !== dirname(path); path = dirname(path)) {
    await syncDirectory(dirname(path), limitations)
  }
}

async function replaceFile(path, bytes, mode, limitations, beforeReplace, prepareTemporary) {
  const temporary = join(dirname(path), `.bstack-${randomUUID()}.tmp`)
  try {
    if (prepareTemporary) await prepareTemporary(temporary)
    await durableFile(temporary, bytes, mode)
    if (beforeReplace) await beforeReplace(temporary)
    try { await rename(temporary, path) } catch (error) {
      if (['EXDEV', 'ENOTSUP', 'EPERM', 'EEXIST'].includes(error.code)) {
        throw new CommandError('blocked', [{ code: 'atomic-replacement-unavailable', message: 'Filesystem cannot atomically replace this file. No non-atomic fallback was attempted.', path, fix: 'Use a filesystem supporting same-directory atomic replacement and resume the run.' }])
      }
      throw error
    }
    await syncDirectory(dirname(path), limitations)
  } finally {
    try { await unlink(temporary) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}

export async function saveRecovery(path, value) {
  const limitations = []
  await durableDirectory(dirname(path), limitations)
  await replaceFile(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'), undefined, limitations)
  return limitations
}

export async function applyWrites(target, plan, staged, directory, previous, affectedChecks, guard) {
  const limitations = ['Replacement is atomic per file where supported, never across the whole change set.']
  const journal = previous ?? { schemaVersion: 1, runId: plan.planDigest, target: plan.target, planDigest: plan.planDigest,
    edits: staged.map((edit, index) => ({ id: edit.id, path: edit.path, resolvedPath: edit.resolvedPath, originalHash: edit.originalHash, proposedHash: edit.proposedHash,
      backup: edit.originalHash === null ? null : `original-${index}`, completed: edit.originalHash === edit.proposedHash })), affectedChecks }
  const journalPath = join(directory, 'journal.json')
  const save = () => replaceFile(journalPath, Buffer.from(JSON.stringify(journal, null, 2) + '\n'), undefined, limitations)
  try {
    // Recheck the complete set after staging and before creating or updating the journal.
    let state = await inspectJournal(journal)
    if (state.conflicting.length || (!previous && state.edits.some((edit, index) => edit.actualHash !== staged[index].originalHash))) {
      throw new CommandError('blocked', [{ code: 'changed-precondition', message: 'Target bytes changed before execution.', fix: 'Review the changed files before applying.' }])
    }
    if (previous) {
      const hasUpdates = journal.edits.some((edit, index) => edit.temporary || (!edit.completed && state.edits[index].state === 'applied'))
      for (const [index, recorded] of journal.edits.entries()) {
        if (state.edits[index].state === 'applied') recorded.completed = true
        if (!recorded.temporary) continue
        const path = await resolveFilePath(target.root, recorded.path, recorded.resolvedPath)
        if (dirname(recorded.temporary) !== dirname(path) || !/^\.bstack-[0-9a-f-]{36}\.tmp$/.test(basename(recorded.temporary))) throw new Error('Recovery temporary path differs from its write directory.')
        await resolveFilePath(dirname(path), basename(recorded.temporary), recorded.temporary)
        const bytes = await fileBytes(recorded.temporary)
        const proposed = Buffer.from(staged[index].proposedContent ?? '')
        if (bytes !== null && (bytes.length > proposed.length || !bytes.equals(proposed.subarray(0, bytes.length)))) {
          throw new CommandError('blocked', [{ code: 'user-change', message: 'The recorded temporary contains unrelated bytes.', path: recorded.temporary, fix: 'Preserve and review the changed temporary before resuming.' }])
        }
        if (bytes !== null) {
          await unlink(recorded.temporary)
          await syncDirectory(dirname(recorded.temporary), limitations)
        }
        recorded.temporary = null
      }
      if (hasUpdates) await save()
      if (!state.pending.length) return { ...state, journal: journalPath, outcome: 'already-applied', limitations }
    }
    await durableDirectory(directory, limitations)
    if (!previous) {
      for (const [index, edit] of staged.entries()) {
        if (edit.originalHash !== null) {
          const backup = join(directory, journal.edits[index].backup)
          // An interrupted preparation can leave backups without a journal.
          const existing = await fileBytes(backup)
          if (existing !== null && hashBytes(existing) !== edit.originalHash) throw new Error('Prepared backup differs from the reviewed original.')
          if (existing === null) await replaceFile(backup, edit.originalBytes, undefined, limitations)
        }
      }
      await syncDirectory(directory, limitations)
      await save()
    }
    for (const [index, edit] of staged.entries()) {
      if (guard) await guard()
      state = await inspectJournal(journal)
      if (state.conflicting.length) throw new CommandError('blocked', [{ code: 'user-change', message: 'A user change blocks all remaining writes.', fix: 'Review conflicting target files before continuing.' }])
      if (state.edits[index].state === 'applied') continue
      const path = edit.resolvedPath
      const beforeWrite = async temporary => {
        if (guard) await guard(temporary)
        const current = await inspectJournal(journal)
        const resolved = await resolveFilePath(target.root, edit.path, path)
        const bytes = await fileBytes(resolved)
        if (current.conflicting.length || (bytes === null ? null : hashBytes(bytes)) !== edit.originalHash) {
          throw new CommandError('blocked', [{ code: 'user-change', message: 'A user change blocks all remaining writes.', fix: 'Review conflicting target files before continuing.' }])
        }
      }
      await save()
      if (edit.proposedContent === null) {
        await beforeWrite()
        await unlink(path)
        await syncDirectory(dirname(path), limitations)
      } else {
        await durableDirectory(dirname(path), limitations)
        const mode = edit.originalHash === null ? undefined : (await stat(path)).mode
        await replaceFile(path, Buffer.from(edit.proposedContent), mode, limitations, beforeWrite, async temporary => {
          journal.edits[index].temporary = temporary
          await save()
        })
      }
      journal.edits[index].temporary = null
      journal.edits[index].completed = true
      await save()
    }
    state = await inspectJournal(journal)
    if (state.conflicting.length || state.pending.length) {
      throw new CommandError('blocked', [{ code: 'user-change', message: 'Target changed before execution completed.', fix: 'Review the changed target files before continuing.' }])
    }
    return { ...state, journal: journalPath, outcome: 'applied', limitations }
  } catch (error) {
    let state
    try { state = await inspectJournal(journal) } catch { state = { runId: journal.runId, planDigest: journal.planDigest } }
    return { status: 'blocked', problems: error instanceof CommandError ? error.problems : [{ code: 'write-io-failure', message: error.message,
      fix: 'Restore filesystem access, inspect state show and resume with the unchanged plan.' }], data: { ...state, journal: journalPath, limitations } }
  }
}
