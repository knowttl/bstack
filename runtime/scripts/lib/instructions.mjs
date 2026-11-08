import { readFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
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

function description(text) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]
  if (!frontmatter || /^disable-model-invocation:[ \t]*true[ \t]*$/m.test(frontmatter)) return null
  const lines = frontmatter.split(/\r?\n/)
  const start = lines.findIndex(line => line.startsWith('description:'))
  if (start === -1) return null
  const value = lines[start].slice('description:'.length).trim()
  if (!/^[>|][+-]?$/.test(value)) return value.replace(/^(["'])([\s\S]*)\1$/, '$2')
  const block = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !/^\s/.test(line)) break
    block.push(line.trim())
  }
  return block.join(value.startsWith('>') ? ' ' : '\n').trim()
}

function importsIn(text) {
  const prose = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '')
  return [...prose.matchAll(/(?:^|\s)@(\S+)/g)].map(match => match[1].replace(/[.,;:!?)]+$/, ''))
}

function size(text) {
  const bytes = Buffer.byteLength(text)
  return { bytes, lines: text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0), tokens: Math.ceil(bytes / 4) }
}

export async function measureInstructions(root, files) {
  const present = new Set(files)
  const sources = new Map()
  async function load(path, depth) {
    if (sources.has(path)) return
    const text = await readFile(join(root, path), 'utf8')
    const source = { path, kind: instructionFile.test(path) ? 'instructions' : 'import', ...size(text), imports: [] }
    sources.set(path, source)
    if ((posix.basename(path) !== 'CLAUDE.md' && depth === 0) || depth === importDepth) return
    for (const target of importsIn(text)) {
      const imported = posix.normalize(posix.join(posix.dirname(path), target))
      if (!present.has(imported)) continue
      source.imports.push(imported)
      await load(imported, depth + 1)
    }
  }
  for (const path of files.filter(path => instructionFile.test(path))) await load(path, 0)
  for (const path of files.filter(path => skillDescription.test(path))) {
    const text = description(await readFile(join(root, path), 'utf8'))
    if (text !== null) sources.set(path, { path, kind: 'skill-description', ...size(text) })
  }
  const list = [...sources.values()]
  return { sources: list, total: Object.fromEntries(['bytes', 'lines', 'tokens'].map(key => [key, list.reduce((sum, source) => sum + source[key], 0)])) }
}
