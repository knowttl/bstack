// Replace only the host capacity boundary for evaluation command tests.
import fs from 'node:fs'
import os from 'node:os'
import { syncBuiltinESMExports } from 'node:module'
import { join } from 'node:path'

// Each disposable test directory owns its host capacity override.
const path = join(process.env.TEST_DOCKER_STATE, 'capacity.json')
// Defaults exercise the exact startup thresholds independently of host load.
const capacity = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : { disk: 20_000_000_000, memory: 24 * 1024 ** 3 }
// Preserve ordinary file reads while replacing Linux's memory boundary.
const readFile = fs.promises.readFile
fs.promises.statfs = async () => ({ bavail: capacity.disk, bsize: 1 })
fs.promises.readFile = async (path, ...args) => path === '/proc/meminfo'
  ? `MemAvailable: ${capacity.memory / 1024} kB\n` : readFile(path, ...args)
os.freemem = () => capacity.memory
syncBuiltinESMExports()
