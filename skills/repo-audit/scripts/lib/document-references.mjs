import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { isInside, resolvePath } from './paths.mjs'
import { CommandError } from './result.mjs'

const quotes = /^(?: {0,3}>[ \t]?)+/
const listItem = /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/
const atxStart = /^ {0,3}#{1,6}(?:[ \t]|$)/
const atxHeading = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/
const setextUnderline = /^ {0,3}(?:=+|-+)[ \t]*$/
const referenceDefinition = /^ {0,3}\[[^\]]+\]:/
const thematicBreak = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/
const headingEntity = /&[\w#]+;/
const tableSeparator = /^\|(?:[ \t]*:?-+:?[ \t]*\|){2,}[ \t]*$/

function fenceMarker(line) {
  const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
  return marker && (marker[1][0] !== '`' || !marker[2].includes('`')) ? marker : null
}

function inlineCodeRanges(text) {
  const blocks = []
  let block = ''
  let start = 0
  let offset = 0
  let quoteDepth = 0
  let table = false
  const lines = text.split(/(?<=\n)/)
  for (const [index, line] of lines.entries()) {
    const prefix = quotes.exec(line)?.[0] ?? ''
    const content = line.slice(prefix.length).replace(/\n$/, '')
    const inner = content.replace(listItem, '')
    const innerPrefix = quotes.exec(inner)?.[0] ?? ''
    const depth = (prefix + innerPrefix).split('>').length - 1
    const semantic = inner.slice(innerPrefix.length)
    table = semantic.trimStart().startsWith('|') && (depth === quoteDepth && !listItem.test(content) && table ||
      tableSeparator.test((lines[index + 1] ?? '').replace(quotes, '').trim()))
    const separate = atxStart.test(semantic) || setextUnderline.test(semantic) || thematicBreak.test(semantic) ||
      referenceDefinition.test(semantic) || !!fenceMarker(semantic) || table
    if (!content.trim() || separate || listItem.test(content) || depth !== quoteDepth) {
      if (block) blocks.push({ text: block, start })
      block = ''
    }
    if (!block) start = offset
    block += line
    if (separate || !content.trim()) { blocks.push({ text: block, start }); block = '' }
    quoteDepth = depth
    offset += line.length
  }
  if (block) blocks.push({ text: block, start })
  const ranges = []
  for (const block of blocks) {
    const runs = [...block.text.matchAll(/`+/g)]
    for (let i = 0; i < runs.length; i++) {
      const opening = runs[i]
      if (opening.index > 0 && /(?:^|[^\\])(?:\\\\)*\\$/.test(block.text.slice(0, opening.index))) continue
      const closing = runs.findIndex((run, index) => index > i && run[0].length === opening[0].length)
      if (closing < 0) continue
      ranges.push({ start: block.start + opening.index, end: block.start + runs[closing].index + runs[closing][0].length })
      i = closing
    }
  }
  return ranges
}

export function markdownBody(text) {
  let fence
  let comment = false
  let paragraph = false
  let offset = 0
  let codeEnd = 0
  let bodyDepth = 0
  const lists = []
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const code = new Map(inlineCodeRanges(source).map(range => [range.start, range.end]))
  return source.split('\n').map(raw => {
    const previousBase = lists.at(-1) ?? 0
    const lineOffset = offset
    offset += raw.length + 1
    let expanded = raw.replace(/^\t+/, tabs => '    '.repeat(tabs.length))
    let prefix = quotes.exec(expanded)?.[0] ?? ''
    if (lists.length && prefix.startsWith(' '.repeat(lists.at(-1)))) prefix = ''
    const quoted = expanded.slice(prefix.length)
    const rawIndent = /^ */.exec(quoted)[0].length
    const currentBase = lists.filter(base => base <= rawIndent).at(-1) ?? 0
    const current = quoted.slice(currentBase)
    const semantic = current.replace(listItem, '').replace(quotes, '')
    const depth = (prefix + (quotes.exec(current.replace(listItem, ''))?.[0] ?? '')).split('>').length - 1
    if (fence && raw.trim() && (rawIndent < fence.indent || depth < fence.depth)) fence = undefined
    if (fence) {
      const marker = fenceMarker(semantic)
      if (marker && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && !marker[2].trim()) fence = undefined
      return ''
    }
    if (!comment && /^ {4}/.test(current) && !paragraph) return ''
    const opening = comment ? null : fenceMarker(semantic)
    if (!opening) {
      raw = raw.replace(/<!--|-->|./g, (token, index) => {
        if (comment) {
          if (token === '-->') comment = false
          return ' '.repeat(token.length)
        }
        codeEnd = code.get(lineOffset + index) ?? codeEnd
        if (lineOffset + index < codeEnd) return token
        if (token === '<!--') { comment = true; return ' '.repeat(token.length) }
        return token
      })
      expanded = raw.replace(/^\t+/, tabs => '    '.repeat(tabs.length))
    }
    let quotePrefix = quotes.exec(expanded)?.[0] ?? ''
    if (lists.length && quotePrefix.startsWith(' '.repeat(lists.at(-1)))) quotePrefix = ''
    expanded = expanded.slice(quotePrefix.length)
    const indent = /^ */.exec(expanded)[0].length
    if (expanded.trim()) {
      while (lists.length && indent < lists.at(-1)) lists.pop()
    }
    const base = lists.at(-1) ?? 0
    const line = expanded.slice(Math.min(indent, base))
    const item = listItem.exec(line)
    if (item) lists.push(base + item[0].length)
    if (opening) { fence = { marker: opening[1], indent: lists.at(-1) ?? 0, depth }; paragraph = false; return '' }
    if (/^ {4}/.test(line) && !paragraph) return ''
    let content = line
    while (quotes.test(content) || listItem.test(content)) content = content.replace(quotes, '').replace(listItem, '')
    if (depth || item || base) content = content.replace(/^ {0,3}/, '')
    const boundary = item || depth !== bodyDepth || previousBase > (lists.at(-1) ?? 0)
    bodyDepth = depth
    paragraph = !!content.trim() && !atxStart.test(content) && !setextUnderline.test(content) && !thematicBreak.test(content)
    return (boundary ? '\n' : '') + content
  }).join('\n')
}

export function markdownProse(text) {
  const body = markdownBody(text)
  let output = ''
  let start = 0
  for (const range of inlineCodeRanges(body)) {
    output += body.slice(start, range.start) + body.slice(range.start, range.end).replace(/[^\n]/g, ' ')
    start = range.end
  }
  return output + body.slice(start)
}

export function markdownHeadings(body) {
  const headings = []
  let paragraph = []
  let offset = 0
  for (const line of body.split('\n')) {
    const start = offset
    offset += line.length + 1
    const atx = atxHeading.exec(line)
    const isATX = atxStart.test(line)
    const setext = setextUnderline.test(line)
    if (!isATX && (!setext || !paragraph.length)) {
      if (!line.trim() || referenceDefinition.test(line) || thematicBreak.test(line) || setext) paragraph = []
      else paragraph.push({ text: line.trim(), start })
      continue
    }
    headings.push({ text: isATX ? atx?.[1] ?? '' : paragraph.map(line => line.text).join('\n'), start: isATX ? start : paragraph[0].start, end: offset })
    paragraph = []
  }
  return headings
}

function hasNestedHeadingMarkup(text) {
  const prose = markdownProse(text)
  let labels = ''
  let start = 0
  for (const link of markdownReferences(prose)) {
    const end = link.start + link.label.length + (prose[link.start] === '!' ? 3 : 2)
    labels += prose.slice(start, end)
    start = link.end
  }
  return /(?:^|[^\\])(?:\\\\)*\[(?:\\.|[^\]\\])*\[/.test(labels + prose.slice(start))
}

export function markdownAnchors(text) {
  const anchors = new Set()
  const counts = new Map()
  const definitions = markdownDefinitions(markdownProse(text))
  for (const heading of markdownHeadings(markdownBody(text))) {
    if (headingEntity.test(heading.text) || hasNestedHeadingMarkup(heading.text)) continue
    let title = ''
    let start = 0
    for (const link of markdownReferences(heading.text, definitions)) {
      title += heading.text.slice(start, link.start) + link.label
      start = link.end
    }
    title += heading.text.slice(start)
    const code = inlineCodeRanges(title)
    title = title.replace(/<[^>]+>/g, (tag, index) => code.some(range => range.start <= index && index < range.end) ? tag : '')
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    let count = counts.get(slug) ?? 0
    let anchor = slug + (count ? `-${count}` : '')
    while (anchors.has(anchor)) anchor = `${slug}-${++count}`
    counts.set(slug, count + 1)
    anchors.add(anchor)
  }
  return anchors
}

const referenceLabel = value => value.trim().replace(/\s+/g, ' ').toLowerCase()
const linkDestination = value => /^<([^>\n]+)>|^(\S+)/.exec(value.trim())

function markdownDefinitions(body) {
  const definitions = new Map()
  for (const match of body.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(.+)$/gm)) {
    const path = linkDestination(match[2])
    if (path && !definitions.has(referenceLabel(match[1]))) definitions.set(referenceLabel(match[1]), path[1] ?? path[2])
  }
  return definitions
}

function markdownReferences(body, definitions = markdownDefinitions(body)) {
  const links = []
  const prose = body.replace(/^ {0,3}\[[^\]]+\]:.*$/gm, value => ' '.repeat(value.length))
  const code = inlineCodeRanges(prose)
  let consumed = 0
  for (const match of prose.matchAll(/(?<!!)!?\[([^\]\n]*)\]/g)) {
    if (match.index < consumed) continue
    if (code.some(range => range.start <= match.index && match.index < range.end)) continue
    if (match.index > 0 && prose[match.index - 1] === '\\') continue
    const start = match.index + match[0].length
    if (prose[start] === '(') {
      let end = start + 1
      let depth = 1
      let angle = false
      let quote
      for (; end < prose.length && depth; end++) {
        const char = prose[end]
        if (char === '\\') { end++; continue }
        if (quote) {
          if (char === quote) quote = undefined
          continue
        }
        if (!angle && depth === 1 && /["']/.test(char) && /\s/.test(prose[end - 1])) { quote = char; continue }
        if (char === '<') angle = true
        if (char === '>') angle = false
        if (!angle && char === '(') depth++
        if (!angle && char === ')') depth--
      }
      if (!depth) {
        consumed = end
        const path = linkDestination(prose.slice(start + 1, end - 1))
        if (path) links.push({ href: path[1] ?? path[2], label: match[1], start: match.index, end })
      }
    } else {
      const reference = /^\[([^\]\n]*)\]/.exec(prose.slice(start))
      if (reference) consumed = start + reference[0].length
      const path = definitions.get(referenceLabel(reference?.[1] || match[1]))
      if (path) links.push({ href: path, label: match[1], start: match.index, end: reference ? consumed : start })
    }
  }
  return links
}

export function markdownLinks(text) {
  return markdownReferences(markdownProse(text)).map(link => link.href)
}

export async function checkLocalLink(root, source, href, documents = new Map()) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//.test(href)) return null
  const problem = message => ({ code: 'broken-local-link', path: source, message: `${message}: ${href}`, fix: 'Correct the local destination or heading in the authoritative document.' })
  let pathPart, fragment
  try {
    const hash = href.indexOf('#')
    pathPart = decodeURIComponent((hash < 0 ? href : href.slice(0, hash)).split('?')[0]).replace(/\\([()])/g, '$1')
    fragment = hash < 0 ? '' : decodeURIComponent(href.slice(hash + 1))
  } catch { return problem('Invalid URL encoding') }
  if (pathPart.startsWith('/') || pathPart.includes('\0') || pathPart.includes('\\')) return problem('Unsupported local path')
  const destination = resolve(root, dirname(source), pathPart || source.split('/').at(-1))
  if (!isInside(root, destination)) return problem('Link escapes the selected target')
  const local = relative(root, destination).split('\\').join('/')
  try {
    const resolved = await resolvePath(root, local || '.')
    if (documents.has(resolved) && documents.get(resolved) === null) return problem('Missing destination in proposed documents')
    // File systems differ in case sensitivity; references must preserve actual case.
    let parent = root
    for (const segment of local.split('/').filter(Boolean)) {
      if (!(await readdir(parent)).includes(segment)) {
        if (documents.has(resolved)) {
          try { await stat(join(parent, segment)); return problem('Wrong-case destination') } catch (error) {
            if (error.code !== 'ENOENT') throw error
          }
          break
        }
        return problem('Missing or wrong-case destination')
      }
      parent = join(parent, segment)
    }
    if (!documents.has(resolved)) await stat(resolved)
    if (fragment && ['.md', '.markdown'].includes(extname(local).toLowerCase())) {
      const unsupported = () => ({ code: 'unsupported-link-fragment', path: source, message: `Heading fragment coverage is limited for ${href}.`,
        fix: 'Review this reference using the document renderer.' })
      let text = documents.get(resolved)
      if (text === undefined) {
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(resolved)) } catch (error) {
          if (error instanceof TypeError) return unsupported()
          throw error
        }
      }
      const headings = markdownHeadings(markdownBody(text))
      if (headings.some(heading => hasNestedHeadingMarkup(heading.text))) return unsupported()
      if (!markdownAnchors(text).has(fragment)) {
        if (text.includes('\0') || /<[^>]+\b(?:id|name)\s*=|\{#[^}]+\}/m.test(markdownBody(text)) ||
            headings.some(heading => headingEntity.test(heading.text))) return unsupported()
        return problem('Missing heading fragment')
      }
    }
  } catch (error) {
    if (!(error instanceof CommandError) && !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
    return problem('Missing or unsafe destination')
  }
  return null
}
