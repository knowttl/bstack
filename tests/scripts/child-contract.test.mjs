import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm, writeFile, readFile, chmod, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import { PassThrough } from 'node:stream'
import { runCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

// Public fixture commands run from a target outside the checkout.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function sandbox(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'bstack child 日本語 $ ')))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

async function invoke(directory, mode, input, preload) {
  const inputPath = join(directory, 'input.json')
  await writeFile(inputPath, JSON.stringify(input))
  const result = spawnSync(process.execPath, [...(preload ? ['--import', preload] : []), join(root, 'tests/inputs/child-contract.mjs'), '--mode', mode,
    '--workspace', directory, '--input', inputPath, '--json'], { cwd: directory, encoding: 'utf8', timeout: 5000 })
  assert.ifError(result.error)
  assert.equal(result.stderr, '')
  return { code: result.status, ...JSON.parse(result.stdout) }
}

function nodeCommand(args, extra = {}) {
  return { executable: 'node', args, cwd: '.', versionArgs: ['--version'], ...extra }
}

test('child commands preserve literal arguments and capture version and both output streams', async t => {
  const directory = await sandbox(t)
  const args = ['spaces here', '日本語', '$HOME', '$(touch injected)', '; touch injected', '"quoted"', "'leaf'", 'le"af"', '%PATH%', '!PATH!', '&echo wrong']
  const result = await invoke(directory, 'run', { command: nodeCommand(['-e',
    'console.log(JSON.stringify(process.argv.slice(1))); console.error("diagnostic")', ...args]) })
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.data.stdout), args)
  assert.equal(result.data.stderr, 'diagnostic\n')
  assert.equal(result.data.toolVersion.stdout.trim(), process.version)
  assert.equal(result.data.exitCode, 0)
  assert.equal(result.data.signal, null)
  assert.equal(result.data.timedOut, false)
  assert.equal(result.data.cancelled, false)
  assert.ok(result.data.durationMs >= 0)
  await assert.rejects(readFile(join(directory, 'injected')), { code: 'ENOENT' })
})

test('direct version probes preserve percent and exclamation argument literals', async t => {
  const directory = await sandbox(t)
  const args = ['%PATH%', '!PATH!', 'prefix%PATH%"suffix', 'prefix!PATH!suffix', "'leaf'", 'le"af"']
  const commandArgs = ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...args]
  const result = await invoke(directory, 'run', { command: nodeCommand(commandArgs, { versionArgs: commandArgs }) })
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.data.stdout), args)
  assert.deepEqual(JSON.parse(result.data.toolVersion.stdout), args)
})

test('child output is bounded to the last 64 KiB per stream', async t => {
  const directory = await sandbox(t)
  const result = await invoke(directory, 'run', { command: nodeCommand(['-e',
    'process.stdout.write("x".repeat(100000) + "END"); process.stderr.write("y".repeat(100000) + "END")']) })
  assert.equal(result.code, 0)
  assert.equal(result.data.stdout, 'x'.repeat(65533) + 'END')
  assert.equal(result.data.stderr, 'y'.repeat(65533) + 'END')
  assert.equal(result.data.outputTruncated, true)
})

test('child environment overrides apply to the version probe and execution without mutating the caller', async t => {
  const directory = await sandbox(t)
  const command = nodeCommand(['-e', 'console.log(process.env.BSTACK_CHILD_STATE)'], {
    versionArgs: ['-e', 'console.log(process.env.BSTACK_CHILD_STATE)']
  })
  const result = await runCommand({ root: directory }, command, { env: { ...process.env, BSTACK_CHILD_STATE: directory } })
  assert.equal(result.stdout.trim(), directory)
  assert.equal(result.toolVersion.stdout.trim(), directory)
  assert.equal(process.env.BSTACK_CHILD_STATE, undefined)
  assert.equal(result.outputTruncated, false)
})

