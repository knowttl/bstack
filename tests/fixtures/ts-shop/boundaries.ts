import ts from 'typescript'
import { relative, resolve, sep } from 'node:path'
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
const program = ts.createProgram(parsed.fileNames, parsed.options)
const local = (file: string) => relative(process.cwd(), file).split(sep).join('/')
const edges = new Map<string, { to: string, line: number }[]>()
const violations: { rule: string, path: string, line: number, key: string, message: string }[] = []
for (const file of program.getSourceFiles().filter(file => !file.isDeclarationFile)) {
  const from = resolve(file.fileName)
  const targets = []
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue
    if (!statement.moduleSpecifier) continue
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const target = ts.resolveModuleName(specifier, from, parsed.options, ts.sys).resolvedModule
    if (!target) throw new Error(`Unresolved import: ${specifier}`)
    const to = resolve(target.resolvedFileName)
    const line = file.getLineAndCharacterOfPosition(statement.getStart(file)).line + 1
    targets.push({ to, line })
    if (local(from).startsWith('packages/web/') && local(to).startsWith('packages/core/internal/')) {
      violations.push({ rule: specifier.startsWith('@storage/') ? 'alias-import' : 'private-import', path: local(from), line, key: specifier,
        message: `web imports core storage internals through ${specifier}. Use packages/core/index.ts.` })
    }
  }
  edges.set(from, targets)
}
function reaches(file: string, goal: string, seen: Set<string>): boolean {
  if (file === goal) return true
  if (seen.has(file)) return false
  seen.add(file)
  return (edges.get(file) ?? []).some(edge => reaches(edge.to, goal, seen))
}
for (const [from, targets] of edges) {
  for (const { to, line } of targets) {
    if (reaches(to, from, new Set())) {
      violations.push({ rule: 'dependency-cycle', path: local(from), line, key: 'dependency-cycle',
        message: `this import of ${local(to)} leads back to ${local(from)}. Use a one-way dependency.` })
    }
  }
}
violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line)
for (const violation of violations) console.log(`${violation.path}:${violation.line}: ${violation.rule}: ${violation.message}`)
process.exitCode = violations.length ? 1 : 0
