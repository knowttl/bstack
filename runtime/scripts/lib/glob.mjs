import { posix, win32 } from 'node:path'
import { CommandError } from './result.mjs'

export function pathGlob(pattern) {
  if (!pattern || pattern.includes('\0') || pattern.includes('\\') || posix.isAbsolute(pattern) || win32.isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern) || pattern.split('/').some(part => !part || part === '.' || part === '..') || /[\[\]{}()!]/u.test(pattern) || pattern.split('/').some(part => part.includes('**') && part !== '**')) {
    throw new CommandError('failed', [{ code: 'invalid-glob', path: pattern, message: 'Expected a relative forward-slash path using only * and ? within segments, or ** as a whole segment.', fix: 'Remove unsupported glob syntax, absolute paths and traversal.' }])
  }
  const states = [[]]
  const characters = Array.from(pattern)
  let current = 0
  const edge = (from, to, symbol) => states[from].push({ to, symbol })
  const next = () => states.push([]) - 1
  for (let index = 0; index < characters.length; index++) {
    const end = next()
    if (characters.slice(index, index + 3).join('') === '**/') {
      const directory = next()
      edge(current, end, null)
      edge(current, directory, 'segment')
      edge(directory, directory, 'segment')
      edge(directory, current, '/')
      index += 2
    } else if (characters.slice(index, index + 2).join('') === '**') {
      edge(current, end, null)
      edge(current, current, 'any')
      index++
    } else if (characters[index] === '*') {
      edge(current, end, null)
      edge(current, current, 'segment')
    } else edge(current, end, characters[index] === '?' ? 'segment' : characters[index])
    current = end
  }
  return { states, end: current, pattern }
}

function accepts(symbol, character) {
  return symbol === 'any' || (symbol === 'segment' ? character !== '/' : symbol === character)
}

// Product traversal proves intersection even for files that do not exist yet.
// The segment state rejects empty, dot and parent segments in the witness path.
export function sharedPath(left, right) {
  const queue = [{ a: 0, b: 0, segment: '', path: '' }]
  const visited = new Set()
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index]
    const key = JSON.stringify([item.a, item.b, item.segment])
    if (visited.has(key)) continue
    visited.add(key)
    if (item.a === left.end && item.b === right.end && item.segment === 'valid') return item.path
    for (const edge of left.states[item.a]) if (edge.symbol === null) queue.push({ ...item, a: edge.to })
    for (const edge of right.states[item.b]) if (edge.symbol === null) queue.push({ ...item, b: edge.to })
    for (const a of left.states[item.a].filter(edge => edge.symbol !== null)) {
      for (const b of right.states[item.b].filter(edge => edge.symbol !== null)) {
        // Literals constrain a transition. Wildcard pairs need an ordinary character and a slash.
        for (const character of new Set([a.symbol, b.symbol, 'a', '/'].filter(value => value !== 'any' && value !== 'segment'))) {
          if (!accepts(a.symbol, character) || !accepts(b.symbol, character)) continue
          if (character === '/' && item.segment !== 'valid') continue
          const segment = character === '/' ? '' : item.segment === '' && character === '.' ? '.' : item.segment === '.' && character === '.' ? '..' : 'valid'
          queue.push({ a: a.to, b: b.to, segment, path: item.path + character })
        }
      }
    }
  }
  return null
}

export function matchesPath(glob, path) {
  // Git filenames are literal, including characters that are glob operators in declarations.
  const states = Array.from(path, (character, index) => [{ to: index + 1, symbol: character }])
  states.push([])
  return sharedPath(glob, { states, end: states.length - 1 }) !== null
}
