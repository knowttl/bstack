import { chmod, copyFile, cp, mkdir, mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir, tmpdir, userInfo } from 'node:os'
import { execFileSync } from 'node:child_process'
import { root, text, object, array, readJSON, fail } from './evaluation.mjs'
import { validateData } from '../../skills/repo-audit/scripts/lib/schema.mjs'
import { resolvePath } from '../../skills/repo-audit/scripts/lib/paths.mjs'
import { hashBytes, canonicalJSON } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { runCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

export function redactEvidence(content, record) {
  const username = userInfo().username
  const group = process.platform === 'win32' ? username : execFileSync('id', ['-gn'], { encoding: 'utf8' }).trim()
  const replacements = [
    [record?.fixture?.path, '[fixture]'],
    [record?.isolation?.home, '[isolated-home]'],
    [homedir(), '[host-home]'],
    [record?.sessionId, '[identifier]'],
    ...[...content.matchAll(/(?:thread_id|sessionId)\\?":\s*\\?"([^"\\]+)/g)].map(match => [match[1], '[identifier]']),
    ...(record?.caseResults ?? []).map(check => [check.reviewer.trim(), '[redacted: user name]']),
    [username, '[redacted: user name]'],
    [group, '[redacted: user name]']
  ].filter(([value, placeholder]) => value && (placeholder === '[redacted: user name]' ? value !== placeholder : !/^[\[<]/.test(value)))
  const names = replacements.sort((a, b) => b[0].length - a[0].length)
  const scratch = tmpdir().replace(/[\\/]$/, '')
  function redact(value, decoded = false) {
    let serialized
    try { serialized = JSON.parse(value) } catch {}
    if ((serialized !== null && typeof serialized === 'object') || (!decoded && typeof serialized === 'string')) {
      const strings = new Map()
      function walk(node) {
        if (typeof node === 'string') strings.set(node, redact(node, true))
        else if (node !== null && typeof node === 'object') Object.values(node).forEach(walk)
      }
      walk(serialized)
      return value.replace(/"(?:[^"\\\x00-\x1f]|\\.)*"/g, (part, offset) => {
        if (/^\s*:/.test(value.slice(offset + part.length))) return part
        const original = JSON.parse(part)
        const replacement = strings.get(original)
        return replacement === undefined || replacement === original ? part : JSON.stringify(replacement)
      })
    }
    if (/[\r\n]/.test(value)) return value.split(/(\r\n|\r|\n)/).map((part, index) => index % 2 ? part : redact(part, decoded)).join('')
    for (const [name, placeholder] of names) {
      value = value.replace(new RegExp(`(?<![\\p{L}\\p{N}_-])${RegExp.escape(name)}(?![\\p{L}\\p{N}_-])`, 'gu'), () => placeholder)
    }
    value = value.replace(new RegExp(`${RegExp.escape(scratch)}[/\\\\]+[^\\s"'\\\\;<>]+`, 'g'), '[scratch-path]')
      .replace(/(?:\/private)?\/tmp\/[^\s"'\\;<>]+/g, '[scratch-path]')
      .replace(/\/(?:home|Users)\/[^\s/"'\\;<>]+/g, '[host-home]')
    return value.replace(/"(?:[^"\\\x00-\x1f]|\\.)*"/g, part => {
      let original
      try { original = JSON.parse(part) } catch { return part }
      const replacement = redact(original, true)
      return replacement === original ? part : JSON.stringify(replacement)
    })
  }
  return redact(content)
}

export async function readAdapter(path) {
  const adapter = await readJSON(path)
  validateData(object({ schemaVersion: { const: 1 }, executable: text, args: array(text), cwd: { const: '.' },
    versionArgs: array(text), timeoutMs: { type: 'integer' }, outputLimitBytes: { type: 'integer' },
    invocation: object({ agent: text, model: text, explicit: text, protocol: { const: 'codex-exec-jsonl' }, resumeArgs: array(text) }),
    isolation: object({ stateDirectory: { const: '.codex' }, discoveryPaths: array(text), systemDiscoveryPaths: array(text), stagePath: text,
      authentication: { enum: ['none', 'throwaway-codex-login'] } })
  }), adapter)
  if (adapter.timeoutMs < 1 || adapter.timeoutMs > 600000) fail('Adapter timeoutMs must be between 1 and 600000.')
  if (adapter.outputLimitBytes < 1 || adapter.outputLimitBytes > 16777216) fail('Adapter outputLimitBytes must be between 1 and 16777216.')
  if (!adapter.args.includes('{message}') || !adapter.invocation.resumeArgs.includes('{message}') ||
      !adapter.invocation.resumeArgs.includes('{sessionId}')) fail('Adapter requires message and resume session placeholders.')
  for (const args of [adapter.args, adapter.invocation.resumeArgs]) {
    if (!args.includes('--json') || args[args.indexOf('--model') + 1] !== adapter.invocation.model ||
        !args.includes('--ignore-user-config') || !args.includes('--no-daemon')) fail('Codex turns require JSONL, the declared model, ignored user config and a separate process.')
  }
  if (adapter.args.some(arg => ['resume', '--last', '--ephemeral'].includes(arg))) fail('Opening turns must create a fresh resumable thread.')
  if (canonicalJSON(adapter.isolation.discoveryPaths) !== canonicalJSON(['.agents/skills', '.codex/skills']) ||
      canonicalJSON(adapter.isolation.systemDiscoveryPaths) !== canonicalJSON(['/etc/codex/skills']) ||
      adapter.isolation.stagePath !== '.agents/skills/repo-audit') fail('Use the documented Codex discovery paths and staging destination.')
  return adapter
}

async function files(directory) {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const result = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    if (entry.isSymbolicLink()) fail(`Cannot verify discovery through a symbolic link: ${path}. Use the manual procedure.`)
    if (entry.isDirectory()) result.push(...await files(path))
    else if (entry.isFile()) result.push(path)
  }
  return result
}

async function snapshot(directory) {
  return hashBytes(canonicalJSON(await Promise.all((await files(directory)).map(async path =>
    [path.slice(directory.length), hashBytes(await readFile(path))]))))
}

export async function isolate(record) {
  const { adapter, fixture, mode } = record
  const home = await realpath(await mkdtemp(join(tmpdir(), 'bstack-agent-')))
  await chmod(home, 0o700)
  await mkdir(join(home, adapter.isolation.stateDirectory), { mode: 0o700 })
  await mkdir(join(home, 'cache'))
  const discoveryPaths = adapter.isolation.discoveryPaths.map(path => join(home, path))
  // Non-Git idea fixtures may cause host discovery to walk to the filesystem root.
  let parent = await realpath(fixture.path)
  for (;;) {
    discoveryPaths.push(join(parent, '.agents', 'skills'), join(parent, '.codex', 'skills'))
    if (dirname(parent) === parent) break
    parent = dirname(parent)
  }
  discoveryPaths.push(...adapter.isolation.systemDiscoveryPaths)
  const stagedPath = await resolvePath(home, adapter.isolation.stagePath)
  const isolation = record.isolation = { home, state: join(home, adapter.isolation.stateDirectory), discoveryPaths: [...new Set(discoveryPaths)],
    stagedPath, skillHash: null, verified: false, method: 'Fresh HOME, CODEX_HOME and cache, fresh exec thread and discovery inventory.' }
  await verifyIsolation(isolation, 'without')
  if (mode === 'with') {
    await cp(join(root, 'skills', 'repo-audit'), stagedPath, { recursive: true, dereference: true })
    isolation.skillHash = await snapshot(stagedPath)
  }
  await verifyIsolation(isolation, mode)
}

export async function verifyIsolation(isolation, mode) {
  isolation.verified = false
  const discovered = []
  for (const directory of isolation.discoveryPaths) {
    for (const path of await files(directory)) {
      if (!path.endsWith('SKILL.md')) continue
      const content = await readFile(path, 'utf8')
      if (/^name:\s*["']?repo-audit["']?\s*$/m.test(content)) discovered.push(path)
    }
  }
  isolation.discovered = [...new Set(discovered)]
  const expected = mode === 'with' ? [join(isolation.stagedPath, 'SKILL.md')] : []
  if (canonicalJSON(isolation.discovered.sort()) !== canonicalJSON(expected) ||
      (mode === 'with' && await snapshot(isolation.stagedPath) !== isolation.skillHash)) fail('Host isolation changed or repo-audit discovery does not match the run mode. Restore the isolated fixture and skill before scoring.')
  isolation.verified = true
  isolation.checkedAt = new Date().toISOString()
}

export async function hostTurn(record, message) {
  if (record.isolation.cleanedAt) fail('This conversation is closed. Create a fresh run.')
  await verifyIsolation(record.isolation, record.mode)
  const home = record.isolation.home
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: record.isolation.state,
    XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache'), LOCALAPPDATA: join(home, 'cache') }
  const template = record.sessionId ? record.adapter.invocation.resumeArgs : record.adapter.args
  const args = template.map(arg => arg === '{message}' ? message : arg === '{sessionId}' ? record.sessionId : arg)
  let result
  const login = join(record.isolation.state, 'auth.json')
  try {
    if (record.adapter.isolation.authentication === 'throwaway-codex-login') {
      await copyFile(join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'auth.json'), login, constants.COPYFILE_EXCL)
      await chmod(login, 0o600)
      record.authenticatedVia = 'throwaway copy'
    }
    result = await runCommand({ root: record.fixture.path }, { ...record.adapter, args }, { env, outputLimitBytes: record.adapter.outputLimitBytes })
  } finally {
    // The login copy exists only during a host turn, including its timeout cleanup.
    if (record.adapter.isolation.authentication === 'throwaway-codex-login') await rm(login, { force: true })
  }
  record.tools.agent = result.toolVersion.stdout.trim()
  const turn = { message, result, sessionId: null }
  record.turns.push(turn)
  if (result.status !== 'passed' || result.outputTruncated) fail(`Host turn unavailable or incomplete (${result.error ?? result.exitCode}). Follow the manual procedure.`, 'blocked')
  const events = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line))
  const sessions = events.filter(event => event.type === 'thread.started').map(event => event.thread_id)
  if (sessions.length !== 1 || typeof sessions[0] !== 'string' || !sessions[0] ||
      (record.sessionId && sessions[0] !== record.sessionId) || !events.some(event => event.type === 'turn.completed') ||
      events.some(event => ['turn.failed', 'error'].includes(event.type))) fail('Host did not complete a turn in the expected conversation. Follow the manual procedure.')
  await verifyIsolation(record.isolation, record.mode)
  record.sessionId = sessions[0]
  turn.sessionId = record.sessionId
}

export async function closeHost(record, directory) {
  if (record.isolation.cleanedAt) return
  try {
    await verifyIsolation(record.isolation, record.mode)
    if (!record.hostFailure && record.turns.length && record.turns.every(turn => turn.sessionId)) {
      record.conversationHash = hashBytes(await readFile(join(directory, record.conversation)))
    } else record.isolation.verified = false
  } finally {
    await rm(record.isolation.home, { recursive: true, force: true })
    record.isolation.cleanedAt = new Date().toISOString()
  }
}
