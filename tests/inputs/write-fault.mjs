import fs from 'node:fs/promises'
import { basename } from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

// Faults replace only the filesystem boundary in a separate CLI process.
const fault = process.env.BSTACK_TEST_FAULT
// Keep native operations for all paths outside the selected target boundary.
const nativeRename = fs.rename
// Deletion has its own replacement boundary.
const nativeUnlink = fs.unlink
// Directory flush support varies between real filesystems.
const nativeOpen = fs.open
let replaced = false

async function replacement(operation, args) {
  if (fault === 'before-write') throw Object.assign(new Error('Injected failure before replacement'), { code: 'EIO' })
  if (fault === 'atomic-unavailable') throw Object.assign(new Error('Injected filesystem limitation'), { code: 'ENOTSUP' })
  await operation(...args)
  replaced = true
  if (fault === 'after-replacement') process.exit(91)
}

fs.rename = async (source, destination) => {
  if (destination === process.env.BSTACK_TEST_DESTINATION) return replacement(nativeRename, [source, destination])
  if (basename(destination) === 'journal.json' && replaced && fault === 'before-completion') process.exit(92)
  if (basename(destination) === 'journal.json' && replaced && fault === 'journal-io') throw Object.assign(new Error('Injected journal failure'), { code: 'EIO' })
  return nativeRename(source, destination)
}
fs.unlink = async path => {
  if (path === process.env.BSTACK_TEST_DESTINATION) return replacement(nativeUnlink, [path])
  return nativeUnlink(path)
}
fs.open = async (...args) => {
  const handle = await nativeOpen(...args)
  if (fault === 'directory-flush' && args[1] === 'r') handle.sync = async () => { throw Object.assign(new Error('Unsupported directory flush'), { code: 'EINVAL' }) }
  return handle
}
syncBuiltinESMExports()
