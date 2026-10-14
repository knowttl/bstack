import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

function pattern(glob) {
  let source = ''
  for (let index = 0; index < glob.length; index++) {
    if (glob.startsWith('**/', index)) {
      source += '(?:.*/)?'
      index += 2
    } else if (glob.startsWith('**', index)) {
      source += '.*'
      index += 1
    } else if (glob[index] === '*') source += '[^/]*'
    else if (glob[index] === '?') source += '[^/]'
    else source += glob[index].replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

function touches(patterns, path) {
  const parts = path.split('/')
  return parts.some((_, index) => patterns.some(candidate => candidate.test(parts.slice(0, index + 1).join('/'))))
}

function main(args) {
  const rule = 'feature-map-coverage'
  const stop = message => {
    console.error(`${rule}: ${message}`)
    process.exit(2)
  }
  try {
    if (args.length !== 2 || args[0] !== '--base' || args[1].startsWith('--')) stop('usage: node map-coverage.mjs --base <ref>, for example --base origin/main')
    const git = (...words) => execFileSync('git', words, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
    const root = git('rev-parse', '--show-toplevel').trim()
    const kit = relative(root, dirname(dirname(fileURLToPath(import.meta.url)))).split(sep).join('/')
    const mergeBase = git('merge-base', args[1], 'HEAD').trim()
    const updated = new Set([
      ...git('-C', root, 'diff', '--name-only', '--no-renames', '-z', mergeBase).split('\0'),
      ...git('-C', root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')
    ])
    const changed = [...updated].filter(path => path && !path.startsWith(`${kit}/`))
    const commitMessages = git('-C', root, 'log', '--format=%B', `${mergeBase}..HEAD`)
    const directory = join(root, kit, 'features')
    const names = readdirSync(directory).filter(name => name.endsWith('.md') && name !== 'README.md').sort()
    if (!names.length) stop(`no feature files in ${kit}/features`)
    const failures = []
    for (const name of names) {
      const id = name.slice(0, -3)
      const file = posix.join(kit, 'features', name)
      const line = readFileSync(join(directory, name), 'utf8').split('\n').find(candidate => candidate.startsWith('Source paths: '))
      const patterns = [...(line ?? '').matchAll(/`([^`]+)`/g)].map(match => pattern(match[1]))
      if (!patterns.length) stop(`${file} has no "Source paths:" line listing backticked paths`)
      const touched = changed.filter(path => touches(patterns, path))
      const explained = new RegExp(`^No-map-impact: ${id}: \\S`, 'm').test(commitMessages)
      if (touched.length && !updated.has(file) && !explained) {
        const more = touched.length > 1 ? ` and ${touched.length - 1} more` : ''
        failures.push(`${file}: ${rule}: ${touched[0]}${more} changed without updating this feature file; update it or add a "No-map-impact: ${id}: <reason>" line to a commit message`)
      }
    }
    if (failures.length) {
      console.log(failures.join('\n'))
      process.exit(1)
    }
    console.log(`${rule}: ok (${names.length} features checked)`)
  } catch (error) {
    stop(String(error.stderr || error.message).trim())
  }
}

main(process.argv.slice(2))
