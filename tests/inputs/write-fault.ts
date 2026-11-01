import fs from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

// Faults replace only the filesystem boundary in a separate CLI process.
const fault = process.env.BSTACK_TEST_FAULT!
// Keep native operations for all paths outside the selected target boundary.
const nativeRename = fs.rename
// Deletion has its own replacement boundary.
const nativeUnlink = fs.unlink
// Directory flush support varies between real filesystems.
const nativeOpen = fs.open
const nativeMkdir = fs.mkdir
let replaced = false
let journalWrites = 0
let backupPrepared = false
const unflushedParents = new Set<Parameters<typeof nativeOpen>[0]>()

async function replacement<Args extends unknown[]>(operation: (...args: Args) => Promise<void>, args: Args) {
  if (fault === 'before-write') throw Object.assign(new Error('Injected failure before replacement'), { code: 'EIO' })
  if (fault === 'atomic-unavailable') throw Object.assign(new Error('Injected filesystem limitation'), { code: 'ENOTSUP' })
  await operation(...args)
  replaced = true
  if (fault === 'after-replacement') process.exit(91)
}

fs.rename = async (source, destination) => {
  if (fault === 'directory-order' && unflushedParents.size) throw new Error('Directory entries were not flushed before publication')
  if (destination === process.env.BSTACK_TEST_DESTINATION!) return replacement(nativeRename, [source, destination])
  if (basename(destination as string) === 'journal.json') {
    journalWrites++
    if (fault === 'journal-user-change' && journalWrites === 2) await fs.writeFile(process.env.BSTACK_TEST_DESTINATION!, 'user\n')
    if (fault === 'resolution-user-change' && journalWrites === 2) {
      await nativeUnlink(process.env.BSTACK_TEST_DESTINATION!)
      await fs.symlink('other.txt', process.env.BSTACK_TEST_DESTINATION!)
    }
    if (fault === 'final-user-change' && replaced) await fs.writeFile(process.env.BSTACK_TEST_DESTINATION!, 'user\n')
  }
  if (basename(destination as string) === 'journal.json' && replaced && fault === 'before-completion') process.exit(92)
  if (basename(destination as string) === 'journal.json' && replaced && fault === 'journal-io') throw Object.assign(new Error('Injected journal failure'), { code: 'EIO' })
  return nativeRename(source, destination)
}
fs.unlink = async path => {
  if (path === process.env.BSTACK_TEST_DESTINATION!) return replacement(nativeUnlink, [path])
  return nativeUnlink(path)
}
fs.open = async (...args: Parameters<typeof nativeOpen>) => {
  const handle = await nativeOpen(...args)
  if (['backup-io', 'backup-interruption'].includes(fault) && args[1] === 'wx' && !backupPrepared) {
    backupPrepared = true
    handle.writeFile = async bytes => {
      await handle.write((bytes as Uint8Array).subarray(0, 1))
      if (fault === 'backup-interruption') process.exit(94)
      throw Object.assign(new Error('Injected partial backup failure'), { code: 'EIO' })
    }
  }
  const nativeSync = handle.sync.bind(handle)
  if (fault === 'directory-order' && args[1] === 'r') handle.sync = async () => {
    await nativeSync()
    unflushedParents.delete(args[0])
  }
  if (fault === 'temporary-user-change' && args[1] === 'wx' && dirname(args[0] as string) === dirname(process.env.BSTACK_TEST_DESTINATION!)) {
    handle.sync = async () => {
      await nativeSync()
      await fs.writeFile(process.env.BSTACK_TEST_DESTINATION!, 'user\n')
    }
  }
  if (fault === 'directory-flush' && args[1] === 'r') handle.sync = async () => { throw Object.assign(new Error('Unsupported directory flush'), { code: 'EINVAL' }) }
  return handle
}
fs.mkdir = (async (...args: Parameters<typeof nativeMkdir>) => {
  const first = await nativeMkdir(...args)
  if (fault === 'directory-order' && first !== undefined) {
    for (let path = args[0]; ; path = dirname(path as string)) {
      unflushedParents.add(dirname(path as string))
      if (path === first) break
    }
  }
  return first
}) as typeof nativeMkdir
syncBuiltinESMExports()
