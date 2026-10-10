import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBuiltin } from 'node:module'
import { parse } from 'acorn'
import { lexer } from 'marked'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'

// Keep the default independent of the caller's working directory.
const defaultSkill = fileURLToPath(new URL('../skills/repo-audit/', import.meta.url))
// Installed dependencies, Git data and local scratch are not authored resources.
const excluded = new Set(['node_modules', '.git', '.cache', 'scratch'])
// Recognise common bundled lint policies without prescribing a language stack.
const lintFiles = /^(?:\.eslintrc(?:\.(?:json|ya?ml|[cm]?js))?|eslint\.config\.[cm]?js|\.prettierrc(?:\.(?:json|ya?ml|[cm]?js))?|prettier\.config\.[cm]?js|\.?ruff\.toml|\.pylintrc|mypy\.ini|\.flake8|biome\.jsonc?)$/i
// This deliberately short list is a syntactic control, not a tool catalogue.
const lintTools = /\b(?:eslint|prettier|ruff|pylint|mypy|flake8|biome)\b|\beslint-config-[\w-]+\b/gi

function scriptProblems(file, text, dependencies, add) {
  const comments = []
  let program
  try {
    program = parse(text, { ecmaVersion: 'latest', sourceType: file.endsWith('.cjs') ? 'script' : 'module', allowReturnOutsideFunction: file.endsWith('.cjs'), locations: true, onComment: comments })
  } catch (error) {
    add('script-syntax', file, error.message, 'Use valid JavaScript supported by the package checker.')
    return
  }
  for (const statement of program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
    if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') continue
    const line = statement.loc.start.line
    if (!comments.some(comment => comment.loc.end.line === line - 1)) {
      add('constant-comment', file, `Top-level const at line ${line} has no comment on the preceding line.`, 'Add a comment explaining the declaration on the line above.')
    }
  }
  function visit(node) {
    if (!node || typeof node !== 'object') return
    let source
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) source = node.source
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') source = node.arguments[0] ?? { type: 'Missing' }
    if (source) {
      const specifier = source.type === 'Literal' && typeof source.value === 'string' ? source.value : null
      const packageName = specifier?.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier?.split('/')[0]
      if (specifier !== null && !/^(?:\.\.?\/)/.test(specifier) && !isBuiltin(specifier) && !dependencies.has(packageName)) {
        add('script-import', file, `Unapproved import at line ${node.loc.start.line}: ${specifier}`, 'Use a Node built-in, a local literal path or a declared runtime dependency.')
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value?.type) visit(value)
    }
  }
  visit(program)
}

function lines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length
}

