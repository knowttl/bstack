import fs from 'node:fs'
import { basename } from 'node:path'
import { syncBuiltinESMExports } from 'node:module'

const writeFile = fs.promises.writeFile
fs.promises.writeFile = async (...args: Parameters<typeof writeFile>) => {
  const [path, bytes] = args
  const result = await writeFile(...args)
  if (basename(path as string) === 'run.json' && JSON.parse((bytes as Buffer).toString('utf8')).isolation?.cleanedAt) process.exit(0)
  return result
}
syncBuiltinESMExports()
