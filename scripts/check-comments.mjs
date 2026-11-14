import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

const { default: metadata } = await import('typescript/package.json', { with: { type: 'json' } })
const major = Number(metadata.version.split('.')[0])
const { default: ts } = await import(major >= 7 ? '@typescript/typescript6' : 'typescript')

const rule = 'no-prose-comments'
const exempt = ["^//\\s*[a-z]+-disable-(?:next-)?line\\s+(@?[A-Za-z0-9_][\\w/-]*(?:\\s*,\\s*@?[A-Za-z0-9_][\\w/-]*)*)(?:\\s|$)", "^/\\*\\s*[a-z]+-(?:disable(?:-(?:next-)?line)?|enable)\\s+(@?[A-Za-z0-9_][\\w/-]*(?:\\s*,\\s*@?[A-Za-z0-9_][\\w/-]*)*)(?:\\s|\\*/|$)", "^///\\s*<reference\\s"].map(pattern => new RegExp(pattern))
const license = new RegExp("SPDX-License-Identifier|Copyright|Licensed under|All rights reserved")
const suppression = new RegExp('^(/[/]\\s*|/[*]+\\s*)([a-z]+-(disable|enable)|@ts-(ignore|expect-error|nocheck))')

function violations(path) {
  const text = readFileSync(path, 'utf8')
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const documented = new Set()
  const publicMember = node => !(node.name && ts.isPrivateIdentifier(node.name))
    && !node.modifiers?.some(item => item.kind === ts.SyntaxKind.PrivateKeyword || item.kind === ts.SyntaxKind.ProtectedKeyword)
  const keep = node => { for (const doc of node.jsDoc ?? []) documented.add(doc.pos) }
  const bindingNames = name => ts.isIdentifier(name) ? [name.text]
    : name.elements.filter(ts.isBindingElement).flatMap(element => bindingNames(element.name))
  const inspectType = node => {
    if (!node) return
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) if (publicMember(member)) inspectPublic(member)
    } else {
      ts.forEachChild(node, child => {
        if (ts.isTypeNode(child) || ts.isTypeParameterDeclaration(child) || ts.isParameter(child)) inspectType(child)
      })
    }
  }
  const inspectExpression = node => {
    if (!node) return
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node)) inspectPublic(node)
    else if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) inspectExpression(property.expression)
        else inspectPublic(property)
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) inspectExpression(ts.isSpreadElement(element) ? element.expression : element)
    } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
      || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) {
      inspectType(node.type)
      inspectExpression(node.expression)
    }
  }
  const inspectPublic = node => {
    keep(node)
    if (ts.isVariableDeclaration(node) && !ts.isIdentifier(node.name)) return
    inspectType(node.type)
    for (const parameter of node.typeParameters ?? []) inspectType(parameter)
    for (const parameter of node.parameters ?? []) inspectType(parameter.type)
    for (const clause of node.heritageClauses ?? []) {
      for (const type of clause.types) for (const argument of type.typeArguments ?? []) inspectType(argument)
    }
    inspectExpression(node.initializer)
    if (ts.isExportAssignment(node)) inspectExpression(node.expression)
    for (const member of node.members ?? []) {
      if (publicMember(member)) inspectPublic(member)
      if (ts.isConstructorDeclaration(member)) {
        for (const parameter of member.parameters) {
          if (ts.isParameterPropertyDeclaration(parameter, member) && publicMember(parameter)) inspectPublic(parameter)
        }
      }
    }
  }
  const inspect = (statements, exported = false, ambient = source.isDeclarationFile) => {
    const exportedNames = new Set(statements.filter(ts.isExportDeclaration).flatMap(node =>
      node.exportClause && ts.isNamedExports(node.exportClause) && !node.moduleSpecifier
        ? node.exportClause.elements.map(item => (item.propertyName ?? item.name).text) : []))
    for (const node of statements) {
      if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) exportedNames.add(node.expression.text)
    }
    for (const node of statements) {
      const augmentation = ts.isModuleDeclaration(node) && (!!(node.flags & ts.NodeFlags.GlobalAugmentation) || ts.isStringLiteral(node.name))
      const visible = exported || augmentation || ts.isExportAssignment(node) || node.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword || item.kind === ts.SyntaxKind.DefaultKeyword)
        || (node.name && ts.isIdentifier(node.name) && exportedNames.has(node.name.text))
      if (ts.isVariableStatement(node)) {
        const declarations = node.declarationList.declarations.filter(item => visible || bindingNames(item.name).some(name => exportedNames.has(name)))
        if (declarations.length) keep(node)
        for (const declaration of declarations) inspectPublic(declaration)
        continue
      }
      if (!visible) continue
      inspectPublic(node)
      if (ts.isModuleDeclaration(node) && node.body) {
        const context = ambient || augmentation || !!node.modifiers?.some(item => item.kind === ts.SyntaxKind.DeclareKeyword)
        if (ts.isModuleBlock(node.body)) inspect(node.body.statements, context, context)
        else if (ts.isModuleDeclaration(node.body)) inspect([node.body], true, context)
      }
    }
  }
  inspect(source.statements, source.isDeclarationFile && !ts.isExternalModule(source))
  const ranges = new Map()
  let first = true
  const visit = node => {
    if (node.kind === ts.SyntaxKind.JsxText) return
    const children = node.getChildren(source)
    if (children.length) return children.forEach(visit)
    for (const [list, leading] of [[ts.getLeadingCommentRanges(text, node.getFullStart()), first], [ts.getTrailingCommentRanges(text, node.getEnd()), false]]) {
      for (const range of list ?? []) if (!ranges.has(range.pos)) ranges.set(range.pos, { ...range, leading })
    }
    first = false
  }
  visit(source)
  const found = [...ranges.values()].sort((a, b) => a.pos - b.pos).map(range => {
    const start = source.getLineAndCharacterOfPosition(range.pos)
    const last = source.getLineAndCharacterOfPosition(range.end)
    return { text: text.slice(range.pos, range.end), documented: documented.has(range.pos), line: start.line + 1, last: last.line + 1, leading: range.leading }
  })
  const licensed = new Set()
  for (let start = 0; start < found.length;) {
    let end = start + 1
    while (end < found.length && found[end].leading && found[end].line === found[end - 1].last + 1) end++
    if (found[start].leading && found.slice(start, end).some(item => license.test(item.text))) {
      for (let index = start; index < end; index++) licensed.add(index)
    }
    start = end
  }
  const seen = new Map()
  const kept = []
  for (const [index, item] of found.entries()) {
    const directive = exempt.some(pattern => {
      const match = pattern.exec(item.text)
      return match && (!match[1] || match[1].split(',').every(selector => selector.trim().toLowerCase() !== 'all'))
    })
    const documentation = !suppression.test(item.text) && (item.documented || new RegExp('https?://[^\\s<>]+').test(item.text))
    if (licensed.has(index) || documentation || (item.line === 1 && item.text.startsWith('#!')) || directive) continue
    const digest = createHash('sha256').update(item.text.trim()).digest('hex').slice(0, 12)
    seen.set(digest, (seen.get(digest) ?? 0) + 1)
    kept.push({ rule, path, key: digest + ':' + seen.get(digest), line: item.line, text: item.text })
  }
  return kept
}

