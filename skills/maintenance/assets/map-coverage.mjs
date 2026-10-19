import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

function pattern(glob) {
  if (!glob || /[`\r\n\0]/u.test(glob) || glob.includes('\\') || /^[A-Za-z]:/.test(glob) || glob.split('/').some(part => !part || part === '.' || part === '..') || /[\[\]{}()!]/u.test(glob) || glob.split('/').some(part => part.includes('**') && part !== '**')) {
    throw new Error(`Invalid source path: ${glob}. Use relative forward-slash paths with * and ? within segments, or ** as a whole segment.`)
  }
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
  return new RegExp(`^${source}$`, 'su')
}

function touches(patterns, path) {
  const parts = path.split('/')
  return parts.some((_, index) => patterns.some(candidate => candidate.test(parts.slice(0, index + 1).join('/'))))
}

// A declaration line lists backticked values after its label, and exactly one such line must exist.
function declared(lines, label) {
  const declarations = lines.filter(candidate => candidate.startsWith(`${label}:`))
  if (declarations.length !== 1 || !new RegExp(`^${label}: \`[^\`\\r\\n]+\`(?:, \`[^\`\\r\\n]+\`)*$`, 'u').test(declarations[0])) return null
  return [...declarations[0].matchAll(/`([^`]+)`/g)].map(match => match[1])
}

// A kit feature is current when its own file changed, and a suite property when one of its model files did.
const kinds = {
  kit: {
    rule: 'feature-map-coverage', folder: 'features', unit: 'feature', trailer: 'No-map-impact', updates: 'this feature file',
    current: (lines, file) => [file]
  },
  suite: {
    rule: 'formal-proof-coverage', folder: 'properties', unit: 'property', trailer: 'No-proof-impact', updates: 'a model file of this property',
    current: (lines, file, suite) => declared(lines, 'Model files')?.map(model => posix.join(suite, model)) ?? null
  }
}

function main(args) {
  const home = dirname(dirname(fileURLToPath(import.meta.url)))
  const { rule, folder, unit, trailer, updates, current } =existsSync(join(home, kinds.suite.folder)) ? kinds.suite : kinds.kit
  const stop = message => {
    console.error(`${rule}: ${message}`)
    process.exit(2)
  }
  try {
    if (args.length !== 2 || args[0] !== '--base' || args[1].startsWith('--')) stop('usage: node map-coverage.mjs --base <ref>, for example --base origin/main')
    const git = (...words) => execFileSync('git', words, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
    const root = git('rev-parse', '--show-toplevel').trim()
    const kit = relative(root, home).split(sep).join('/')
    const mergeBase = git('merge-base', args[1], 'HEAD').trim()
    const updated = new Set([
      ...git('-C', root, 'diff', '--name-only', '--no-renames', '-z', mergeBase, 'HEAD').split('\0'),
      ...git('-C', root, 'diff', '--cached', '--name-only', '--no-renames', '-z', 'HEAD').split('\0'),
      ...git('-C', root, 'diff', '--name-only', '--no-renames', '-z').split('\0'),
      ...git('-C', root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0')
    ])
    const changed = [...updated].filter(path => path && !path.startsWith(`${kit}/`))
    const commitMessages = git('-C', root, 'log', '--format=%B', `${mergeBase}..HEAD`)
    const directory = join(root, kit, folder)
    const names = readdirSync(directory).filter(name => name.endsWith('.md') && name !== 'README.md').sort()
    if (!names.length) stop(`no ${unit} files in ${kit}/${folder}`)
    const failures = []
    for (const name of names) {
      const id = name.slice(0, -3)
      const file = posix.join(kit, folder, name)
      const lines = readFileSync(join(directory, name), 'utf8').split(/\r?\n/)
      const sources = declared(lines, 'Source paths')
      if (!sources) stop(`${file} must contain exactly one complete "Source paths:" line listing backticked paths`)
      const covering = current(lines, file, kit)
      if (!covering) stop(`${file} must contain exactly one complete "Model files:" line listing backticked paths`)
      const patterns = sources.map(pattern)
      const touched = changed.filter(path => touches(patterns, path))
      const explained = new RegExp(`^${trailer}: ${id}: \\S`, 'm').test(commitMessages)
      if (touched.length && !covering.some(path => updated.has(path)) && !explained) {
        const more = touched.length > 1 ? ` and ${touched.length - 1} more` : ''
        failures.push(`${file}: ${rule}: ${touched[0]}${more} changed without updating ${updates}; update it or add a "${trailer}: ${id}: <reason>" line to a commit message`)
      }
    }
    if (failures.length) {
      console.log(failures.join('\n'))
      process.exit(1)
    }
    console.log(`${rule}: ok (${names.length} ${folder} checked)`)
  } catch (error) {
    stop(String(error.stderr || error.message).trim())
  }
}

main(process.argv.slice(2))
