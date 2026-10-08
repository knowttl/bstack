import { CommandError } from './result.mjs'

export function inspectJSON(text) {
  const value = JSON.parse(text)
  const tokens = [...text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]|[^\s{}\[\],:]+/g)]
  const entries = new Map()
  let index = 0
  function consume(root = false) {
    const token = tokens[index++][0]
    if (token !== '{' && token !== '[') return
    const keys = new Set()
    const close = token === '{' ? '}' : ']'
    while (tokens[index][0] !== close) {
      let key
      if (token === '{') {
        key = JSON.parse(tokens[index++][0])
        if (keys.has(key)) throw new CommandError('failed', [{ code: 'duplicate-key', message: `Duplicate JSON key: ${key}`, fix: 'Supply JSON with unique member names in every object.' }])
        keys.add(key)
        index++
      }
      const start = tokens[index].index
      consume()
      const last = tokens[index - 1]
      if (root && token === '{') entries.set(key, { start, end: last.index + last[0].length })
      if (tokens[index][0] === ',') index++
    }
    index++
  }
  consume(true)
  return { value, entries, close: tokens[index - 1].index }
}