function loadBaseline(path) {
  const document = JSON.parse(readFileSync(path, 'utf8'))
  if (!document || typeof document !== 'object' || Array.isArray(document) || Object.keys(document).length !== 2 || document.schemaVersion !== 1 || !Array.isArray(document.entries)) throw new Error('Expected a version-1 baseline with an entries array.')
  const fields = ['rule', 'path', 'key', 'reason', 'removalCondition']
  const seen = new Set()
  for (const entry of document.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== fields.length || fields.some(field => typeof entry[field] !== 'string' || !/\S/.test(entry[field]))) throw new Error('Baseline entries require five nonempty string fields.')
    const id = JSON.stringify([entry.rule, entry.path, entry.key])
    if (seen.has(id)) throw new Error('Duplicate baseline entry.')
    seen.add(id)
  }
  return document.entries
}

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
let entries = []
try {
  if (args.includes('--baseline')) entries = loadBaseline(option('--baseline'))
} catch (error) {
  console.error('invalid-baseline: ' + error.message)
  process.exit(2)
}
const files = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--baseline')
const listed = files.length ? files : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z', '--', '*.ts', '*.tsx', '*.mts', '*.cts', '*.js', '*.jsx', '*.mjs', '*.cjs'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const found = [...new Set(listed)].filter(path => files.length || existsSync(path)).flatMap(violations)
if (args.includes('--list')) {
  console.log(JSON.stringify(found.map(({ rule, path, key }) => ({ rule, path, key }))))
} else {
  const identity = item => JSON.stringify([item.rule, item.path, item.key])
  const recorded = new Map(entries.map(entry => [identity(entry), entry]))
  const current = new Set(found.map(identity))
  let failed = false
  for (const item of found.filter(item => !recorded.has(identity(item)))) {
    failed = true
    console.log(item.path + ':' + item.line + ': ' + rule + ': prose comment: ' + item.text + '. Use a name, type or test that expresses it.')
  }
  for (const [id, entry] of recorded) {
    if (current.has(id)) continue
    failed = true
    console.log(option('--baseline') + ':1: ' + rule + ': baseline entry ' + entry.key + ' for ' + entry.path + ' no longer matches a comment. Use the baseline without this entry.')
  }
  process.exitCode = failed ? 1 : 0
}
