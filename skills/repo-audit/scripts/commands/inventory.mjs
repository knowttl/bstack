import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { repoFiles } from '../lib/discovery.mjs'
import { hashBytes } from '../lib/fingerprint.mjs'

// Name families discover equivalent sources without claiming their content is authoritative.
const documentNames = {
  vision: /^(?:vision|goals|purpose|product[-_ ]?requirements|requirements|prd)$/i,
  design: /^(?:design|architecture|technical[-_ ]?design|principles)$/i,
  glossary: /^(?:glossary|vocabulary|domain[-_ ]?(?:language|vocabulary)|terms)$/i,
  'context-map': /^(?:context[-_ ]?map|contexts)$/i,
  standards: /^(?:coding[-_ ]?standards|code[-_ ]?standards|review[-_ ]?standards|contributing|contribution[-_ ]?guidelines|style[-_ ]?guide)$/i,
  decisions: /^(?:decisions|adr|architecture[-_ ]?decisions|decision[-_ ]?log)$/i,
  audit: /^(?:repo[-_ ]?audit|audit|audit[-_ ]?(?:record|findings)|technical[-_ ]?debt|known[-_ ]?debt)$/i,
  context: /^readme$/i
}
// These names have host-specific scope and shadowing behaviour.
const instructionNames = new Set(['AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md'])
// Candidate removals require a fresh host check as well as author approval.
const versionLimit = 'Claude Code versions before v2.1.277, some Amazon Bedrock or no-telemetry sessions before v2.1.281, and sessions with the built-in AGENTS.md plugin disabled may read CLAUDE.md only. Recheck official host documentation and runtime before proposing removal.'

function kindFor(path) {
  if (instructionNames.has(basename(path))) return 'instructions'
  if (!/\.(?:md|markdown|rst|txt)$/i.test(path)) return null
  const stem = basename(path).replace(/\.[^.]+$/, '')
  if (path.split('/').slice(0, -1).some(part => /^(?:adr|adrs|decisions|architecture-decisions)$/i.test(part))) return 'decisions'
  return Object.entries(documentNames).find(([, pattern]) => pattern.test(stem))?.[0] ?? null
}

export async function run(options) {
  const target = await resolveTarget(options)
  const files = []
  const candidates = []
  const shadowing = []
  async function add(path, insideRepo) {
    const absolute = insideRepo ? join(target.root, path) : path
    const kind = kindFor(path)
    if (!kind) return
    const bytes = await readFile(absolute)
    const file = { path, hash: hashBytes(bytes), kind }
    if (kind === 'instructions') {
      const directory = dirname(absolute)
      const scopeDirectory = basename(directory) === '.claude' ? dirname(directory) : directory
      const scope = insideRepo ? relative(target.root, scopeDirectory).split(sep).join('/') || '.' : scopeDirectory
      Object.assign(file, { directory: insideRepo ? dirname(path) : directory, scope, insideRepo,
        scoped: insideRepo && scope !== '.', local: basename(path) === 'CLAUDE.local.md' })
      if (!insideRepo || file.local) shadowing.push({ path, scope, insideRepo, modifiable: false, reason: 'Possible shadowing of AGENTS.md. Preserve this instruction source.' })
      else if (basename(path) === 'CLAUDE.md') {
        const destination = relative(target.root, join(scopeDirectory, 'AGENTS.md')).split(sep).join('/')
        let equivalent = false
        try {
          const agents = await readFile(join(scopeDirectory, 'AGENTS.md'))
          const content = bytes.toString('utf8').trim()
          const importPath = relative(directory, join(scopeDirectory, 'AGENTS.md')).split(sep).join('/')
          equivalent = bytes.equals(agents) || content === `@${importPath}` || content === `@./${importPath}`
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        if (!file.scoped || equivalent) candidates.push({ code: 'merge-claude-instructions', path,
          destination, scope, requiresEquivalentContent: true,
          message: 'Review equivalent content for merging into the AGENTS.md in this scope, including import-only stubs. Preserve distinct scoped guidance. Removal requires reviewed protected edits and author approval.', versionLimit })
      }
    }
    files.push(file)
  }
  for (const path of await repoFiles(target.root)) await add(path, true)
  for (let directory = dirname(target.root); ; directory = dirname(directory)) {
    for (const path of ['AGENTS.md', 'CLAUDE.md', 'CLAUDE.local.md', join('.claude', 'CLAUDE.md')]) {
      const absolute = join(directory, path)
      try {
        if ((await stat(absolute)).isFile()) await add(absolute, false)
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      }
    }
    if (dirname(directory) === directory) break
  }
  const absent = ['instructions', ...Object.keys(documentNames)].filter(kind => !files.some(file => file.kind === kind && file.insideRepo !== false))
  return { data: { root: target.root, files, absent, candidates, shadowing }, inputs: { repo: target.root } }
}
