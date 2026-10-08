import { basename } from 'node:path'
import { isAlias, isMap, isScalar, parseDocument, visit } from 'yaml'
import { inspectJSON } from './json.mjs'
import { CommandError } from './result.mjs'

function reject(path) {
  throw new CommandError('failed', [{ code: 'ignored-check-failure', path,
    message: 'Check integration must preserve failures. Use simple commands joined with && and disable failure-tolerance settings.',
    fix: 'Review a failure-preserving command and prove its exit code in disposable controls.' }])
}

// A bounded command grammar avoids claiming to understand arbitrary shell programs.
// Quoted arguments are literal; shell control flow must use fail-fast && chains.
function command(text, path) {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.slice(0, -1).some(line => !line.endsWith('&&'))) reject(path)
  text = lines.join(' ')
  let quote = null
  let escaped = false
  let word = ''
  const words = []
  const flush = () => { if (word) words.push(word); word = '' }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (escaped) { word += char; escaped = false; continue }
    if (char === '\\' && quote !== "'") { escaped = true; continue }
    if (char === quote) { quote = null; continue }
    if (!quote && (char === '"' || char === "'")) { quote = char; continue }
    if (quote === "'") { word += char; continue }
    if (char === '`' || char === '$') reject(path)
    if (quote) { word += char; continue }
    if (char === '&' && text[i + 1] === '&') { flush(); words.push('&&'); i++; continue }
    if ('#|;&!<>\n\r(){}'.includes(char)) reject(path)
    if (/\s/.test(char)) flush()
    else word += char
  }
  if (quote || escaped) reject(path)
  flush()
  if (!words.length || words[0] === '&&' || words.at(-1) === '&&') reject(path)
  let first = true
  for (const [index, word] of words.entries()) {
    if (word === '&&' && words[index - 1] === '&&') reject(path)
    if (word === '&&') { first = true; continue }
    if (first && /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) reject(path)
    if (first && ['set', 'exit', 'trap', 'eval', 'exec', 'env', 'sh', 'bash', 'zsh', 'cmd', 'powershell', 'pwsh']
      .includes(word.split(/[\\/]/).at(-1).toLowerCase().replace(/\.exe$/, ''))) reject(path)
    first = false
  }
}

export function validateCheckIntegration(path, original, proposed) {
  if (proposed === null) return
  if (basename(path) === 'package.json') {
    const before = original === null ? {} : inspectJSON(original).value.scripts ?? {}
    const after = inspectJSON(proposed).value.scripts ?? {}
    for (const [name, value] of Object.entries(after)) {
      if (value !== before[name]) {
        if (typeof value !== 'string') reject(path)
        command(value, path)
      }
    }
  }
  if (!/\.(ya?ml)$/i.test(path)) return
  const document = parseDocument(proposed)
  if (document.errors.length || document.warnings.length) reject(path)
  visit(document, (_, node) => {
    if (isAlias(node) || node?.anchor || node?.tag || node?.flow) reject(path)
    if (!isMap(node)) return
    for (const { key, value } of node.items) {
      if (!isScalar(key)) reject(path)
      if (['continue-on-error', 'allow_failure'].includes(key.value) && (!isScalar(value) || value.value !== false)) reject(path)
      if (!['run', 'script'].includes(key.value)) continue
      if (!isScalar(value) || typeof value.value !== 'string') reject(path)
      command(value.value, path)
    }
  })
}
