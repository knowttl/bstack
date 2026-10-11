import ts from 'typescript'
import { relative, resolve, sep } from 'node:path'
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
const program = ts.createProgram(parsed.fileNames, parsed.options)
const edges = new Map()
const violations = new Set()
for (const file of program.getSourceFiles().filter(file => !file.isDeclarationFile)) {
  const from = resolve(file.fileName)
  const targets = []
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
    if (!statement.moduleSpecifier) continue
    const specifier = statement.moduleSpecifier.text
    const target = ts.resolveModuleName(specifier, from, parsed.options, ts.sys).resolvedModule
    if (!target) throw new Error(`Unresolved import: ${specifier}`)
    const to = resolve(target.resolvedFileName)
    targets.push(to)
    if (relative(process.cwd(), from).startsWith(`packages${sep}web${sep}`) &&
        relative(process.cwd(), to).startsWith(`packages${sep}core${sep}internal${sep}`)) {
      violations.add(specifier.startsWith('@storage/') ? 'alias' : 'private')
    }
  }
  edges.set(from, targets)
}
function cycle(file, ancestors) {
  if (ancestors.has(file)) return true
  return (edges.get(file) ?? []).some(target => cycle(target, new Set([...ancestors, file])))
}
if ([...edges.keys()].some(file => cycle(file, new Set()))) violations.add('cycle')
console.log(JSON.stringify([...violations].sort()))
process.exitCode = violations.size ? 1 : 0