function paths(text) {
  const found = new Set()
  // Markdown destinations include inline links, images and reference definitions.
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)|^\s*\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm)) {
    found.add((match[1] ?? match[2]).replace(/^<|>$/g, ''))
  }
  // Quoted explicit relative paths cover prose, source imports and resource strings.
  for (const match of text.matchAll(/([`"'])([^`"'\r\n]+)\1/g)) {
    if (/^(?:\.\.?\/|references\/|scripts\/|schemas\/|assets\/|agents\/)/.test(match[2])) found.add(match[2])
  }
  return [...found].filter(path => {
    let destination = path
    try { destination = decodeURIComponent(path.split(/[?#]/)[0]) } catch {}
    return !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(destination.replace(/(\.[^/:?#]+):\d+(?::\d+)?$/, '$1'))
  })
}

export async function checkPackage(skill, { sourcePreflight = false } = {}) {
  const problems = []
  const files = new Map()
  const add = (code, path, message, fix) => problems.push({ code, path, message: `${path}: ${message}`, fix })
  async function walk(directory) {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
      add('package-unreadable', relative(skill, directory) || '.', error.message, 'Supply a readable skill folder.')
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (excluded.has(entry.name)) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else {
        try {
          if (!(await stat(path)).isFile()) continue
          const bytes = await readFile(path)
          files.set(relative(skill, path).split(sep).join('/'), bytes.includes(0) ? null : bytes.toString('utf8'))
        } catch (error) {
          add('package-unreadable', relative(skill, path), error.message, 'Restore the readable authored file.')
        }
      }
    }
  }
  await walk(skill)
  const document = files.get('SKILL.md') ?? ''
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const body = frontmatter ? document.slice(frontmatter[0].length) : document
  const dependencies = new Set()
  if (files.has('package.json')) {
    try {
      const manifest = JSON.parse(files.get('package.json'))
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Expected a package manifest object.')
      for (const field of ['dependencies', 'optionalDependencies']) {
        if (manifest[field] !== undefined && (!manifest[field] || typeof manifest[field] !== 'object' || Array.isArray(manifest[field]) || Object.values(manifest[field]).some(value => typeof value !== 'string' || !value))) throw new Error(`Invalid ${field}.`)
        Object.keys(manifest[field] ?? {}).forEach(name => dependencies.add(name))
      }
    } catch (error) {
      add('package-manifest', 'package.json', error.message, 'Supply a valid JSON manifest with runtime dependency maps.')
    }
  }
  const tokens = lexer(body)
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.type !== 'heading' || token.depth !== 3 || !/^Step(?:\s|$)/.test(token.text) || !/^ {0,3}###\s/.test(token.raw)) continue
    const section = []
    for (let next = index + 1; next < tokens.length && tokens[next].type !== 'heading'; next++) section.push(tokens[next])
    if (!section.some(part => part.type === 'paragraph' && /^Done when:/m.test(part.raw))) {
      add('step-done', 'SKILL.md', `${token.text} has no Done when: line before the next heading.`, 'Add a paragraph line starting Done when: within this step.')
    }
  }
  if (!/^disable-model-invocation: true\s*$/m.test(frontmatter?.[1] ?? '')) {
    add('host-metadata', 'SKILL.md', 'Missing disable-model-invocation: true in frontmatter.', 'Add the literal user-only setting to SKILL.md frontmatter.')
  }
  if (!/^policy:\s*\r?\n(?:[ \t]+[^\r\n]*\r?\n)*?  allow_implicit_invocation: false\s*$/m.test(files.get('agents/openai.yaml') ?? '')) {
    add('host-metadata', 'agents/openai.yaml', 'Missing policy.allow_implicit_invocation: false.', 'Add the literal indented user-only policy in agents/openai.yaml.')
  }
  if (lines(body) > 500) add('skill-too-long', 'SKILL.md', 'SKILL.md body exceeds 500 lines.', 'Keep the body at most 500 lines.')
  const loadSection = body.match(/^#{1,6} Load when\s*\r?\n([\s\S]*?)(?=^#{1,6} |$(?![\s\S]))/m)?.[1] ?? ''
  const listed = new Set(paths(loadSection.split('\n').filter(line => /^\s*\|.*\|\s*$/.test(line)).join('\n')))
  for (const [file, text] of files) {
    if (lintFiles.test(file.split('/').at(-1))) add('language-policy', file, 'Bundled lint configuration is prohibited.', 'Remove bundled language policy and select tools through project research.')
    const reference = file.startsWith('references/')
    if (reference && !listed.has(file)) add('reference-unlisted', file, 'Reference is absent from the Load when table.', 'List this file in a table row under Load when.')
    if (text === null) continue
    const tools = [...new Set([...text.matchAll(lintTools)].map(match => match[0].toLowerCase()))]
    if (tools.length) add('language-policy', file, `Bundled language tool or preset names: ${tools.join(', ')}`, 'Remove bundled tool names and select tools through project research.')
    if (/\.(?:mjs|cjs|js)$/.test(file)) scriptProblems(file, text, dependencies, add)
    if (reference && lines(text) > 100 && !/^#{1,6} (?:Table of contents|Contents|TOC)\s*$/im.test(text.split(/\r?\n/).slice(0, 20).join('\n'))) {
      add('reference-toc', file, 'Reference exceeds 100 lines without an early contents heading.', 'Add a contents heading in its first 20 lines.')
    }
    for (const raw of paths(text)) {
      let path
      try { path = decodeURIComponent(raw.split(/[?#]/)[0]).replace(/:\d+(?::\d+)?$/, '') } catch {
        add('local-path-missing', file, `Invalid encoded local path: ${raw}`, 'Use a valid local path.')
        continue
      }
      if (!path) continue
      const target = resolve(/^(?:references|scripts|schemas|assets|agents)\//.test(path) ? skill : dirname(join(skill, file)), path)
      const targetName = relative(skill, target).split(sep).join('/')
      const runtimeResource = targetName.startsWith('node_modules/') && dependencies.has(targetName.slice('node_modules/'.length).split('/').slice(0, targetName.startsWith('node_modules/@') ? 2 : 1).join('/'))
      if (runtimeResource && sourcePreflight) continue
      if (targetName === '..' || targetName.startsWith('../') || isAbsolute(targetName) || (!runtimeResource && targetName.split('/').some(part => excluded.has(part)))) {
        add('package-closure', file, `Local resource is outside the authored package: ${raw}`, 'Bundle the resource inside the skill folder and reference its authored path.')
        continue
      }
      if (reference && targetName.startsWith('references/')) {
        add('reference-nested', file, `Reference points to another reference: ${raw}`, 'Link each reference directly from SKILL.md instead.')
      }
      try { await stat(target) } catch {
        add('local-path-missing', file, `Local path does not exist: ${raw}`, 'Restore the resource or correct the path.')
      }
    }
  }
  return problems
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/check-package.mjs [--skill <folder>]\nChecks authored skill metadata, resources, imports, constants, steps and language policy.\nDefault: skills/repo-audit/ in this checkout.\nExample: node scripts/check-package.mjs --skill tests/package-check/valid')
  } else if (args.length && (args.length !== 2 || args[0] !== '--skill' || !args[1] || args[1].startsWith('--'))) {
    emitResult({ command: 'check-package', status: 'usage-error', problems: [{ code: 'invalid-arguments', message: 'Expected only --skill <folder>.', fix: 'Run node scripts/check-package.mjs --help.' }] }, false)
  } else {
    const skill = args.length ? resolve(args[1]) : defaultSkill
    const problems = await checkPackage(skill)
    emitResult({ command: 'check-package', status: problems.length ? 'failed' : 'passed', problems, inputs: { skill } }, false)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
