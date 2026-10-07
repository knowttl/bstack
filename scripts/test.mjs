import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Discovery is anchored to this checkout, independent of the caller's directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// These are the only suite roots, so fixture and evaluation sources stay excluded.
const suiteRoots = ['scripts', 'package-check'].map(name => join(root, 'tests', name))

async function discover(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules') files.push(...await discover(path))
    else if (entry.isFile() && entry.name.endsWith('.test.mjs')) files.push(path)
  }
  return files
}

try {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--task')) {
    throw new Error('Usage: npm test -- [--task <id>]')
  }
  let files = (await Promise.all(suiteRoots.map(discover))).flat().sort()
  if (args.length) {
    const tasks = JSON.parse(await readFile(join(root, 'tests', 'tasks.json'), 'utf8'))
    const suites = Object.hasOwn(tasks, args[1]) ? tasks[args[1]] : undefined
    if (!Array.isArray(suites)) throw new Error(`Unknown task: ${args[1]}`)
    const selected = suites.map(path => resolve(root, path))
    if (selected.some(path => !files.includes(path))) throw new Error(`Task ${args[1]} registers an undiscovered suite`)
    files = files.filter(path => selected.includes(path))
  }
  if (!files.length) throw new Error('No test suites selected')
  console.log(`Selected ${files.length} suite(s): ${files.map(path => relative(root, path)).join(', ')}`)
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
