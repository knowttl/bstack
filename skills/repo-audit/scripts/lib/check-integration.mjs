import { basename } from 'node:path'
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
    if ('|;&!<>\n\r(){}'.includes(char)) reject(path)
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
  const lines = proposed.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*[\[{]|:\s*[\[{*&!]/.test(line) && !/^\s*#/.test(line)) reject(path)
    const setting = line.match(/^\s*(?:-\s*)?(?:['"])?(continue-on-error|allow_failure)(?:['"])?\s*:\s*(.*?)\s*(?:#.*)?$/)
    if (setting && setting[2] !== 'false') reject(path)
    const run = line.match(/^(\s*)(?:-\s*)?(?:['"])?(?:run|script)(?:['"])?\s*:\s*(.*)$/)
    if (!run) continue
    let value = run[2].trim()
    if (/^[\[{*&!]/.test(value)) reject(path)
    if (/^[|>][+-]?$/.test(value)) {
      const block = []
      while (i + 1 < lines.length && (!lines[i + 1].trim() || lines[i + 1].match(/^\s*/)[0].length > run[1].length)) {
        const next = lines[++i].trim()
        if (next && !next.startsWith('#')) block.push(next)
      }
      value = block.join(' ')
      // Each line must explicitly propagate failure to the next command.
      if (block.slice(0, -1).some(item => !item.endsWith('&&'))) reject(path)
    } else if (value.startsWith('"') || value.startsWith("'")) {
      if (value.startsWith('"')) {
        try { value = JSON.parse(value) } catch { reject(path) }
      } else {
        if (!value.endsWith("'")) reject(path)
        value = value.slice(1, -1).replaceAll("''", "'")
      }
    }
    command(value, path)
  }
}
