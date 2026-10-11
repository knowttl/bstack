import { access, readdir, readFile, realpath } from 'node:fs/promises'
import { constants } from 'node:fs'
import { delimiter, isAbsolute, join, parse, resolve, sep } from 'node:path'
import { parse as parseJavaScript } from 'acorn'
import { fail } from './evaluation.mjs'

// Version the observed-scope contract so older runs cannot form a guarded pair.
export const scopeVersion = 3

export function scopeMessage(record, message) {
  return `Evaluation filesystem scope: work only inside ${record.fixture.path} and ${record.isolation.home}.
Use the isolated home's tmp directory for scratch, clones, reports and servers; TMPDIR points there.
Do not search or read the host home, ancestor directories, other projects or other skill installations.
If requested resources are absent from these two roots, report them unavailable and stop dependent work.
Installed tool executables and their runtime resources may run normally; do not use their locations to discover project guidance.
Read-only memory/load queries, process counts and filesystem capacity queries are allowed for resource preflight.
Use /proc/meminfo, /proc/loadavg, /proc/self and process metadata only for those queries; do not print process inventories.
Keep filesystem writes inside the fixture or isolated home, including its own tmp directory.
Pass this scope to any subagents. Out-of-scope filesystem access targets in commands or file-tool calls invalidate this evaluation; paths merely printed in output do not.

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
        if (event.type === 'response_item' && ['custom_tool_call', 'function_call'].includes(payload?.type)) {
          const input = payload.input ?? payload.arguments
          if (input) values.push(...toolAccess(input, payload.name))
        }
      }
    }
  }
  return values
}

function toolAccess(value, name = '', cwd) {
  if (typeof value === 'string') {
    try { return toolAccess(JSON.parse(value), name, cwd) } catch {}
    if (/apply_patch$/.test(name)) return [...value.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)]
      .map(match => ({ value: match[1], write: true, cwd }))
    if (/(?:^|[._])exec$/.test(name)) {
      try {
        const found = commands(parseJavaScript(value, { ecmaVersion: 'latest', sourceType: 'module' }))
        return !found.length && name === 'exec' && /^\s*(?:cat|cd|ls|find|rg|touch|mkdir|rm|cp|mv)\s/.test(value)
          ? [{ value, command: true, cwd }] : found
      }
      catch { return [{ value, command: true, cwd }] }
    }
    return []
  }
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => {
    const directory = value.workdir ?? value.cwd ?? cwd
    if (typeof item === 'string' && ['command', 'cmd'].includes(key)) return [{ value: item, command: true, cwd: directory }]
    if (typeof item === 'string' && ['path', 'file_path', 'filePath', 'filename', 'target_file', 'workdir', 'cwd', 'directory'].includes(key))
      return [{ value: item, write: /write|edit|patch/.test(name), cwd: directory }]
    return item !== null && typeof item === 'object' ? toolAccess(item, name, directory) : []
  })
  return []
}

// Detect explicit write destinations independently of the read/runtime allowlist.
// This is an observation guard, not an operating-system sandbox.
function writePaths(command) {
  const paths = []
  for (const expression of [
    /(?:^|[^<])>>?\s*['"]?(\/[^\s"'`<>;,(){}\[\]\\]+)/g,
    /\b(?:touch|mkdir|rm|rmdir|chmod|chown|truncate|tee)\s+(?:-[^\s]+\s+)*['"]?(\/[^\s"'`<>;,(){}\[\]\\]+)/g,
    /\b(?:writeFile|writeFileSync|appendFile|appendFileSync)\s*\(\s*['"](\/[^'"]+)['"]/g,
    /\bopen\s*\(\s*['"](\/[^'"]+)['"]\s*,\s*['"][wax+]/g,
    /\bPath\s*\(\s*['"](\/[^'"]+)['"]\s*\)\.(?:write_text|write_bytes|mkdir|unlink|rmdir|chmod)\s*\(/g
  ]) for (const match of command.matchAll(expression)) paths.push(resolve(match[1]))
  for (const match of command.matchAll(/\b(?:cp|mv|install)\s+([^;\n]+)/g)) {
    const destination = match[1].trim().match(/['"]?(\/[^\s"'`<>;,(){}\[\]\\]+)['"]?\s*$/)
    if (destination) paths.push(resolve(destination[1]))
  }
  return paths
}

// Native tool inputs can be JavaScript that calls shell or file tools.
function commands(program) {
  const found = []
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'CallExpression' && node.callee.property?.name === 'apply_patch' && typeof node.arguments[0]?.value === 'string')
      found.push(...toolAccess(node.arguments[0].value, 'apply_patch'))
    if (node.type === 'ObjectExpression') {
      const fields = Object.fromEntries(node.properties.filter(property => property.type === 'Property')
        .map(property => [property.key.name ?? property.key.value, property.value.value]))
      found.push(...toolAccess(fields))
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
  const writable = path => roots.some(root => within(path, root)) || path === '/dev/null'
  const allowed = path => roots.some(root => within(path, root)) || tools.has(path) ||
    (!/(?:^|[\\/])(?:repo-audit|SKILL\.md)(?:[\\/]|$)/.test(path) && runtime.some(root => within(path, root)))
  const events = result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const values = [...events.filter(event => event.item?.type === 'command_execution')
    .flatMap(event => toolAccess({ command: event.item.command, cwd: event.item.cwd })),
    ...await sessionTools(join(record.isolation.state, 'sessions'))]
  const violations = new Set()
  for (const { value, command, cwd, write } of values) {
    if (!command) {
      const path = resolve(cwd ?? record.fixture.path, value)
      if (!(write ? writable(path) : allowed(path))) violations.add(path)
      continue
    }
    // URLs and domain routes are not filesystem observations.
    let content = value.replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi, '').replaceAll('\\ ', ' ')
    // Capacity queries observe filesystem metadata, never another project's files.
    content = content.replace(/\bdf\s+(?:-[^\s]+\s+)*['"]?(\/tmp|\/)['"]?(?=$|[\s;"'])/g, '[resource-query]')
      .replace(/\bstat\s+-[^\s]*f\s+['"]?(\/tmp|\/)['"]?(?=$|[\s;"'])/g, '[resource-query]')
      .replace(/\b(?:statfs|disk_usage)\s*\(\s*['"](?:\/tmp|\/)['"]\s*\)/g, '[resource-query]')
    for (const root of roots) {
      content = content.replace(new RegExp(`${RegExp.escape(root)}(?=$|[\\/\\s"'\x60<>;,(){}\\[\\]])(?:/[^\\s"'\x60<>;,(){}\\[\\]\\\\]+)?`, 'g'),
        path => allowed(resolve(path)) ? '[in-scope]' : path)
    }
    if (command) for (const path of writePaths(content)) if (!writable(path)) violations.add(path)
    for (const match of content.matchAll(/(?<![\w./\\])(?:[A-Za-z]:[\\/]|\/)[^\s"'`<>;,(){}\[\]\\]+/g)) {
      const candidate = match[0].replace(/[.:]+$/, '')
      const path = resolve(candidate)
      const processQuery = path === '/proc' && /\.iterdir\(|\b(?:listdir|readdir|readdirSync)\(|\bls\s+/.test(value) ||
        /^\/proc\/\d+\/(?:comm|cmdline|stat|status)$/.test(path)
      if ((process.platform === 'win32' || topLevel.has(path.slice(filesystem.length).split(sep)[0])) &&
          !allowed(path) && !processQuery) violations.add(path)
    }
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
