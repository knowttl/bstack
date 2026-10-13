import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'

// The source and every copy resolve from this checkout, independent of the caller's directory.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// An installed skill cannot import outside its own folder, so each one that runs the shared scripts carries a copy.
const targets = ['skills/repo-audit', 'skills/verification']

function relativeSpecifiers(text) {
  const specifiers = []
  function visit(node) {
    if (!node || typeof node !== 'object') return
    let source
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) source = node.source
    if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && node.callee.name === 'URL') source = node.arguments[0]
    const value = source?.type === 'Literal' ? source.value
      : source?.type === 'TemplateLiteral' && source.expressions.length === 0 ? source.quasis[0].value.cooked : null
    if (typeof value === 'string' && /^\.{1,2}\//.test(value)) specifiers.push(value)
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit)
      else if (child && typeof child === 'object') visit(child)
    }
  }
  visit(parse(text, { ecmaVersion: 'latest', sourceType: 'module' }))
  return specifiers
}

async function listFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  return entries.filter(entry => entry.isFile())
    .map(entry => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/')).sort()
}

try {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node scripts/sync-runtime.mjs [--check]')
  }
  const check = args[0] === '--check'
  const source = join(root, 'runtime')
  const files = await listFiles(source)
  if (files.length === 0) throw new Error('No shared runtime files found')
  // A script importing outside the source would work in repo-audit and fail in the other copies.
  const escapes = []
  for (const file of files.filter(name => name.endsWith('.mjs'))) {
    for (const specifier of relativeSpecifiers(await readFile(join(source, file), 'utf8'))) {
      if (!files.includes(posix.join(posix.dirname(file), specifier))) escapes.push(`runtime/${file} imports ${specifier} outside the shared runtime`)
    }
  }
  if (escapes.length) throw new Error(escapes.join('\n'))
  const stale = []
  for (const target of targets) {
    for (const file of files) {
      const bytes = await readFile(join(source, file))
      const path = join(root, target, ...file.split('/'))
      const current = await readFile(path).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
      if (current?.equals(bytes)) continue
      if (check) {
        stale.push(`${target}/${file} is ${current ? 'stale' : 'missing'}`)
      } else {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, bytes)
        console.log(`Copied runtime/${file} to ${target}`)
      }
    }
  }
  if (stale.length) throw new Error(`${stale.join('\n')}\nRun node scripts/sync-runtime.mjs`)
  console.log(`${check ? 'Checked' : 'Synced'} ${files.length} runtime files in ${targets.length} skills`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
