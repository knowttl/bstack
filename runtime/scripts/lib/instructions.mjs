import { readFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { walkTokens } from 'marked'
import { markdownTokens } from './document-references.mjs'
import { repoFiles } from './discovery.mjs'
import { matchesPath, pathGlob } from './glob.mjs'
import { resolveFilePath } from './paths.mjs'
import { validateData } from './schema.mjs'
import { CommandError } from './result.mjs'
import schema from '../../schemas/project.schema.json' with { type: 'json' }

const contractPath = '.bstack/project.json'
const importDepth = 5
const skillDescription = /^\.(?:claude|agents)\/skills\/[^/]+\/SKILL\.md$/
const instructionFile = /(?:^|\/)(?:AGENTS\.md|CLAUDE\.md)$/

export async function loadInstructionSettings(root) {
  let text
  try { text = await readFile(await resolveFilePath(root, contractPath), 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return { exclude: [] }
    throw error
  }
  let contract
  try { contract = JSON.parse(text) } catch {
    throw new CommandError('blocked', [{ code: 'contract-unavailable', path: contractPath, message: 'The project contract must be readable JSON.', fix: 'Repair .bstack/project.json or remove it.' }])
  }
  validateData(schema, contract)
  return { exclude: contract.instructions?.exclude ?? [] }
}

export async function includedFiles(root, exclude) {
  const globs = exclude.map(pathGlob)
  return (await repoFiles(root)).filter(path => !globs.some(glob => matchesPath(glob, path)))
}

async function description(text, path) {
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?\r?\n)---(?:\r?\n|$)/.exec(text)?.[1]
  if (!frontmatter) return null
  let metadata
  try {
    const { parse } = await import('yaml')
    metadata = parse(frontmatter, { logLevel: 'error' })
  } catch {
    throw new CommandError('failed', [{ code: 'invalid-skill-frontmatter', path, message: 'Skill frontmatter must be valid YAML.', fix: 'Repair the SKILL.md frontmatter before measuring instructions.' }])
  }
  return metadata?.['disable-model-invocation'] === true || typeof metadata?.description !== 'string' ? null : metadata.description
}

function importsIn(text) {
  const imports = []
  walkTokens(markdownTokens(text), token => {
    if (token.type === 'text' && !token.tokens) {
      imports.push(...[...token.raw.matchAll(/(?:^|\s)@(\S+)/g)].map(match => match[1].replace(/[.,;:!?)]+$/, '')))
    }
  })
  return imports
}

function size(text) {
  const bytes = Buffer.byteLength(text)
  return { bytes, lines: text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0), tokens: Math.ceil(bytes / 4) }
}

export async function measureInstructions(root, files) {
  const present = new Set(files)
  const sources = new Map()
  const expandedDepth = new Map()
  async function load(path, depth) {
    const text = await readFile(join(root, path), 'utf8')
    const source = sources.get(path) ?? { path, kind: instructionFile.test(path) ? 'instructions' : 'import', ...size(text), imports: [] }
    sources.set(path, source)
    if ((posix.basename(path) !== 'CLAUDE.md' && depth === 0) || depth === importDepth) return
    if ((expandedDepth.get(path) ?? Infinity) <= depth) return
    expandedDepth.set(path, depth)
    source.imports = importsIn(text).map(target => posix.normalize(posix.join(posix.dirname(path), target))).filter(imported => present.has(imported))
    for (const imported of source.imports) await load(imported, depth + 1)
  }
  for (const path of files.filter(path => instructionFile.test(path))) await load(path, 0)
  for (const path of files.filter(path => skillDescription.test(path))) {
    const text = await description(await readFile(join(root, path), 'utf8'), path)
    if (text !== null) sources.set(path, { path, kind: 'skill-description', ...size(text) })
  }
  const list = [...sources.values()]
  return { sources: list, total: Object.fromEntries(['bytes', 'lines', 'tokens'].map(key => [key, list.reduce((sum, source) => sum + source[key], 0)])) }
}