for (const cancelled of [false, true]) {
  test(`${cancelled ? 'cancellation' : 'timeout'} fails and stops the child process tree before returning`, async t => {
    const directory = await sandbox(t)
    const script = join(root, 'tests/inputs/process-tree.mjs')
    const result = await invoke(directory, 'run', {
      command: nodeCommand([script, directory], { versionArgs: [script, '--version'], timeoutMs: cancelled ? 500 : 1 }),
      ...(cancelled ? { cancelDirectory: directory } : { timeoutDirectory: directory })
    })
    assert.equal(result.code, 1)
    assert.equal(result.status, 'failed')
    assert.equal(result.data.cancelled, cancelled)
    assert.equal(result.data.timedOut, !cancelled)
    const pids = JSON.parse(await readFile(join(directory, 'pids.json'), 'utf8'))
    for (const pid of pids) {
      if (process.platform === 'linux') {
        // An orphan may briefly remain as a zombie, but it can no longer execute.
        const state = await readFile(`/proc/${pid}/stat`, 'utf8').catch(error => {
          if (error.code !== 'ENOENT') throw error
          return null
        })
        assert.ok(state === null || state.slice(state.lastIndexOf(')') + 2).startsWith('Z '))
      } else assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
    }
  })
}

for (const cancelled of [false, true]) {
  for (const probe of [false, true]) {
    for (const launchError of [false, true]) {
      test(`Windows cleanup ${launchError ? 'launch error' : 'failure'} blocks ${cancelled ? 'cancelled' : 'timed out'} ${probe ? 'version probe' : 'check'} with inherited pipes`, { timeout: 2000 }, async t => {
        const platform = Object.getOwnPropertyDescriptor(process, 'platform')
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
        t.after(() => {
          Object.defineProperty(process, 'platform', platform)
          t.mock.restoreAll()
          syncBuiltinESMExports()
        })
        const controller = new AbortController()
        let inherited
        let checks = 0
        t.mock.method(childProcess, 'spawn', (executable, args) => {
          const child = new EventEmitter()
          if (executable === 'taskkill') {
            setImmediate(() => launchError ? child.emit('error', new Error('taskkill unavailable')) : child.emit('close', 1))
            return child
          }
          child.pid = 123
          child.exitCode = 0
          child.signalCode = null
          child.stdout = new PassThrough()
          child.stderr = new PassThrough()
          if (args[0] === 'check') checks++
          if (!probe && args[0] === '--version') {
            setImmediate(() => {
              child.stdout.end('fixture 1\n')
              child.stderr.end()
              child.emit('close', 0, null)
            })
          } else {
            inherited = child
            setImmediate(() => {
              child.stdout.write('parent exited\n')
              child.emit('exit', 0, null)
              if (cancelled) controller.abort()
            })
          }
          return child
        })
        syncBuiltinESMExports()
        const result = await runCommand({ root }, nodeCommand(['check'], { timeoutMs: 100 }), { signal: controller.signal })
        assert.equal(result.status, 'blocked')
        assert.equal(result.cancelled, cancelled)
        assert.equal(result.timedOut, !cancelled)
        assert.equal(result.stdout, 'parent exited\n')
        assert.equal(result.exitCode, 0)
        assert.equal(result.error, launchError ? 'taskkill unavailable' : 'Process-tree cleanup failed.')
        assert.equal(inherited.stdout.destroyed, true)
        assert.equal(inherited.stderr.destroyed, true)
        assert.equal(checks, probe ? 0 : 1)
        assert.equal(result.toolVersion.status, probe ? 'blocked' : 'passed')
      })
    }
  }
}

