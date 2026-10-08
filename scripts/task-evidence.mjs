import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { environment, git, hash, inputs, inputsCommitted } from './lib/test-evidence.mjs'

// Task artifacts live in one portable directory, independent of the shell cwd.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
  const [runPath, taskId, ...extra] = process.argv.slice(2)
  if (!runPath || !taskId || extra.length || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskId)) {
    throw new Error('Usage: node scripts/task-evidence.mjs <run.json> <task-id>')
  }
  const path = resolve(root, runPath)
  const prefix = `tests/eval/results/tasks/${taskId}`
  const excluded = [`${prefix}.json`, `${prefix}.full-tests.txt`, `${prefix}.events.jsonl`]
  const run = JSON.parse(await readFile(path, 'utf8'))
  const output = await readFile(`${path}.tap`, 'utf8')
  const events = await readFile(`${path}.events`, 'utf8')
  const results = events.trim().split('\n').map(line => JSON.parse(line))
  const summary = results.findLast(event => event.type === 'test:summary' && event.file === null)
  const suites = results.filter(event => event.type === 'test:summary' && event.file).map(event => event.file).sort()
  if (run.schemaVersion !== 1 || !run.committed || run.command.exitCode !== 0 || !summary?.success ||
      summary.counts.failed || summary.counts.cancelled || summary.counts.skipped || summary.counts.todo || !summary.counts.tests ||
      JSON.stringify(suites) !== JSON.stringify(run.suites) ||
      hash(JSON.stringify(run.inputs.files)) !== run.inputs.sha256 ||
      hash(output) !== run.outputSha256 || hash(events) !== run.eventsSha256) throw new Error('Full-suite evidence is incomplete or failed')
  if (run.baseRevision !== git(root, 'rev-parse', 'origin/main')) throw new Error('Evidence base changed; run the full suite again')
  git(root, 'merge-base', '--is-ancestor', run.sourceRevision, 'HEAD')
  if (!inputsCommitted(root, excluded)) throw new Error('Commit source inputs before attaching evidence')
  const files = run.inputs.files.filter(file => !excluded.includes(file.path))
  const binding = { files, sha256: hash(JSON.stringify(files)) }
  if (JSON.stringify(binding) !== JSON.stringify(await inputs(root, excluded)) ||
      JSON.stringify(run.environment) !== JSON.stringify(await environment())) throw new Error('Evidence inputs or environment changed; run the full suite again')
  const directory = join(root, 'tests', 'eval', 'results', 'tasks')
  let previous
  try { previous = JSON.parse(await readFile(join(directory, `${taskId}.json`), 'utf8')) } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const record = { schemaVersion: 1, taskId, slice: taskId,
    intent: 'Preserve full test coverage while avoiding a second pipeline for evidence bookkeeping.',
    amendments: [], cases: [], limitations: [], ...previous, sourceRevision: run.sourceRevision,
    status: previous?.status ?? 'passed', environment: run.environment,
    commands: [...(previous?.commands ?? []).filter(command => command.id !== 'full-tests'),
      { id: 'full-tests', ...run.command, outputArtifact: `${prefix}.full-tests.txt`, status: 'passed' }],
    validation: { baseRevision: run.baseRevision, inputs: binding, suites: run.suites,
      counts: summary.counts, durationMs: summary.duration_ms, outputSha256: run.outputSha256,
      eventsSha256: run.eventsSha256, eventsArtifact: `${prefix}.events.jsonl` },
    limitations: [...new Set([...(previous?.limitations ?? []),
      'Full-suite execution does not replace task-specific agent or manual acceptance procedures.'])] }
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, `${taskId}.full-tests.txt`), output)
  await writeFile(join(directory, `${taskId}.events.jsonl`), events)
  await writeFile(join(directory, `${taskId}.json`), JSON.stringify(record, null, 2) + '\n')
  console.log(`Attached ${summary.counts.tests} tests from ${run.sourceRevision} to HEAD ${git(root, 'rev-parse', 'HEAD')}; inputs ${binding.sha256}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
