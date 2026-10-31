import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { isInside, resolvePath } from './paths.mjs'
import { CommandError } from './result.mjs'

// Strip quote containers before checking their rendered block content.
const quotes = /^(?: {0,3}>[ \t]?)+/
// List markers determine the indentation of their continuation blocks.
const listItem = /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/
// Empty ATX headings still interrupt paragraphs.
const atxStart = /^ {0,3}#{1,6}(?:[ \t]|$)/
// Extract ATX titles without their optional closing markers.
const atxHeading = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/
// Setext underlines turn the preceding paragraph into a heading.
const setextUnderline = /^ {0,3}(?:=+|-+)[ \t]*$/
// Reference definitions are excluded from heading paragraphs.
const referenceDefinition = /^ {0,3}\[([^\]\n]+)\]:/
// Thematic breaks end paragraphs and are excluded from prose emphasis checks.
const thematicBreak = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})$/

function fenceMarker(line) {
  const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
  return marker && (marker[1][0] !== '`' || !marker[2].includes('`')) ? marker : null
}

export function markdownBody(text) {
  let fence
  let comment = false
  let paragraph = false
  let bodyDepth = 0
  const lists = []
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const body = source.split('\n').map(raw => {
    const previousBase = lists.at(-1) ?? 0
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
      const blockComment = /^ {0,3}<!--/.test(semantic)
      raw = raw.replace(/<!--|-->|./g, (token, offset) => {
        if (comment) {
          if (token === '-->') comment = false
          return ' '.repeat(token.length)
        }
        if (token === '<!--' && blockComment && offset === raw.indexOf('<!--')) { comment = true; return ' '.repeat(token.length) }
        return token
      })
      expanded = raw.replace(/^\t+/, tabs => '    '.repeat(tabs.length))
    }
    let quotePrefix = quotes.exec(expanded)?.[0] ?? ''
    if (lists.length && quotePrefix.startsWith(' '.repeat(lists.at(-1)))) quotePrefix = ''
    expanded = expanded.slice(quotePrefix.length)
    const indent = /^ */.exec(expanded)[0].length
    const lazy = paragraph && !!expanded.trim() && depth <= bodyDepth && !listItem.test(current) &&
      !atxStart.test(semantic) && !setextUnderline.test(semantic) && !thematicBreak.test(semantic) &&
      !opening && !/^ {0,3}<!--/.test(semantic)
    if (expanded.trim() && !lazy) {
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
    const boundary = item || !lazy && (depth !== bodyDepth || previousBase > (lists.at(-1) ?? 0))
    if (!lazy) bodyDepth = depth
    paragraph = !!content.trim() && !atxStart.test(content) && !setextUnderline.test(content) && !thematicBreak.test(content)
    return (boundary ? '\n' : '') + content
  }).join('\n')
  return markdownProse(body, false)
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
      else paragraph.push({ text: line, start })
      continue
    }
    headings.push({ text: isATX ? atx?.[1] ?? '' : paragraph.map(line => line.text).join('\n').trim(), start: isATX ? start : paragraph[0].start, end: offset })
    paragraph = []
  }
  return headings
}

export function markdownAnchors(text) {
  const anchors = new Set()
  const counts = new Map()
  const body = markdownBody(text)
  const definitions = markdownDefinitions(markdownProse(body))
  for (const heading of markdownHeadings(body)) {
    let title = ''
    let start = 0
    for (const link of markdownReferences(heading.text, definitions)) {
      title += heading.text.slice(start, link.start) + link.label
      start = link.end
    }
    title += heading.text.slice(start)
    let previous
    do {
      previous = title
      title = title.replace(/(?<![\p{L}\p{N}_])(_{1,3})(?=\S)(.+?\S|\S)\1(?![\p{L}\p{N}_])/gsu, '$2')
    } while (title !== previous)
    title = title.replace(/[ \t]*\n[ \t]*/g, '\n')
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    let count = counts.get(slug) ?? 0
    let anchor = slug + (count ? `-${count}` : '')
    while (anchors.has(anchor)) anchor = `${slug}-${++count}`
    counts.set(slug, count + 1)
    anchors.add(anchor)
  }
  return anchors
}

