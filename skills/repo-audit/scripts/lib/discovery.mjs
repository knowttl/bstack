import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

// Generated dependencies, build output and Git internals are not project evidence.
const excludedDirectories = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.cache'])

export async function repoFiles(root) {
  const files = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory() && !excludedDirectories.has(entry.name)) await walk(path)
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'))
    }
  }
  await walk(root)
  return files.sort()
}

export function readGit(root, args) {
  return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: Infinity,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined } })
}
