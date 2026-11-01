import childProcess from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'

const inputPath = process.argv[process.argv.indexOf('--input') + 1]
const { cleanupFailure } = JSON.parse(readFileSync(inputPath, 'utf8'))
const spawn: (executable: string, args: readonly string[], options?: childProcess.SpawnOptions) => childProcess.ChildProcess = childProcess.spawn as (executable: string, args: readonly string[], options?: childProcess.SpawnOptions) => childProcess.ChildProcess
Object.defineProperty(process, 'platform', { value: 'win32' })
childProcess.spawn = ((executable: string, args: readonly string[], options?: childProcess.SpawnOptions) => {
  if (executable === 'taskkill') {
    return cleanupFailure.launchError
      ? spawn(join(dirname(inputPath), 'missing-taskkill'), [], options)
      : spawn(process.execPath, ['-e', 'process.exit(1)'], options)
  }
  const child = spawn(executable, args, options)
  if (args![0] !== '--version') {
    writeFileSync(join(dirname(inputPath), 'child-pid'), String(child.pid))
    if (cleanupFailure.killFails) child.kill = () => false
  }
  return child
}) as typeof childProcess.spawn
syncBuiltinESMExports()