for (const cancelled of [false, true]) {
  for (const probe of [false, true]) {
    for (const launchError of [false, true]) {
      for (const killFails of [false, true]) {
        test(`Windows cleanup ${launchError ? 'launch error' : 'failure'} lets the CLI exit after ${cancelled ? 'cancelling' : 'timing out'} a live ${probe ? 'version probe' : 'check'} when direct termination ${killFails ? 'fails' : 'succeeds'}`, async t => {
          const directory = await sandbox(t)
          const args = ['-e', 'const fs = require("node:fs"); const path = require("node:path"); fs.writeFileSync(path.join(process.argv[1], "ready"), ""); setInterval(() => {}, 1000)', directory]
          try {
            const result = await invoke(directory, 'run', {
              command: nodeCommand(args, { timeoutMs: 500, ...(probe ? { versionArgs: args } : {}) }),
              cleanupFailure: { launchError, killFails },
              ...(cancelled ? { cancelDirectory: directory } : {})
            }, join(root, 'tests/inputs/windows-cleanup.mjs'))
            assert.equal(result.code, 2)
            assert.equal(result.status, 'blocked')
            assert.equal(result.data.cancelled, cancelled)
            assert.equal(result.data.timedOut, !cancelled)
            assert.ok(result.data.error)
            assert.equal(result.data.toolVersion.status, probe ? 'blocked' : 'passed')
            const pid = Number(await readFile(join(directory, 'child-pid'), 'utf8'))
            if (killFails) process.kill(pid, 0)
            else assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
          } finally {
            const pid = Number(await readFile(join(directory, 'child-pid'), 'utf8'))
            try { process.kill(pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
          }
        })
      }
    }
  }
}

test('failed commands and unavailable tools cannot pass', async t => {
  const directory = await sandbox(t)
  const failed = await invoke(directory, 'run', { command: nodeCommand(['-e', 'process.exit(7)']) })
  assert.equal(failed.code, 1)
  assert.equal(failed.data.exitCode, 7)
  const missing = await invoke(directory, 'run', { command: { ...nodeCommand([]), executable: join(directory, 'missing') } })
  assert.equal(missing.code, 2)
  assert.equal(missing.status, 'blocked')
  assert.ok(missing.data.error)
})

test('child working directories reject escape before execution', async t => {
  const directory = await sandbox(t)
  const result = await invoke(directory, 'run', { command: nodeCommand([], { cwd: '..' }) })
  assert.equal(result.code, 3)
  assert.equal(result.problems[0].code, 'unsafe-path')
})

test('Windows npm selection uses Node and a JavaScript CLI with literal arguments', async t => {
  const directory = await sandbox(t)
  const cli = join(directory, 'npm-cli.js')
  await writeFile(cli, '')
  const args = ['ci', '--prefix', '日本語 $; folder']
  const result = await invoke(directory, 'select', { executable: 'npm', args,
    options: { platform: 'win32', node: process.execPath, env: { npm_execpath: cli, PATH: '' } } })
  assert.equal(result.code, 0)
  assert.deepEqual(result.data, { executable: process.execPath, args: [cli, ...args] })
})

for (const [manager, entry] of [['npm', 'npm-cli.js'], ['pnpm', 'pnpm.cjs'], ['yarn', 'yarn.js']]) {
  for (const executable of [manager, `${manager}.cmd`]) {
    test(`Windows ${executable} resolves a PATH launcher to an executable JavaScript CLI`, async t => {
      const directory = await sandbox(t)
      const bin = join(directory, 'bin')
      const node = join(directory, 'node.exe')
      const cli = join(bin, 'node_modules', manager, 'bin', entry)
      await mkdir(dirname(cli), { recursive: true })
      await writeFile(join(bin, `${manager}.cmd`), '@echo off\r\nexit /b 99\r\n')
      await writeFile(cli, 'console.log(JSON.stringify(process.argv.slice(2)))')
      const args = ['--version', '日本語 $; folder', '&echo wrong']
      const result = await invoke(directory, 'select', { executable, args,
        options: { platform: 'win32', node, env: { PATH: bin } } })
      assert.equal(result.code, 0)
      assert.deepEqual(result.data, { executable: node, args: [cli, ...args] })
      const launched = spawnSync(process.execPath, result.data.args, { encoding: 'utf8', shell: false })
      assert.equal(launched.status, 0)
      assert.deepEqual(JSON.parse(launched.stdout), args)
    })
  }
}

for (const executable of ['npm.cmd', 'pnpm', 'pnpm.cmd', 'yarn', 'yarn.cmd', 'tool.cmd', 'tool.bat']) {
  test(`Windows ${executable} without a supported CLI is blocked`, async t => {
    const directory = await sandbox(t)
    const result = await invoke(directory, 'select', { executable, args: [],
      options: { platform: 'win32', node: join(directory, 'node.exe'), env: { PATH: '' } } })
    assert.equal(result.code, 2)
    assert.ok(result.problems[0].fix)
  })
}

test('fingerprints cover exact bytes, absence, mode, repo, base and substantive inputs', async t => {
  const directory = await sandbox(t)
  const path = join(directory, 'file.txt')
  await writeFile(path, 'a\r\n')
  const input = { baseCommit: 'a'.repeat(40), paths: ['absent', 'file.txt'], inputs: { decision: 'yes' } }
  const initial = await invoke(directory, 'fingerprint', input)
  assert.equal(initial.code, 0)
  assert.equal(initial.data.state.files[1].contentHash, createHash('sha256').update('a\r\n').digest('hex'))
  assert.deepEqual(initial.data.state.files[0], { path: 'absent', present: false, mode: null, contentHash: null })
  assert.equal((await invoke(directory, 'fingerprint', input)).data.fingerprint, initial.data.fingerprint)
  await writeFile(path, 'a\n')
  assert.notEqual((await invoke(directory, 'fingerprint', input)).data.fingerprint, initial.data.fingerprint)
  await writeFile(path, 'a\r\n')
  await writeFile(join(directory, 'absent'), '')
  assert.notEqual((await invoke(directory, 'fingerprint', input)).data.fingerprint, initial.data.fingerprint)
  await rm(join(directory, 'absent'))
  if (process.platform !== 'win32') {
    const before = await invoke(directory, 'fingerprint', input)
    await chmod(path, 0o755)
    assert.notEqual((await invoke(directory, 'fingerprint', input)).data.fingerprint, before.data.fingerprint)
  }
  const before = await invoke(directory, 'fingerprint', input)
  assert.notEqual((await invoke(directory, 'fingerprint', { ...input, baseCommit: 'b'.repeat(40) })).data.fingerprint, before.data.fingerprint)
  assert.notEqual((await invoke(directory, 'fingerprint', { ...input, inputs: { decision: 'no' } })).data.fingerprint, before.data.fingerprint)
  const other = await sandbox(t)
  await writeFile(join(other, 'file.txt'), 'a\r\n')
  assert.notEqual((await invoke(other, 'fingerprint', input)).data.fingerprint, before.data.fingerprint)
})

test('canonical assessment inputs ignore only derived fields and evidence serialization', async t => {
  const directory = await sandbox(t)
  const input = { baseCommit: 'a'.repeat(40), paths: ['evidence.json'], evidencePath: 'evidence.json',
    inputs: { z: [{ b: 2, a: 1 }], decision: 'yes', fingerprint: 'old', execution: { status: 'failed' } } }
  await writeFile(join(directory, 'evidence.json'), '{"old":true}')
  const initial = await invoke(directory, 'fingerprint', input)
  await writeFile(join(directory, 'evidence.json'), '{ "new": true }')
  const reordered = { ...input, inputs: { execution: { status: 'passed' }, fingerprint: 'new', decision: 'yes', z: [{ a: 1, b: 2 }] } }
  assert.equal((await invoke(directory, 'fingerprint', reordered)).data.fingerprint, initial.data.fingerprint)
  assert.notEqual((await invoke(directory, 'fingerprint', { ...reordered, inputs: { ...reordered.inputs, decision: 'no' } })).data.fingerprint, initial.data.fingerprint)
  await rm(join(directory, 'evidence.json'))
  assert.notEqual((await invoke(directory, 'fingerprint', reordered)).data.fingerprint, initial.data.fingerprint)
})
