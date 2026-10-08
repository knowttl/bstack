import childProcess from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'

const inputPath = process.argv[process.argv.indexOf('--input') + 1]
const { cleanupFailure } = JSON.parse(readFileSync(inputPath, 'utf8'))
const spawn = childProcess.spawn
Object.defineProperty(process, 'platform', { value: 'win32' })
childProcess.spawn = (executable, args, options) => {
  if (executable === 'taskkill') {
    return cleanupFailure.launchError
      ? spawn(join(dirname(inputPath), 'missing-taskkill'), [], options)
      : spawn(process.execPath, ['-e', 'process.exit(1)'], options)
  }
  const child = spawn(executable, args, options)
  if (args[0] !== '--version') {
    writeFileSync(join(dirname(inputPath), 'child-pid'), String(child.pid))
    if (cleanupFailure.killFails) child.kill = () => false
  }
  return child
}
syncBuiltinESMExports()
