import { execFileSync, spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectCommand } from '../runtime/scripts/lib/run.mjs'
import { commands } from '../runtime/scripts/commands.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const json = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'))
let base = null
let paths = []
let reason
const modules = new Set()
const tasks = new Set()

try {
  base = git('merge-base', 'origin/main', 'HEAD').trim()
  // Include staged paths even when their contents have been restored only in the worktree.
  paths = [...new Set([
    ...git('diff', '--name-only', '--no-renames', '-z', base, '--').split('\0'),
    ...git('diff', '--cached', '--name-only', '--no-renames', '-z', base, '--').split('\0'),
    ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')
  ].filter(Boolean))].sort()
} catch {
  reason = 'unresolved origin/main merge base or unreadable diff'
}

try {
  if (reason) throw new Error(reason)
  if (!paths.length) throw new Error('empty diff')
  const map = await json('tests/affected.json')
  const registry = await json('tests/tasks.json')
  const skills = await json('runtime/skills.json')
  const addTasks = ids => {
    for (const id of ids) {
      if (!Array.isArray(registry[id])) throw new Error(`incomplete task map: ${id}`)
      tasks.add(id)
    }
  }
  function addModule(name) {
    if (modules.has(name)) return
    const entry = map.commands[name]
    if (!entry) throw new Error(`incomplete dependency map: ${name}`)
    modules.add(name)
    addTasks(entry.tasks)
    for (const dependent of entry.dependents) addModule(dependent)
  }
  // Validate untouched graph entries too, so an incomplete map cannot prove independence.
  for (const [name, entry] of Object.entries(map.commands)) {
    if (entry.dependents.some(id => !map.commands[id])) throw new Error(`incomplete dependency map: ${name}`)
  }
  const declaredTasks = [...map.always, ...Object.values(map.commands).flatMap(entry => entry.tasks),
    ...Object.values(map.skills).flat(), ...map.paths.flatMap(entry => entry.tasks)]
  for (const id of declaredTasks) if (!Array.isArray(registry[id])) throw new Error(`incomplete task map: ${id}`)
  for (const names of Object.values(map.schemas)) {
    for (const name of names) if (!map.commands[name]) throw new Error(`incomplete schema map: ${name}`)
  }
  addTasks(map.always)
  const registered = new Set(Object.values(registry).flat())
  for (const folder of ['scripts', 'package-check']) {
    for (const path of await readdir(resolve(root, 'tests', folder), { recursive: true })) {
      if (path.endsWith('.test.mjs') && !path.split('/').includes('node_modules') && !registered.has(`tests/${folder}/${path}`)) {
        throw new Error(`unregistered suite: tests/${folder}/${path}`)
      }
    }
  }
  // Static imports are a lower bound on protocol dependencies, which the map also declares.
  for (const file of await readdir(resolve(root, 'runtime/scripts/commands'))) {
    if (!file.endsWith('.mjs')) continue
    const name = basename(file, '.mjs')
    if (!map.commands[name]) throw new Error(`unmapped command: ${name}`)
    const source = await readFile(resolve(root, 'runtime/scripts/commands', file), 'utf8')
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]\.\/([^/'"]+)\.mjs['"]/g)) {
      if (!map.commands[dependency]?.dependents.includes(name)) throw new Error(`undeclared dependency: ${dependency} -> ${name}`)
    }
  }
  const generated = new Map()
  for (const [skill, bundle] of Object.entries(skills)) {
    if (!map.skills[skill]) throw new Error(`unmapped skill: ${skill}`)
    const inputs = bundle.commands.map(name => {
      if (!commands[name]) throw new Error(`unmapped bundled command: ${name}`)
      return basename(commands[name].module, '.mjs')
    })
    generated.set(`skills/${skill}/scripts/${skill}.mjs`, { skill, modules: inputs })
    for (const folder of ['schemas', 'assets', 'references']) {
      for (const name of bundle[folder] ?? []) generated.set(`skills/${skill}/${folder}/${name}`, { skill, source: `runtime/${folder}/${name}` })
    }
  }
  for (const path of paths) {
    if (map.full.some(pattern => new RegExp(pattern).test(path))) throw new Error(`shared infrastructure: ${path}`)
    if (generated.has(path)) continue
    const command = /^runtime\/scripts\/commands\/([^/]+)\.mjs$/.exec(path)
    const schema = /^runtime\/schemas\/([^/]+)$/.exec(path)
    const skill = /^skills\/([^/]+)\/(?:SKILL\.md|references\/.+\.md|agents\/openai\.yaml)$/.exec(path)
    if (command) addModule(command[1])
    else if (schema && map.schemas[schema[1]]) for (const name of map.schemas[schema[1]]) addModule(name)
    else if (skill && map.skills[skill[1]]) addTasks(map.skills[skill[1]])
    else if (path.startsWith('runtime/references/') && [...generated.values()].some(item => item.source === path)) {
      for (const item of generated.values()) if (item.source === path) addTasks(map.skills[item.skill])
    } else {
      const rule = map.paths.find(item => new RegExp(item.pattern).test(path))
      if (!rule) throw new Error(`shared infrastructure or unmapped path: ${path}`)
      addTasks(rule.tasks)
    }
  }
  for (const path of paths) {
    const item = generated.get(path)
    if (!item) continue
    const matched = item.source ? paths.includes(item.source) : item.modules.some(name => modules.has(name))
    if (!matched) throw new Error(`unmatched generated artifact: ${path}`)
    addTasks(map.skills[item.skill])
  }
} catch (error) {
  reason = error.message
}

console.log(`Base: ${base ?? 'unresolved'}`)
console.log(`Paths: ${JSON.stringify(paths)}`)
console.log(`Modules: ${[...modules].sort().join(', ') || 'none'}`)
console.log(`Gate: ${reason ? `full suite (${reason})` : `affected tasks ${[...tasks].sort().join(', ')}`}`)

async function run(executable, args) {
  console.log(`Command: ${executable} ${args.join(' ')}`)
  const command = await selectCommand(executable, args)
  const result = spawnSync(command.executable, command.args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

await run('npm', ['run', 'check'])
await run('npm', reason ? ['test', '--', '--capture', '.cache/full-suite.json'] :
  ['test', '--', ...[...tasks].sort().flatMap(id => ['--task', id])])
