import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectCommand } from '../skills/repo-audit/scripts/lib/run.mjs'

// The Test gate's command: a Markdown-only change cannot break executable code, so it runs the package check and
// the task whose suites read skills and documents. Any other change, or any doubt about the diff, runs the full suite.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const markdownTask = 'T3.1'
const markdownPaths = [/^README\.md$/, /^docs\//, /^skills\/.+\.md$/, /^skills\/.+\/references\//]

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const paths = (...args) => git(...args).split('\0').filter(Boolean)

function changedFiles() {
  try {
    const base = git('merge-base', 'origin/main', 'HEAD').trim()
    return [...paths('diff', '--name-only', '--no-renames', '-z', base), ...paths('ls-files', '--others', '--exclude-standard', '-z')]
  } catch {
    return []
  }
}

async function run(executable, args) {
  const command = await selectCommand(executable, args)
  const result = spawnSync(command.executable, command.args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const changed = changedFiles()
const code = changed.find(path => !markdownPaths.some(pattern => pattern.test(path)))
if (!changed.length || code) {
  console.log(`Gate: full suite (${changed.length ? `${code} is not Markdown` : 'no changed files found against origin/main'})`)
  await run('npm', ['test', '--', '--capture', '.cache/full-suite.json'])
} else {
  console.log(`Gate: Markdown-only change (${changed.length} file(s)), so the package check and task ${markdownTask}`)
  await run('npm', ['run', 'check'])
  await run('npm', ['test', '--', '--task', markdownTask])
}
