import { readFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { Lexer, Tokenizer } from 'marked'
import { markdownTokens } from './document-references.mjs'
import { readGit, repoFiles } from './discovery.mjs'
import { matchesPath, pathGlob } from './glob.mjs'
import { resolveFilePath } from './paths.mjs'
import { validateData } from './schema.mjs'
import { CommandError } from './result.mjs'
import schema from '../../schemas/project.schema.json' with { type: 'json' }

const contractPath = '.bstack/project.json'
const importDepth = 5
const skillDescription = /^\.(?:claude|agents)\/skills\/[^/]+\/SKILL\.md$/
const instructionFile = /(?:^|\/)(?:AGENTS\.md|CLAUDE\.md)$/

export async function loadInstructionSettings(root, file = contractPath) {
  let text
  try { text = await readFile(await resolveFilePath(root, file), 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return { exclude: [], baseline: null }
    throw error
  }
  let contract
  try { contract = JSON.parse(text) } catch {
    throw new CommandError('blocked', [{ code: 'contract-unavailable', path: file, message: 'The project contract must be readable JSON.', fix: `Repair ${file} or remove it.` }])
  }
  validateData(schema, contract)
  return { exclude: contract.instructions?.exclude ?? [], baseline: contract.instructions?.baseline ?? null }
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

function instructionProse(tokens) {
  return tokens.map(token => {
    if (token.type === 'code' || token.type === 'codespan') return '\n\n'
    if (token.type === 'list') return '\n' + token.items.map(item => instructionProse(item.tokens)).join('\n') + '\n'
    if (token.type === 'blockquote') return '\n' + instructionProse(token.tokens) + '\n'
    if (token.type === 'table') return '\n' + [...token.header, ...token.rows.flat()].map(cell => instructionProse(cell.tokens)).join('\n') + '\n'
    if (token.type === 'html' && token.block) {
      const tokenizer = Object.assign(new Tokenizer(), { html: () => undefined })
      return instructionProse(new Lexer({ gfm: true, tokenizer }).lex(token.raw))
    }
    if (!token.tokens) return token.raw
    let cursor = 0
    let prose = ''
    for (const child of token.tokens) {
      const start = token.raw.indexOf(child.raw, cursor)
      prose += token.raw.slice(cursor, start) + instructionProse([child])
      cursor = start + child.raw.length
    }
    return prose + token.raw.slice(cursor)
  }).join('')
}

function importsIn(text) {
  return [...instructionProse(markdownTokens(text)).matchAll(/(?:^|\s)@(\S+)/g)].map(match => match[1].replace(/[.,;:!?)]+$/, ''))
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
    if (sources.has(path)) continue
    const text = await description(await readFile(join(root, path), 'utf8'), path)
    if (text !== null) sources.set(path, { path, kind: 'skill-description', ...size(text) })
  }
  const list = [...sources.values()]
  return { sources: list, total: Object.fromEntries(['bytes', 'lines', 'tokens'].map(key => [key, list.reduce((sum, source) => sum + source[key], 0)])) }
}

export async function checkInstructionGrowth(root, file) {
  file ??= contractPath
  const { exclude, baseline } = await loadInstructionSettings(root, file)
  if (!baseline) return []
  let path = file
  let priorFile
  const visited = new Set()
  for (;;) {
    const parts = path.split('/')
    let linked = false
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/')
      const entry = readGit(root, ['ls-tree', 'origin/main', '--', prefix])
      if (!entry.stdout.startsWith('120000 ')) continue
      const target = readGit(root, ['show', `origin/main:${prefix}`])
      path = posix.normalize(posix.join(posix.dirname(prefix), target.stdout, ...parts.slice(i)))
      if (visited.has(path) || path === '..' || path.startsWith('../') || posix.isAbsolute(target.stdout)) {
        throw new CommandError('blocked', [{ code: 'prior-contract-invalid', path: file, message: 'The origin/main project contract must be readable JSON.', fix: 'Repair the prior contract before comparing instruction baselines.' }])
      }
      visited.add(path)
      linked = true
      break
    }
    if (!linked) {
      priorFile = readGit(root, ['show', `origin/main:${path}`])
      break
    }
  }
  let prior
  if (priorFile.status === 0) {
    try { prior = JSON.parse(priorFile.stdout) } catch {
      throw new CommandError('blocked', [{ code: 'prior-contract-invalid', path: file, message: 'The origin/main project contract must be readable JSON.', fix: 'Repair the prior contract before comparing instruction baselines.' }])
    }
    validateData(schema, prior)
  }
  const previous = prior?.instructions?.baseline
  const problems = []
  if (previous && baseline.bytes > previous.bytes && (baseline.reason.trim() === previous.reason.trim() || baseline.reason.trim() === 'Measured when registered')) {
    problems.push({ code: 'instructions-baseline-reason', path: file, message: 'The instruction baseline increased without a new growth reason.',
      fix: 'Replace instructions.baseline.reason with a reason for the growth.' })
  }
  const { total } = await measureInstructions(root, await includedFiles(root, exclude))
  if (total.bytes > baseline.bytes) problems.push({ code: 'instructions-grew', path: file, message: `Loaded instructions measure ${total.bytes} bytes, above the recorded baseline of ${baseline.bytes} bytes (${baseline.reason}).`,
    fix: 'Shrink the instructions, or raise instructions.baseline.bytes to the new measure in the same change with a reason for the growth.' })
  return problems
}
