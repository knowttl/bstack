import { basename } from 'node:path'
import { inspectJSON } from './json.mjs'
import { CommandError } from './result.mjs'

function reject(path) {
  throw new CommandError('failed', [{ code: 'ignored-check-failure', path,
    message: 'Check integration must preserve failures. Use simple commands joined with && and disable failure-tolerance settings.',
    fix: 'Review selected command paths and failure-preserving commands, use JSON syntax for marked CI edits, and prove exit codes in disposable controls.' }])
}

export function isIndirectExecutable(executable) {
  const name = executable.split(/[\\/]/).at(-1).toLowerCase().replace(/\.(exe|cmd|bat)$/, '')
  return ['set', 'exit', 'trap', 'eval', 'exec', 'env', 'command', 'builtin', 'source', '.',
    'sh', 'bash', 'rbash', 'zsh', 'dash', 'ash', 'ksh', 'ksh88', 'ksh93', 'mksh', 'pdksh', 'yash', 'posh',
    'csh', 'tcsh', 'fish', 'busybox', 'time', 'nohup', 'nice', 'timeout', 'setsid', 'sudo', 'doas', 'xargs',
    'cmd', 'powershell', 'pwsh', 'call', 'start'].includes(name)
}

// A bounded command grammar avoids claiming to understand arbitrary shell programs.
// Quoted arguments are literal; shell control flow must use fail-fast && chains.
export function integrationCommand(text, path) {
  text = text.trim()
  let quote = null
  let word = ''
  const words = []
  const flush = () => {
    if (/[|;&`\r\n]|\$\(/.test(word)) reject(path)
    if (word) words.push(word)
    word = ''
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\\') reject(path)
    if (char === quote) { quote = null; continue }
    if (!quote && (char === '"' || char === "'")) { quote = char; continue }
    if (quote === "'") { word += char; continue }
    if (char === '`' || char === '$') reject(path)
    if (quote) { word += char; continue }
    if (char === '&' && text[i + 1] === '&') { flush(); words.push('&&'); i++; continue }
    if (char === '\n' || char === '\r') {
      flush()
      if (words.at(-1) !== '&&') reject(path)
      continue
    }
    if ('#|;&!<>(){}*?[]~%^'.includes(char)) reject(path)
    if (/\s/.test(char)) flush()
    else word += char
  }
  if (quote) reject(path)
  flush()
  if (!words.length || words[0] === '&&' || words.at(-1) === '&&') reject(path)
  let first = true
  for (const [index, word] of words.entries()) {
    if (word === '&&' && words[index - 1] === '&&') reject(path)
    if (word === '&&') { first = true; continue }
    if (first && /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) reject(path)
    if (!first) continue
    const executable = word.split(/[\\/]/).at(-1).toLowerCase().replace(/\.(exe|cmd|bat)$/, '')
    if (isIndirectExecutable(word)) reject(path)
    const next = words.indexOf('&&', index + 1)
    const args = words.slice(index + 1, next === -1 ? words.length : next)
    if ((executable === 'npx' || (executable === 'npm' && args.some(arg => ['exec', 'x'].includes(arg)))) &&
      args.some(arg => /^--call(?:=|$)|^-[^-]*c/.test(arg))) reject(path)
    first = false
  }
  return words
}

export function validateCheckIntegration(path, proposed, selected) {
  if (!selected) return
  const packageScript = basename(path) === 'package.json'
  if (proposed === null || (!packageScript && !/\.ya?ml$/i.test(path))) reject(path)
  let document
  try { document = inspectJSON(proposed).value } catch { reject(path) }
  for (const keys of selected) {
    if (packageScript ? keys.length !== 2 || keys[0] !== 'scripts' : !['run', 'script'].includes(keys.at(-1))) reject(path)
    let value = document
    for (const key of keys) {
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) reject(path)
      if (!packageScript) {
        for (const setting of ['continue-on-error', 'allow_failure']) {
          if (Object.hasOwn(value, setting) && value[setting] !== false) reject(path)
        }
      }
      value = value[key]
    }
    if (typeof value !== 'string') reject(path)
    integrationCommand(value, path)
  }
}
