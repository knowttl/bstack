import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { platform, release, arch } from 'node:os'
import { selectCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

export function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function inputsCommitted(root, excluded = []) {
  const clean = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', '.', ...excluded.map(path => `:(top,literal,exclude)${path}`)], { cwd: root })
  if (clean.error) throw clean.error
  return clean.status === 0 && !git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')
    .some(path => path && !excluded.includes(path))
}

export async function environment() {
  const npm = await selectCommand('npm', ['--version'])
  return { os: `${platform()} ${release()} ${arch()}`, node: process.version,
    tools: { npm: execFileSync(npm.executable, npm.args, { encoding: 'utf8' }).trim(),
      git: execFileSync('git', ['--version'], { encoding: 'utf8' }).trim() } }
}

export async function inputs(root, excluded = []) {
  const paths = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
  const files = []
  for (const path of [...new Set(paths)].sort()) {
    if (excluded.includes(path)) continue
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
