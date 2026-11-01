import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

if (process.argv[2] === '--version') {
  console.log('tree-fixture 1')
} else {
  const child = spawn(process.execPath, ['-e', 'console.log("ready"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'inherit'] })
  child.stdout.once('data', () => {
    writeFileSync(join(process.argv[2], 'pids.json'), JSON.stringify([process.pid, child.pid]))
    writeFileSync(join(process.argv[2], 'ready'), '')
  })
  setInterval(() => {}, 1000)
}
