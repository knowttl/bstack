import fs from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import child from 'node:child_process'
import { join } from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

// Fault injection stays at real filesystem and child-process boundaries.
const fault = process.env.BSTACK_TEST_FAULT
// The selected destination is disposable and never the source checkout.
const destination = process.env.BSTACK_TEST_DESTINATION
const nativeMkdir = fs.mkdir
const nativeRename = fs.rename
const nativeSpawnSync = child.spawnSync
fs.mkdir = async (...args) => {
  const result = await nativeMkdir(...args)
  if (fault === 'directory' && args[0] === destination) process.exit(91)
  return result
}
fs.rename = async (...args) => {
  if (fault === 'setup' && args[1].endsWith('creation.json')) {
    const value = JSON.parse(await fs.readFile(args[0], 'utf8'))
    if (value.commands?.[0]?.status === 'passed') process.exit(91)
  }
  const result = await nativeRename(...args)
  if (fault === 'file' && args[1] === join(destination, 'VISION.md')) process.exit(91)
  return result
}
child.spawnSync = (...args) => {
  if (fault === 'partial-git' && args[0] === 'git' && args[1].includes('init')) {
    mkdirSync(join(destination, '.git'))
    process.exit(91)
  }
  const result = nativeSpawnSync(...args)
  if (fault === 'git' && args[0] === 'git' && args[1].includes('init')) process.exit(91)
  return result
}
syncBuiltinESMExports()