// Reference labels match regardless of case or repeated whitespace.
const referenceLabel = value => value.trim().replace(/\s+/g, ' ').toLowerCase()
// Keep destination parsing bounded to ordinary tokens without markup or titles.
const linkDestination = value => /^[^\s()[\]<>\\`]+$/.test(value.trim()) && !/&[\w#]+;/.test(value) ? value.trim() : null

function markdownProse(body, maskInline = true) {
  const boundaries = markdownHeadings(body).flatMap(heading => [heading.start, heading.end])
  let offset = 0
  for (const line of body.split('\n')) {
    if (!line.trim() || thematicBreak.test(line)) boundaries.push(offset, offset + line.length + 1)
    offset += line.length + 1
  }
  boundaries.sort((a, b) => a - b)
  let prose = ''
  let label = false
  for (let index = 0; index < body.length;) {
    const rest = body.slice(index)
    const definition = (index === 0 || body[index - 1] === '\n') && /^ {0,3}\[[^\]\n]+\]:[^\n]*/.exec(rest)
    if (definition) { prose += definition[0]; index += definition[0].length; continue }
    const destination = label && /^\](?:\([^)\n]*\)|\[[^\]\n]*\])/.exec(rest)
    if (destination) { prose += destination[0]; index += destination[0].length; label = false; continue }
    const escape = /^\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.exec(rest)
    if (escape) { prose += maskInline ? '  ' : escape[0]; index += 2; continue }
    const comment = rest.startsWith('<!--') && /^<!--[\s\S]*?-->/.exec(body.slice(index, boundaries.find(boundary => boundary > index) ?? body.length))
    if (comment) { prose += comment[0].replace(/[^\n]/g, ' '); index += comment[0].length; continue }
    const ticks = /^`+/.exec(rest)?.[0]
    if (ticks) {
      const paragraph = body.slice(index + ticks.length, boundaries.find(boundary => boundary > index) ?? body.length)
      const closing = [...paragraph.matchAll(/`+/g)].find(match => match[0].length === ticks.length)
      if (closing) {
        const end = index + ticks.length + closing.index + ticks.length
        const span = body.slice(index, end)
        prose += maskInline ? span.replace(/[^\n]/g, ' ') : span
        index = end
        continue
      }
      prose += ticks
      index += ticks.length
      continue
    }
    if (body[index] === '[') label = true
    else if (body[index] === ']' || body[index] === '\n') label = false
    prose += body[index++]
  }
  return prose
}

export function markdownCoverageLimit(text) {
  const body = markdownProse(markdownBody(text))
  if (/^ {0,3}\[[^\]\n]*[`\\][^\]\n]*\]:/m.test(body)) return 'Code spans and escapes in reference labels require renderer review.'
  if (/<[^>]+>|&[\w#]+;|\{#[^}]+\}/.test(body.replace(/<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*>|<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+>/g, ''))) return 'HTML, entities and custom anchors require renderer review.'
  if (/\[[^\]\n]*\[/.test(body)) return 'Nested links require renderer review.'
  for (const match of body.matchAll(/!?\[[^\]\n]*\]\(([^)\n]*)\)/g)) {
    if (!linkDestination(match[1])) return 'Only ordinary destinations without titles are checked.'
  }
  for (const match of body.matchAll(/^ {0,3}\[[^\]\n]+\]:[ \t]*(.*)$/gm)) {
    if (!linkDestination(match[1])) return 'Only ordinary reference destinations without titles are checked.'
  }
  return null
}

