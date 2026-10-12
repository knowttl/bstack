import fs from 'node:fs'
import { basename } from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

const writeFile = fs.promises.writeFile
fs.promises.writeFile = async (path, bytes, ...args) => {
  const result = await writeFile(path, bytes, ...args)
  if (basename(path) === 'run.json' && JSON.parse(bytes).isolation?.cleanedAt) process.exit(0)
  return result
}
syncBuiltinESMExports()
