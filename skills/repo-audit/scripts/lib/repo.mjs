import { realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CommandError } from './result.mjs'

export async function resolveTarget(options, { draftOnly = false } = {}) {
  if (options.workspace && !draftOnly) {
    throw new CommandError('usage-error', [{ code: 'workspace-not-supported', message: 'This command requires a Git repo.', fix: 'Supply --repo for this command.' }])
  }
  const selected = options.repo ?? options.workspace
  let root
  try {
    root = await realpath(resolve(selected))
    if (!(await stat(root)).isDirectory()) throw new Error('Not a directory')
  } catch {
    throw new CommandError('blocked', [{ code: 'target-unavailable', message: 'The target must be an existing directory.', fix: 'Create or select an existing directory.', path: selected }])
  }
  if (options.workspace) return { mode: 'workspace', root }
  // Git discovery is read-only and works before the first commit.
  const env = { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined }
  const git = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', env })
  if (git.error || git.status !== 0) {
    throw new CommandError('blocked', [{ code: 'git-unavailable', message: 'Git could not resolve the target repo.', fix: 'Install Git and select a non-bare Git working tree.', path: selected }])
  }
  return { mode: 'repo', root: await realpath(git.stdout.trimEnd()) }
}
