import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fail } from './evaluation.mjs'

function skillHeadings(source) {
  return [...source.matchAll(/^#{2,3} (.+)$/gm)].map(match => ({
    line: source.slice(0, match.index).split('\n').length,
    key: `SKILL.md#${match[1].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')}`
  }))
}

function coversKey(covers, key) {
  return covers.some(cover => cover === key || (cover.endsWith('/') && key.startsWith(cover)))
}

export async function affectedScenarios(repo, base, definitions, packageOnly = false) {
  function git(...args) {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    if (result.status !== 0) fail('Cannot resolve impact base or read changed inputs. Supply an accessible commit with --base.')
    return result.stdout
  }
  if (!base || base.startsWith('-')) fail('Supply --base <commit> for impact selection.', 'usage-error')
  const revision = git('rev-parse', '--verify', `${base}^{commit}`).trim()
  const paths = [...new Set((git('diff', '--name-only', '-z', '--no-renames', revision, '--') +
    git('ls-files', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean))].sort()
    .filter(path => !packageOnly || path.startsWith('skills/repo-audit/') || path.startsWith('install/'))
  const keys = []
  for (const path of paths) {
    if (path !== 'skills/repo-audit/SKILL.md') {
      keys.push(path.startsWith('skills/repo-audit/') ? path.slice('skills/repo-audit/'.length) : path)
      continue
    }
    const previous = spawnSync('git', ['show', `${revision}:${path}`], { cwd: repo, encoding: 'utf8' })
    let current
    try { current = await readFile(join(repo, path), 'utf8') } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (previous.status !== 0 || current === undefined) { keys.push('SKILL.md'); continue }
    const versions = [skillHeadings(previous.stdout), skillHeadings(current)]
    const diff = git('diff', '--unified=0', '--no-ext-diff', '--no-textconv', revision, '--', path)
    for (const hunk of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
      for (const [index, headings] of versions.entries()) {
        const count = Number(hunk[index * 2 + 2] ?? 1)
        const start = Number(hunk[index * 2 + 1]) + (count ? 0 : 1)
        keys.push(headings.findLast(heading => heading.line <= start)?.key ?? 'SKILL.md')
        keys.push(...headings.filter(heading => heading.line > start && heading.line < start + count).map(heading => heading.key))
      }
    }
    // Mode-only changes have no text hunk and still affect the package.
    if (!diff.includes('@@')) keys.push('SKILL.md')
  }
  const changedKeys = [...new Set(keys)].sort()
  // Repository paths outside the package cannot alias skill-relative coverage keys.
  const unmapped = [...new Set([
    ...paths.filter(path => !path.startsWith('skills/repo-audit/') && !path.startsWith('install/')),
    ...changedKeys.filter(key => !definitions.some(item => coversKey(item.covers, key)))
  ])].sort()
  return { status: 'passed', base: revision, paths, keys: changedKeys, unmapped,
    scenarios: definitions.filter(item => unmapped.length || changedKeys.some(key => coversKey(item.covers, key))).map(item => item.id) }
}