function markdownDefinitions(body) {
  const definitions = new Map()
  for (const match of body.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(.+)$/gm)) {
    const path = linkDestination(match[2])
    if (path && !/[`\\]/.test(match[1]) && !definitions.has(referenceLabel(match[1]))) definitions.set(referenceLabel(match[1]), path)
  }
  return definitions
}

function markdownReferences(body, definitions) {
  body = body
    .replace(/^ {0,3}<(pre|script|style|textarea)(?=[\s>])[\s\S]*?(?:<\/\1\s*>|(?![\s\S]))/gim, value => value.replace(/[^\n]/g, ' '))
    .replace(/^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?=[\s/>])[^\n]*[\s\S]*?(?=\n[ \t]*\n|(?![\s\S]))/gim, value => value.replace(/[^\n]/g, ' '))
  const headingEnds = new Set(markdownHeadings(body).map(heading => heading.end))
  for (const match of body.matchAll(/^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>[ \t]*(?=\n|$)/gim)) {
    const lines = body.slice(0, match.index).split('\n')
    lines.pop()
    while (referenceDefinition.test(lines.at(-1) ?? '')) lines.pop()
    const preceding = lines.at(-1) ?? ''
    if (preceding.trim() && !headingEnds.has(lines.join('\n').length + 1) && !thematicBreak.test(preceding)) continue
    const blank = body.slice(match.index).search(/\n[ \t]*\n/)
    const end = blank < 0 ? body.length : match.index + blank
    body = body.slice(0, match.index) + body.slice(match.index, end).replace(/[^\n]/g, ' ') + body.slice(end)
  }
  definitions ??= markdownDefinitions(markdownProse(body))
  const links = []
  const prose = markdownProse(body)
    .replace(/<[^>\n]*>/g, value => ' '.repeat(value.length))
    .replace(/^ {0,3}\[[^\]\n]+\]:.*$/gm, value => ' '.repeat(value.length))
  let consumed = 0
  const brackets = []
  const nested = []
  for (let index = 0; index < prose.length; index++) {
    if (prose[index] === '[') brackets.push(index)
    if (prose[index] === ']' && brackets.length) {
      const start = brackets.pop()
      if (prose.slice(start + 1, index).includes('[')) {
        const suffix = /^(?:\([^\n]*?\)|\[[^\]\n]*\])/.exec(prose.slice(index + 1))
        nested.push({ start, end: index + 1 + (suffix?.[0].length ?? 0) })
      }
    }
  }
  for (const match of prose.matchAll(/!?\[([^\]\n]*)\]/g)) {
    if (match.index < consumed || nested.some(span => span.start <= match.index && match.index < span.end)) continue
    const start = match.index + match[0].length
    const inline = /^\(([^)\n]*)\)/.exec(prose.slice(start))
    const reference = /^\[([^\]\n]*)\]/.exec(prose.slice(start))
    const end = start + (inline?.[0].length ?? reference?.[0].length ?? 0)
    const label = reference?.[1] || body.slice(match.index + (match[0].startsWith('!') ? 2 : 1), start - 1)
    const path = inline ? linkDestination(inline[1]) : definitions.get(referenceLabel(label))
    if (path) {
      links.push({ href: path, label: match[1], start: match.index, end })
      consumed = end
    }
  }
  return links
}

export function markdownLinks(text) {
  return markdownReferences(markdownBody(text)).map(link => link.href)
}

export function isMarkdownLinkLine(text) {
  return /^\[[^\][\r\n\\`*_]+\]\([^\s()[\]<>\\`]+\)\r?\n$/.test(text) && !text.endsWith('\n\n')
}

export async function checkLocalLink(root, source, href, documents = new Map()) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//.test(href)) return null
  const problem = message => ({ code: 'broken-local-link', path: source, message: `${message}: ${href}`, fix: 'Correct the local destination or heading in the authoritative document.' })
  let pathPart, fragment
  try {
    const hash = href.indexOf('#')
    pathPart = decodeURIComponent((hash < 0 ? href : href.slice(0, hash)).split('?')[0])
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
      if (markdownCoverageLimit(text) || markdownHeadings(markdownBody(text)).some(heading => /[`\\]/.test(heading.text))) return unsupported()
      if (!markdownAnchors(text).has(fragment)) {
        if (text.includes('\0')) return unsupported()
        return problem('Missing heading fragment')
      }
    }
  } catch (error) {
    if (!(error instanceof CommandError) && !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
    return problem('Missing or unsafe destination')
  }
  return null
}
