import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { platform, release, arch } from 'node:os'
import { selectCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

export function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function environment() {
  const npm = await selectCommand('npm', ['--version'])
  return { os: `${platform()} ${release()} ${arch()}`, node: process.version,
    tools: { npm: execFileSync(npm.executable, npm.args, { encoding: 'utf8' }).trim(),
      git: execFileSync('git', ['--version'], { encoding: 'utf8' }).trim() } }
}

export async function inputs(root) {
  const paths = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
  const files = []
  for (const path of [...new Set(paths)].sort()) {
    // Portable evidence is output, so attaching it does not invalidate the tested inputs.
    if (path.startsWith('tests/eval/results/tasks/')) continue
    try {
      const info = await lstat(join(root, path))
      if (!info.isFile()) throw new Error(`Unsupported evidence input: ${path}`)
      files.push({ path, executable: Boolean(info.mode & 0o111), sha256: hash(await readFile(join(root, path))) })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      files.push({ path, deleted: true })
    }
  }
  return { files, sha256: hash(JSON.stringify(files)) }
}
