import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'

const destination = process.env.BSTACK_TEST_DESTINATION
const writeFile = fs.writeFile
const rename = fs.rename
fs.writeFile = async (path, bytes, options) => {
  if (process.env.BSTACK_TEST_FAULT === 'write' && (path === destination || path.startsWith(`${destination}.`))) {
    await writeFile(path, bytes.slice(0, 12), options)
    throw Object.assign(new Error('Injected full disk'), { code: 'ENOSPC' })
  }
  return writeFile(path, bytes, options)
}
fs.rename = async (source, target) => {
  if (process.env.BSTACK_TEST_FAULT === 'rename' && target === destination) {
    throw Object.assign(new Error('Injected replacement failure'), { code: 'EACCES' })
  }
  return rename(source, target)
}
syncBuiltinESMExports()
