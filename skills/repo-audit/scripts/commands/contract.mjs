import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath, resolvePath } from '../lib/paths.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { pathGlob } from '../lib/glob.mjs'
import { integrationCommand, isIndirectExecutable } from '../lib/check-integration.mjs'
import { CommandError } from '../lib/result.mjs'

function reject(code, path, message, status = 'failed') {
  throw new CommandError(status, [{ code, path, message, fix: 'Review the version 1 project contract and its authoritative source pointers.' }])
}

export async function packageManifestPath(root, cwd, name) {
  let directory = cwd
  if (name === 'npm' || name === 'yarn') {
    while (directory !== root) {
      const entries = await readdir(directory)
      if (entries.includes('package.json') || (name === 'npm' && entries.includes('node_modules'))) break
      directory = dirname(directory)
    }
  }
  return join(directory, 'package.json')
}

// Native script aliases are inspected without execution; opaque programs remain reviewed leaf checks.
export async function leafCommand(root, command, stack = [], discovery = false) {
  const cwd = await resolvePath(root, command.cwd)
  await exactPathCase(root, command.cwd)
  if (!(await stat(cwd)).isDirectory()) reject('invalid-cwd', command.cwd, 'Child command cwd must be an existing directory.')
  if (command.timeoutMs !== undefined && (!Number.isSafeInteger(command.timeoutMs) || command.timeoutMs <= 0)) reject('invalid-command', command.cwd, 'Timeout must be a positive safe integer.')
  const commands = []
  const configPaths = []
  async function visit(executable, args) {
    const names = [executable, ...args].map(word => word.split(/[\\/]/).at(-1).toLowerCase().replace(/\.(exe|cmd|bat)$/, ''))
    const [name] = names
    if (names.includes('bstack-check.mjs') ||
        args.some((arg, i) => (arg === 'evidence' && args[i + 1] === 'validate') || (arg === 'docs' && ['check', 'generate'].includes(args[i + 1])))) {
      reject('recursive-check', command.cwd, 'Leaf commands cannot invoke aggregate maintenance validation.')
    }
    if (isIndirectExecutable(executable)) reject('unsupported-leaf', executable, 'Shell programs and command wrappers cannot declare a verifiable leaf command.')
    if (!['npm', 'pnpm', 'yarn'].includes(name)) {
      commands.push({ executable, args, cwd: relative(root, cwd) || '.' })
      return
    }
    let script
    if ((args.length === 1 || discovery) && ['test', 'start', 'stop', 'restart'].includes(args[0])) script = args[0]
    else if (args[0] === 'run' && (args.length === 2 || discovery && args.length >= 2)) script = args[1]
    else if (args.length === 1 && ['--version', '-v'].includes(args[0])) return
    else reject('unsupported-leaf', executable, 'Package script leaves support run <script>, lifecycle aliases and --version only.')
    const path = await packageManifestPath(root, cwd, name)
    const packageDirectory = dirname(path)
    configPaths.push(path)
    const scripts = inspectJSON(await readFile(path, 'utf8')).value.scripts ?? {}
    if (typeof scripts[script] !== 'string') reject('missing-script', path, `Missing package script: ${script}`)
    const key = `${path}:${script}`
    if (stack.includes(key)) reject('recursive-check', path, 'Package script graph contains a cycle.')
    for (const id of [`pre${script}`, script, `post${script}`]) {
      if (scripts[id] === undefined) continue
      let words
      try { words = integrationCommand(scripts[id], path) } catch (error) {
        if (!discovery) throw error
        continue
      }
      let start = 0
      for (let end = 0; end <= words.length; end++) {
        if (end !== words.length && words[end] !== '&&') continue
        const resolved = await leafCommand(root, { ...command, cwd: relative(root, packageDirectory) || '.', executable: words[start], args: words.slice(start + 1, end), versionArgs: [] }, [...stack, key], discovery)
        commands.push(...resolved.commands)
        configPaths.push(...resolved.configPaths)
        start = end + 1
      }
    }
  }
  for (const args of [command.args, ...(command.versionArgs.length ? [command.versionArgs] : [])]) {
    if (discovery) await visit(command.executable, args).catch(() => {})
    else await visit(command.executable, args)
  }
  return { commands, configPaths }
}

async function exactPathCase(root, input, allowMissing = false) {
  let parent = root
  for (const segment of relative(root, resolve(root, input)).split(sep).filter(Boolean)) {
    const entries = await readdir(parent)
    if (!entries.includes(segment)) {
      if (allowMissing && !entries.some(entry => entry.toLowerCase() === segment.toLowerCase())) return
      reject('missing-path', input, 'Path is absent or has different path case.')
    }
    parent = join(parent, segment)
  }
}

async function sourcePointer(root, input, removed) {
  const glob = pathGlob(input)
  if (/[*?]/.test(glob.pattern)) reject('invalid-pointer', input, 'Source pointers must be concrete paths.')
  if (removed) return
  const path = await resolveFilePath(root, input)
  await exactPathCase(root, input)
  if (!(await stat(path)).isFile()) reject('missing-path', input, 'Source pointers must identify existing files.')
}

export async function loadContract(target, input = '.bstack/project.json', removedPaths = new Set()) {
  pathGlob(input)
  const path = await resolveFilePath(target.root, input)
  await exactPathCase(target.root, input, true)
  let contract
  try { contract = inspectJSON(await readFile(path, 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    reject('contract-unavailable', input, 'Contract must be readable JSON. Unsupported existing formats require a reviewed standalone contract.', 'blocked')
  }
  const schema = JSON.parse(await readFile(new URL('../../schemas/project.schema.json', import.meta.url), 'utf8'))
  validateData(schema, contract)
  for (const collection of ['documents', 'scopes', 'rules', 'checks', 'generators', 'acceptanceSources']) validateIds(contract[collection], `$/` + collection)
  const reference = (ids, collection, path) => {
    for (const id of ids) if (!contract[collection].some(record => record.id === id)) reject('unknown-id', path, `Unknown ${collection} ID: ${id}`)
  }
  for (const entry of [...contract.documents, ...contract.rules, ...contract.acceptanceSources]) await sourcePointer(target.root, entry.path, removedPaths.has(entry.path))
  for (const scope of contract.scopes) {
    scope.paths.forEach(pathGlob)
    reference(scope.documentIds, 'documents', scope.id)
    reference(scope.ruleIds, 'rules', scope.id)
  }
  for (const rule of contract.rules) reference(rule.checkIds, 'checks', rule.id)
  for (const entry of [...contract.checks, ...contract.generators]) {
    entry.inputScopes.forEach(pathGlob)
    await leafCommand(target.root, entry.command)
  }
  for (const generator of contract.generators) for (const output of generator.outputPaths) {
    pathGlob(output)
    await resolveFilePath(target.root, output)
    await exactPathCase(target.root, output, true)
  }
  return { contract, path: input }
}

export async function run(options) {
  const target = await resolveTarget(options)
  const { contract, path } = await loadContract(target, options.contract)
  return { inputs: { repo: target.root, contract: path }, data: { contract, coverageLimits: [] } }
}
