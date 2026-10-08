import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { resolvePath } from './paths.mjs'
import { CommandError } from './result.mjs'

// Keep useful output tails without letting a noisy tool exhaust memory.
const outputLimit = 65536

export async function selectCommand(executable, args, { platform = process.platform, env = process.env, node = process.execPath } = {}) {
  if (executable === 'node') return { executable: node, args }
  if (platform !== 'win32') return { executable, args }
  const manager = /^(npm|pnpm|yarn)(?:\.cmd)?$/i.exec(executable)?.[1].toLowerCase()
  if (manager) {
    const entry = { npm: 'npm-cli.js', pnpm: 'pnpm.cjs', yarn: 'yarn.js' }[manager]
    const candidates = [manager === 'npm' ? env.npm_execpath : undefined,
      join(dirname(node), 'node_modules', manager, 'bin', entry),
      ...(env.PATH || '').split(';').filter(Boolean).map(path => join(path, 'node_modules', manager, 'bin', entry))]
    for (const path of candidates) {
      if (!path || !path.toLowerCase().endsWith(entry)) continue
      try {
        await access(path)
        return { executable: node, args: [path, ...args] }
      } catch {}
    }
    throw new CommandError('blocked', [{ code: `${manager}-cli-unavailable`, message: `The ${manager} JavaScript CLI could not be resolved.`, fix: manager === 'npm' ? 'Install npm alongside Node or set npm_execpath to npm-cli.js.' : `Install ${manager} alongside Node or make its JavaScript CLI available on PATH.` }])
  }
  if (/\.(cmd|bat)$/i.test(executable)) {
    throw new CommandError('blocked', [{ code: 'command-file-unsupported', message: 'Command-file launchers cannot run without a shell.', fix: 'Select the tool executable or its JavaScript entry point with node.' }])
  }
  return { executable, args }
}

export async function runCommand(target, command, { signal, env = process.env, outputLimitBytes = outputLimit } = {}) {
  const timeoutMs = command.timeoutMs ?? 120000
  if (!command.executable || !Array.isArray(command.args) || command.args.some(arg => typeof arg !== 'string') ||
      !Array.isArray(command.versionArgs) || command.versionArgs.some(arg => typeof arg !== 'string') ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(outputLimitBytes) || outputLimitBytes <= 0) {
    throw new CommandError('usage-error', [{ code: 'invalid-command', message: 'A child command requires executable, string args and versionArgs, and a positive timeout.', fix: 'Supply the documented child-command object.' }])
  }
  const cwd = await resolvePath(target.root, command.cwd)
  const selected = await selectCommand(command.executable, command.args, { env })
  const version = await selectCommand(command.executable, command.versionArgs, { env })
  const toolVersion = await capture(version, { cwd, timeoutMs, signal, env, outputLimitBytes })
  if (toolVersion.status !== 'passed') return { ...toolVersion, toolVersion }
  return { ...await capture(selected, { cwd, timeoutMs, signal, env, outputLimitBytes }), toolVersion }
}

async function capture(command, { cwd, timeoutMs, signal, env, outputLimitBytes }) {
  const started = performance.now()
  let stdout = Buffer.alloc(0)
  let stderr = Buffer.alloc(0)
  let timedOut = false
  let cancelled = signal?.aborted ?? false
  let error = null
  let outputTruncated = false
  let cleanup = Promise.resolve()
  if (cancelled) return result(null, null)
  const child = spawn(command.executable, command.args, { cwd, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', chunk => { outputTruncated ||= stdout.length + chunk.length > outputLimitBytes; stdout = Buffer.concat([stdout, chunk]).subarray(-outputLimitBytes) })
  child.stderr.on('data', chunk => { outputTruncated ||= stderr.length + chunk.length > outputLimitBytes; stderr = Buffer.concat([stderr, chunk]).subarray(-outputLimitBytes) })
  child.on('error', failure => { error = failure.message })
  let finish
  const completion = new Promise(resolve => { finish = resolve })
  child.on('close', (code, exitSignal) => finish([code, exitSignal]))
  const cleanupFailed = message => {
    error ??= message
    if (child.exitCode === null && child.signalCode === null && !child.kill('SIGKILL')) child.unref()
    child.stdout.destroy()
    child.stderr.destroy()
    finish([child.exitCode, child.signalCode])
  }
  const stop = () => {
    if (!child.pid) return
    if (process.platform === 'win32') {
      cleanup = new Promise(resolve => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' })
        killer.on('error', failure => { cleanupFailed(failure.message); resolve() })
        killer.on('close', code => { if (code !== 0) cleanupFailed('Process-tree cleanup failed.'); resolve() })
      })
    } else {
      try { process.kill(-child.pid, 'SIGKILL') } catch (failure) { if (failure.code !== 'ESRCH') cleanupFailed(failure.message) }
    }
  }
  const cancel = () => { cancelled = true; stop() }
  const timer = setTimeout(() => { timedOut = true; stop() }, timeoutMs)
  signal?.addEventListener('abort', cancel, { once: true })
  // Cancellation can arrive between the initial check and listener registration.
  if (signal?.aborted) cancel()
  const [exitCode, exitSignal] = await completion
  clearTimeout(timer)
  signal?.removeEventListener('abort', cancel)
  await cleanup
  return result(exitCode, exitSignal)

  function result(exitCode, exitSignal) {
    return { status: error ? 'blocked' : exitCode === 0 && !timedOut && !cancelled ? 'passed' : 'failed',
      stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), durationMs: performance.now() - started,
      exitCode, signal: exitSignal, timedOut, cancelled, outputTruncated, error }
  }
}
