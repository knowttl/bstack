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

function overlaps(left, right) {
  if (!left.length) return right.every(part => part === '**')
  if (!right.length) return left.every(part => part === '**')
  if (left[0] === '**') return overlaps(left.slice(1), right) || overlaps(left, right.slice(1))
  if (right[0] === '**') return overlaps(left, right.slice(1)) || overlaps(left.slice(1), right)
  const wildcard = part => /[*?\[{}]/.test(part)
  return (matchesGlob(left[0], right[0]) || matchesGlob(right[0], left[0]) ||
    (wildcard(left[0]) && wildcard(right[0]))) && overlaps(left.slice(1), right.slice(1))
}

function* shellCommands(source) {
  let command = [], word = '', quote = null, started = false
  function finishWord() {
    if (started) command.push(word)
    word = ''
    started = false
  }
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === '\\' && quote !== "'" && index + 1 < source.length &&
        (!quote || /["\\$`\n]/.test(source[index + 1]))) {
      word += source[++index]
      started = true
    } else if (quote) {
      if (character === quote) quote = null
      else word += character
    } else if (character === '"' || character === "'") {
      quote = character
      started = true
    } else if (/[;&|\n]/.test(character)) {
      finishWord()
      if (command.length) yield command
      command = []
    } else if (/\s/.test(character)) finishWord()
    else { word += character; started = true }
  }
  finishWord()
  if (command.length) yield command
}

function opened(machine) {
  const paths = []
  let observed = false
  function helperExecution(command) {
    const [executable, script] = command.map(token => token.replaceAll('\\', '/'))
    return !/\$\(|`|</.test(command.join(' ')) && /(?:^|\/)node(?:\.exe)?$/.test(executable ?? '') && /(?:^|\/)scripts\/repo-audit\.mjs$/.test(script ?? '')
  }
  for (const event of input.events) {
    if (event.type !== 'item.completed') continue
    const item = event.item
    if (item?.type === 'command_execution') {
      observed = true
      if (machine.type === 'opened' && item.exit_code !== 0) continue
      function commands(source) {
        for (const command of shellCommands(source)) {
          if (/(?:^|\/)(?:bash|sh|zsh)$/.test(command[0])) {
            const option = command.findIndex(token => /^-[a-z]*c[a-z]*$/.test(token))
            if (option !== -1 && command[option + 1] !== undefined) {
              commands(command[option + 1])
              continue
            }
          }
          if (helperExecution(command)) continue
          if (machine.type === 'opened' && !/(?:^|[\s"'(])(?:cat|head|tail|sed|rg|grep|less|more|bat|read_file)(?:\s|$)/.test(command.join(' '))) continue
          for (const token of command) {
            paths.push(token)
            if (/\s/.test(token) && (machine.type === 'notOpened' || /(?:^|[\s"'(])(?:cat|head|tail|sed|rg|grep|less|more|bat|read_file)\s/.test(token))) commands(token)
          }
        }
      }
      commands(item.command)
    } else if (['file_read', 'tool_call', 'mcp_tool_call'].includes(item?.type)) {
      let args = item.arguments ?? item.input ?? {}
      if (typeof args === 'string') { try { args = JSON.parse(args) } catch { continue } }
      if (item.type === 'file_read' || /read_file|open_file/.test(item.name ?? item.tool ?? '')) {
        observed = true
        if (machine.type === 'opened' && [item, item.result, item.output].some(result =>
          result?.error || result?.isError || (result?.status && !['completed', 'success', 'succeeded', 'passed'].includes(result.status)))) continue
        if (typeof (item.path ?? args.path ?? args.file_path) === 'string') paths.push(item.path ?? args.path ?? args.file_path)
      }
    }
  }
  // Match skill-relative paths too, because globstar excludes hidden install parents.
  const matches = pattern => paths.some(path => {
    const normal = path.replaceAll('\\', '/')
    if (machine.type === 'notOpened') {
      const relative = normal.replace(/^.*\/repo-audit(?=\/|$)/, 'repo-audit')
      const scoped = relative === 'repo-audit' || relative.startsWith('repo-audit/')
      const forbidden = scoped ? pattern.replace(/^\*\*\/(?:repo-audit\/)?/, 'repo-audit/') : pattern
      const parts = forbidden.split('/').filter(Boolean)
      const token = relative.split('/').filter(Boolean)
      return overlaps(parts, token) || parts.slice(0, -1).some((part, index) =>
        part !== '**' && overlaps(parts.slice(0, index + 1), token))
    }
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
