import { readFile, readlink, lstat, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, matchesGlob } from 'node:path'

// This program is passed to the existing container, without a third mount.
const input = JSON.parse(await readFile(process.argv[1], 'utf8'))
// Fixture equality compares exact bytes, without normalising line endings.
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
// Git supplies the tracked inventory and worktree status of repository fixtures.
const git = args => execFileSync('git', args, { encoding: 'utf8' })

async function snapshot() {
  const files = []
  async function collect(path) {
    const info = await lstat(path)
    if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) if (entry !== '.git') await collect(join(path, entry))
    } else files.push([path, info.isSymbolicLink() ? await readlink(path) : digest(await readFile(path))])
  }
  let status = null
  if (input.kind === 'repo') {
    status = git(['status', '--porcelain=v1', '--untracked-files=all'])
    for (const path of git(['ls-files', '-z']).split('\0').filter(Boolean).sort()) {
      try { await collect(path) } catch (error) { if (error.code !== 'ENOENT') throw error; files.push([path, null]) }
    }
  } else await collect('.')
  return { files, status }
}

function opened(machine) {
  const paths = []
  let observed = false
  for (const event of input.events) {
    if (event.type !== 'item.completed') continue
    const item = event.item
    if (item?.type === 'command_execution') {
      observed = true
      if (item.exit_code !== 0) continue
      // Inspect read commands only; assistant prose and command output are not access evidence.
      function commands(source) {
        for (const command of source.split(/(?:&&|\|\||[;|\n])/)) {
          if (!/(?:^|[\s"'(])(?:cat|head|tail|sed|rg|grep|less|more|bat|read_file)(?:\s|$)/.test(command)) continue
          for (const match of command.matchAll(/"([^"]+)"|'([^']+)'|([^\s]+)/g)) {
            const token = match[1] ?? match[2] ?? match[3]
            paths.push(token)
            if (/\s/.test(token) && /(?:^|[\s"'(])(?:cat|head|tail|sed|rg|grep|less|more|bat|read_file)\s/.test(token)) commands(token)
          }
        }
      }
      commands(item.command)
    } else if (['file_read', 'tool_call', 'mcp_tool_call'].includes(item?.type)) {
      let args = item.arguments ?? item.input ?? {}
      if (typeof args === 'string') { try { args = JSON.parse(args) } catch { continue } }
      if (item.type === 'file_read' || /read_file|open_file/.test(item.name ?? item.tool ?? '')) {
        observed = true
        if (typeof (item.path ?? args.path ?? args.file_path) === 'string') paths.push(item.path ?? args.path ?? args.file_path)
      }
    }
  }
  // Match skill-relative paths too, because globstar excludes hidden install parents.
  const matches = pattern => paths.some(path => {
    const normal = path.replaceAll('\\', '/')
    return matchesGlob(normal, pattern) || matchesGlob(normal.replace(/^.*\/repo-audit\//, 'repo-audit/'), pattern)
  })
  return observed && (machine.type === 'opened' ? machine.patterns.every(matches) : !machine.patterns.some(matches))
}

async function assertion(machine) {
  if (machine.type === 'fixtureUnchanged') return JSON.stringify(await snapshot()) === JSON.stringify(input.before)
  if (machine.type === 'opened' || machine.type === 'notOpened') return opened(machine)
  if (machine.type === 'installerPassed') return input.installer?.status === 'passed' && !input.installer.outputTruncated
  if (machine.type === 'contains') return (await readFile(machine.path, 'utf8')).includes(machine.text)
  if (machine.type === 'filesEqual') {
    const files = await Promise.all(machine.paths.map(path => readFile(path)))
    return files.every(file => file.equals(files[0]))
  }
  if (!input.final) return false
  const command = machine.type === 'citeCheck'
    ? { executable: 'node', args: [input.skill, 'cite-check', '--repo', process.cwd(), '--report', machine.report.replace(/^\$HOME\//, `${process.env.HOME}/`), '--json'] }
    : machine
  const result = spawnSync(command.executable, command.args, { timeout: 120000, encoding: 'utf8', maxBuffer: 16777216 })
  return result.status === 0 && !result.error
}

if (input.action === 'snapshot') console.log(JSON.stringify(await snapshot()))
else {
  const results = []
  for (const check of input.checks) {
    try { results.push({ id: check.id, passed: await assertion(check.machine) }) }
    catch (error) { results.push({ id: check.id, passed: false, reason: error.message }) }
  }
  console.log(JSON.stringify(results))
}
