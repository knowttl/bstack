import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

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
  if (args.length && (args.length !== 2 || !['--task', '--capture'].includes(args[0]))) {
    throw new Error('Usage: npm test -- [--task <id> | --capture <run.json>]')
  }
  // Ordinary gate runs retain evidence too; standalone discovery fixtures have no Git checkout.
  let capture = args[0] === '--capture' ? resolve(root, args[1]) :
    !args.length && existsSync(join(root, '.git')) ? join(root, '.cache', 'full-suite.json') : null
  if (capture) {
    if (!relative(join(root, '.cache'), capture) || relative(join(root, '.cache'), capture).startsWith('..')) {
      throw new Error('Capture must be a file inside .cache/')
    }
    await rm(capture, { force: true })
  }
  let files = (await Promise.all(suiteRoots.map(discover))).flat().sort()
  if (args[0] === '--task') {
    const tasks = JSON.parse(await readFile(join(root, 'tests', 'tasks.json'), 'utf8'))
    const suites = Object.hasOwn(tasks, args[1]) ? tasks[args[1]] : undefined
    if (!Array.isArray(suites)) throw new Error(`Unknown task: ${args[1]}`)
    const selected = suites.map(path => resolve(root, path))
    if (selected.some(path => !files.includes(path))) throw new Error(`Task ${args[1]} registers an undiscovered suite`)
    files = files.filter(path => selected.includes(path))
  }
  if (!files.length) throw new Error('No test suites selected')
  console.log(`Selected ${files.length} suite(s): ${files.map(path => relative(root, path)).join(', ')}`)
  let binding
  let evidence
  let redactEvidence
  if (capture) {
    try {
      evidence = await import('./lib/test-evidence.mjs')
      const host = await import('./lib/evaluation-host.mjs')
      redactEvidence = host.redactEvidence
      await mkdir(dirname(capture), { recursive: true })
      const clean = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', '.', ':!tests/eval/results/tasks'], { cwd: root })
      if (clean.error) throw clean.error
      const committed = clean.status === 0 && !evidence.git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')
        .some(path => path && !path.startsWith('tests/eval/results/tasks/'))
      if (!committed && args[0] === '--capture') throw new Error('Commit source inputs before capturing evidence')
      binding = { sourceRevision: evidence.git(root, 'rev-parse', 'HEAD'), baseRevision: evidence.git(root, 'rev-parse', 'origin/main'),
        committed, environment: await evidence.environment(), inputs: await evidence.inputs(root) }
    } catch (error) {
      if (args[0] === '--capture') throw error
      console.error(`Evidence capture unavailable: ${error.message}`)
      capture = null
    }
  }
  const runnerArgs = ['--test', '--test-reporter=tap', ...(capture ? ['--test-reporter-destination=stdout',
    `--test-reporter=${join(root, 'scripts', 'test-reporter.mjs')}`, `--test-reporter-destination=${capture}.events`] : []), ...files]
  const result = spawnSync(process.execPath, runnerArgs, { cwd: root, stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
  if (capture) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    const output = redactEvidence(result.stdout + result.stderr)
    const events = redactEvidence(await readFile(`${capture}.events`, 'utf8'))
    await writeFile(`${capture}.tap`, output)
    await writeFile(`${capture}.events`, events)
    if (JSON.stringify(binding.inputs) !== JSON.stringify(await evidence.inputs(root))) throw new Error('Evidence inputs changed during the suite')
    await writeFile(capture, JSON.stringify({ schemaVersion: 1, ...binding,
      command: { executable: 'node', args: ['scripts/test.mjs', ...args], cwd: '.', exitCode: process.exitCode },
      suites: files.map(path => relative(root, path).replaceAll('\\', '/')),
      outputSha256: evidence.hash(output), eventsSha256: evidence.hash(events) }, null, 2) + '\n')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
