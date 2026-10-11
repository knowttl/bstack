import { access, readdir, readFile, realpath } from 'node:fs/promises'
import { constants } from 'node:fs'
import { delimiter, isAbsolute, join, parse, resolve, sep } from 'node:path'
import { parse as parseJavaScript } from 'acorn'
import { fail } from './evaluation.mjs'

// Version the observed-scope contract so older runs cannot form a guarded pair.
export const scopeVersion = 2

export function scopeMessage(record, message) {
  return `Evaluation filesystem scope: work only inside ${record.fixture.path} and ${record.isolation.home}.
Use the isolated home's tmp directory for scratch, clones, reports and servers; TMPDIR points there.
Do not search or read the host home, ancestor directories, other projects or other skill installations.
If requested resources are absent from these two roots, report them unavailable and stop dependent work.
Installed tool executables and their runtime resources may run normally; do not use their locations to discover project guidance.
Pass this scope to any subagents. Out-of-scope paths observed in commands or their output invalidate this evaluation.

${message}`
}

async function toolPaths(record) {
  const paths = new Set([process.execPath])
  for (const name of ['node', 'npm', 'npx', 'git', 'rg', 'sh', 'bash', 'zsh', 'python3',
    'chrome-devtools-axi', 'lavish-axi', record.adapter.executable]) {
    for (const directory of (process.env.PATH ?? '').split(delimiter)) {
      const path = isAbsolute(name) ? name : resolve(directory, name)
      try {
        await access(path, constants.X_OK)
        paths.add(path)
        paths.add(await realpath(path))
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) throw error
      }
    }
  }
  return paths
}

async function sessionTools(directory) {
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
  const values = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) values.push(...await sessionTools(path))
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      for (const line of (await readFile(path, 'utf8')).trim().split('\n')) {
        if (!line) continue
        const event = JSON.parse(line)
        const payload = event.payload
        if (event.type === 'response_item' && ['custom_tool_call', 'custom_tool_call_output',
          'function_call', 'function_call_output'].includes(payload?.type)) {
          const input = payload.input ?? payload.arguments
          if (input) {
            values.push(...strings(input))
            values.push(...commands(input))
          } else values.push(...strings(payload.output ?? ''))
        }
      }
    }
  }
  return values
}

function strings(value, command = false, cwd) {
  if (typeof value === 'string') {
    try { return strings(JSON.parse(value), command, cwd) } catch { return [{ value, command, cwd }] }
  }
  if (value !== null && typeof value === 'object') return Object.entries(value)
    .filter(([key, item]) => !(typeof item === 'string' && /^\/root(?:\/|$)/.test(item) &&
      ['task_name', 'agent_name', 'target', 'author', 'recipient'].includes(key)))
    .flatMap(([key, item]) => strings(item, ['command', 'cmd'].includes(key), value.workdir ?? value.cwd ?? cwd))
  return []
}

// Native tool inputs can be JavaScript that calls the shell tool. Only concrete
// shell commands have a working directory; relative paths in source output do not.
function commands(input) {
  const found = []
  let program
  try { program = parseJavaScript(input, { ecmaVersion: 'latest', sourceType: 'module' }) }
  catch { return [] }
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'ObjectExpression') {
      const fields = Object.fromEntries(node.properties.filter(property => property.type === 'Property')
        .map(property => [property.key.name ?? property.key.value, property.value.value]))
      if (typeof fields.cmd === 'string') found.push({ value: fields.cmd, command: true, cwd: fields.workdir ?? fields.cwd })
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(program)
  return found
}

export async function checkScope(record, result) {
  const roots = [record.fixture.path, record.isolation.home].map(path => resolve(path))
  const tools = await toolPaths(record)
  // System runtime files and read-only resource probes are not project guidance.
  const runtime = ['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/lib', '/usr/lib64',
    '/usr/share', '/lib', '/lib64', '/nix/store', '/dev/null', '/dev/urandom',
    '/proc/meminfo', '/proc/loadavg', '/proc/self', '/proc/sys/kernel', '/etc/os-release']
  const filesystem = parse(roots[0]).root
  const topLevel = new Set(await readdir(filesystem))
  const within = (path, root) => path === root || path.startsWith(root + sep)
  const allowed = path => roots.some(root => within(path, root)) || tools.has(path) ||
    (!/(?:^|[\\/])(?:repo-audit|SKILL\.md)(?:[\\/]|$)/.test(path) && runtime.some(root => within(path, root)))
  const values = [...strings(result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))),
    ...strings(result.stderr), ...await sessionTools(join(record.isolation.state, 'sessions'))]
  const violations = new Set()
  for (const { value, command, cwd } of values) {
    // URLs and domain routes are not filesystem observations.
    let content = value.replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, '').replaceAll('\\ ', ' ')
    for (const root of roots) {
      content = content.replace(new RegExp(`${RegExp.escape(root)}(?=$|[\\/\\s"'\x60<>;,(){}\\[\\]])(?:/[^\\s"'\x60<>;,(){}\\[\\]\\\\]+)?`, 'g'),
        path => allowed(resolve(path)) ? '[in-scope]' : path)
    }
    for (const match of content.matchAll(/(?<![\w./\\])(?:[A-Za-z]:[\\/]|\/)[^\s"'`<>;,(){}\[\]\\]+/g)) {
      const candidate = match[0].replace(/[.:]+$/, '')
      const path = resolve(candidate)
      if ((process.platform === 'win32' || topLevel.has(path.slice(filesystem.length).split(sep)[0])) && !allowed(path)) violations.add(path)
    }
    if (!command) continue
    // A here-document is program source, rather than shell path arguments.
    const shell = content.split(/<<-?\s*['"]?\w+['"]?/)[0]
    for (const match of shell.matchAll(/(?<![\w.])\.\.(?!\.)(?:\/[^\s"'`<>;,(){}\[\]\\]*)?/g)) {
      const path = resolve(cwd ?? record.fixture.path, match[0])
      if (!allowed(path)) violations.add(path)
    }
  }
  record.scopeGuard = { version: scopeVersion, verified: violations.size === 0, paths: [...violations].sort() }
  if (violations.size) fail('Evaluation scope violated: observed filesystem paths outside the fixture, isolated home and approved tool paths. The run remains unscored; inspect scopeGuard.paths and retain the contaminated transcript privately.')
}
