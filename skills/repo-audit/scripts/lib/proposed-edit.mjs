import { extname } from 'node:path'
import { validateData } from './schema.mjs'
import { CommandError } from './result.mjs'
import { inspectJSON } from './json.mjs'

function reject(code, message) {
  throw new CommandError('failed', [{ code, message, fix: 'Review a supported, unambiguous mechanical edit and its complete proposed bytes.' }])
}

function jsonObject(text) {
  let parsed
  try { parsed = inspectJSON(text) } catch (error) {
    if (error instanceof CommandError) throw error
    reject('unsupported-format', 'Expected valid JSON.')
  }
  const { value } = parsed
  if (value === null || typeof value !== 'object' || Array.isArray(value)) reject('unsupported-format', 'Expected a JSON object at the root.')
  return parsed
}

function headingSection(text, heading, content) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const headings = []
  let fence
  let offset = 0
  for (const line of lines) {
    const semanticLine = offset === 0 ? line.replace(/^\uFEFF/, '') : line
    if (/^\s+(?:`{3,}|~{3,})/.test(semanticLine)) reject('unsupported-format', 'Unsupported Markdown structure; use whole-file replacement.')
    const marker = /^(`{3,}|~{3,})(.*?)(?:\r?\n)?$/.exec(semanticLine)
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
    } else if (marker) {
      if (!/^[A-Za-z0-9_+.-]*$/.test(marker[2].trim())) reject('unsupported-format', 'Unsupported Markdown structure; use whole-file replacement.')
      fence = marker[1]
    } else if (semanticLine.trim()) {
      if (/^(?:[ \t]|[>\[]|(?:[-+*]|\d+[.)])(?:[ \t]|$)|[=*_ \t-]+[\r\n]*$)|\||<(?:\/?[A-Za-z]|[!?])/.test(semanticLine)) reject('unsupported-format', 'Unsupported Markdown structure; use whole-file replacement.')
      if (semanticLine.startsWith('#')) {
        const match = /^(#{1,6})[ \t]+(.+)$/.exec(semanticLine.replace(/\r?\n$/, ''))
        const title = match?.[2].replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim()
        if (!title) reject('unsupported-format', 'Unsupported Markdown structure; use whole-file replacement.')
        headings.push({ title, level: match[1].length, start: offset, body: offset + line.length })
      }
    }
    offset += line.length
  }
  if (fence) reject('unsupported-format', 'Unsupported Markdown structure; use whole-file replacement.')
  const matches = headings.filter(item => item.title === heading)
  if (matches.length !== 1) reject('ambiguous-heading', 'The heading must identify exactly one ATX section.')
  const selected = matches[0]
  const end = headings.find(item => item.start > selected.start && item.level <= selected.level)?.start ?? text.length
  if (!text.slice(selected.start, selected.body).endsWith('\n')) reject('unsupported-format', 'The heading line needs a line ending before its section body.')
  if (content && !content.endsWith('\n')) reject('unsupported-format', 'Section content must end with a newline.')
  return text.slice(0, selected.body) + content + text.slice(end)
}

export function proposedEdit(edit, original) {
  const fields = {
    create: { content: { type: 'string' } },
    replace: { search: { type: 'string', minLength: 1 }, replacement: { type: 'string' } },
    delete: {},
    'set-heading-section': { heading: { type: 'string', pattern: '\\S' }, content: { type: 'string' } },
    'set-json-key': { key: { type: 'string', minLength: 1 }, value: {} },
    'append-line-once': { line: { type: 'string', minLength: 1, pattern: '^[^\\r\\n]+$' } }
  }[edit.operation]
  validateData({ type: 'object', additionalProperties: false, required: Object.keys(fields), properties: fields }, edit.payload)
  if (edit.operation === 'delete') {
    if (original === null) reject('missing-original', 'Delete requires an existing file.')
    return null
  }
  const format = extname(edit.path).toLowerCase()
  if (!['.md', '.txt', '.json'].includes(format)) reject('unsupported-format', 'Mechanical edits support UTF-8 .md, .txt and JSON objects only.')
  if (edit.operation === 'create') {
    if (original !== null) reject('create-collision', 'Create requires an absent file.')
    if (format === '.json') jsonObject(edit.payload.content)
    return edit.payload.content
  }
  if (original === null) reject('missing-original', 'This operation requires an existing file.')
  if (edit.operation === 'set-json-key') {
    if (format !== '.json') reject('unsupported-format', 'set-json-key requires .json.')
    const { entries, close } = jsonObject(original)
    const value = JSON.stringify(edit.payload.value)
    const entry = entries.get(edit.payload.key)
    if (entry) return original.slice(0, entry.start) + value + original.slice(entry.end)
    return original.slice(0, close) + (entries.size ? ',' : '') + JSON.stringify(edit.payload.key) + ':' + value + original.slice(close)
  }
  if (format === '.json') reject('unsupported-format', 'JSON edits require set-json-key.')
  if (['set-heading-section', 'append-line-once'].includes(edit.operation) && /\r(?!\n)/.test(original)) reject('unsupported-format', 'Line-based edits require LF or CRLF line endings.')
  if (edit.operation === 'set-heading-section') {
    if (format !== '.md') reject('unsupported-format', 'Heading sections require .md.')
    return headingSection(original, edit.payload.heading, edit.payload.content)
  }
  if (edit.operation === 'replace') {
    const position = original.indexOf(edit.payload.search)
    if (position < 0 || original.indexOf(edit.payload.search, position + 1) >= 0) reject('ambiguous-replacement', 'Replacement search must occur exactly once.')
    return original.slice(0, position) + edit.payload.replacement + original.slice(position + edit.payload.search.length)
  }
  if (original.replace(/^\uFEFF/, '').split(/\r?\n/).includes(edit.payload.line)) return original
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  return original + (original && !original.endsWith('\n') ? newline : '') + edit.payload.line + newline
}

export function exactDiff(path, original, proposed) {
  if (original === proposed) return ''
  const lines = text => text === null ? [] : text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const before = lines(original)
  const after = lines(proposed)
  const output = [`--- ${original === null ? '/dev/null' : 'a/' + path}`, `+++ ${proposed === null ? '/dev/null' : 'b/' + path}`,
    `@@ -${before.length ? 1 : 0},${before.length} +${after.length ? 1 : 0},${after.length} @@`]
  for (const [prefix, content] of [['-', before], ['+', after]]) {
    for (const line of content) {
      output.push(prefix + (line.endsWith('\n') ? line.slice(0, -1) : line))
      if (!line.endsWith('\n')) output.push('\\ No newline at end of file')
    }
  }
  return output.join('\n') + '\n'
}
