import { copyFile, mkdir, readFile, rm, statfs } from 'node:fs/promises'
import { createServer } from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { loadavg } from 'node:os'
import { join } from 'node:path'
import { root, fail } from './evaluation.mjs'
import { hashBytes } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

const execute = promisify(execFile)

// A mounted pathname socket exposes fresh aggregate resource data without
// exposing host /proc, process arguments or another host filesystem mount.
export async function openHostPreflight(record, env) {
  const directory = join(record.isolation.home, '.evaluation')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const client = join(root, 'tests/eval/container/preflight.mjs')
  env.BSTACK_EVAL_PREFLIGHT = join(directory, 'preflight.mjs')
  env.BSTACK_EVAL_PREFLIGHT_SOCKET = join(directory, 'preflight.sock')
  const clientHash = hashBytes(await readFile(client))
  if (record.resourcePreflight && record.resourcePreflight.clientHash !== clientHash) fail('Host resource preflight client changed during this conversation.')
  await copyFile(client, env.BSTACK_EVAL_PREFLIGHT)
  record.resourcePreflight ??= { source: 'host aggregate', clientHash, checks: [] }
  async function check() {
    const memory = /MemAvailable:\s+(\d+) kB/.exec(await readFile('/proc/meminfo', 'utf8'))
    const disk = await statfs(root)
    const processes = await execute('ps', ['-eo', 'args='], { timeout: 5000, maxBuffer: 16777216 })
    const suites = processes.stdout.split('\n').filter(line => /^(?:\S*\/)?node\s/.test(line.trim()) && /\s--test(?:\s|=|$)/.test(line)).length
    const result = { source: 'host', checkedAt: new Date().toISOString(), availableMemoryBytes: Number(memory?.[1]) * 1024,
      freeDiskBytes: disk.bavail * disk.bsize, load1m: loadavg()[0], existingNodeSuites: suites, proposedNodeSuites: 1 }
    result.permitted = result.availableMemoryBytes >= 8_000_000_000 && result.freeDiskBytes >= 20_000_000_000 && result.load1m < 36 && suites + 1 <= 2
    record.resourcePreflight.checks.push(result)
    return result
  }
  if (!(await check()).permitted) fail('Host resource preflight does not permit another Node suite.')
  const server = createServer(async socket => {
    socket.on('error', () => {})
    try { socket.end(JSON.stringify(await check()) + '\n') }
    catch {
      const result = { source: 'host', checkedAt: new Date().toISOString(), permitted: false, error: 'Host resource preflight unavailable.' }
      record.resourcePreflight.checks.push(result)
      socket.end(JSON.stringify(result) + '\n')
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(env.BSTACK_EVAL_PREFLIGHT_SOCKET, resolve)
  })
  return async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(env.BSTACK_EVAL_PREFLIGHT_SOCKET, { force: true })
  }
}
