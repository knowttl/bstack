import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { isInside, resolvePath } from './paths.mjs'
import { CommandError } from './result.mjs'

export function markdownBody(text) {
  let fence
  let paragraph = false
  const lists = []
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(raw => {
    const expanded = raw.replace(/^\t+/, tabs => '    '.repeat(tabs.length))
    const indent = /^ */.exec(expanded)[0].length
    if (expanded.trim()) {
      while (lists.length && indent < lists.at(-1)) lists.pop()
    }
    const base = lists.at(-1) ?? 0
    const line = expanded.slice(Math.min(indent, base))
    const item = /^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.exec(line)
    if (!fence && item) lists.push(base + item[0].length)
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
      return ''
    }
    if (marker) { fence = marker[1]; paragraph = false; return '' }
    if (/^ {4}/.test(line) && !paragraph) return ''
    paragraph = !!line.trim() && !/^ {0,3}(?:#{1,6}(?:\s|$)|(?:=+|-+)\s*$)/.test(line)
    return line
  }).join('\n').replace(/<!--[\s\S]*?(?:-->|$)/g, value => value.replace(/[^\n]/g, ' '))
}

export function markdownProse(text) {
  const body = markdownBody(text)
  const runs = [...body.matchAll(/`+/g)]
  let output = ''
  let start = 0
  for (let i = 0; i < runs.length; i++) {
    const opening = runs[i]
    if (opening.index > 0 && /(?:^|[^\\])(?:\\\\)*\\$/.test(body.slice(0, opening.index))) continue
    const closing = runs.findIndex((run, index) => index > i && run[0].length === opening[0].length)
    if (closing < 0) continue
    const end = runs[closing].index + runs[closing][0].length
    output += body.slice(start, opening.index) + body.slice(opening.index, end).replace(/[^\n]/g, ' ')
    start = end
    i = closing
  }
  return output + body.slice(start)
}

export function markdownAnchors(text) {
  const anchors = new Set()
  const counts = new Map()
  let paragraph = []
  for (const line of markdownBody(text).split('\n')) {
    const atx = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line)
    const setext = /^ {0,3}(?:=+|-+)[ \t]*$/.test(line)
    const heading = atx?.[1] ?? (setext && paragraph.length ? paragraph.join('\n') : null)
    if (heading === null) {
      if (!line.trim() || /^ {0,3}(?:>|(?:[-+*]|\d+[.)])[ \t]+|\[[^\]]+\]:)/.test(line) || setext) paragraph = []
      else paragraph.push(line.trim())
      continue
    }
    paragraph = []
    const title = heading.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '')
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    const count = counts.get(slug) ?? 0
    counts.set(slug, count + 1)
    anchors.add(slug + (count ? `-${count}` : ''))
  }
  return anchors
}

// Bounded Markdown destinations: balanced parentheses, angle paths and optional titles.
export function markdownLinks(text) {
  const body = markdownProse(text)
  const definitions = new Map()
  const links = []
  const label = value => value.trim().replace(/\s+/g, ' ').toLowerCase()
  const destination = value => /^<([^>\n]+)>|^(\S+)/.exec(value.trim())
  for (const match of body.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(.+)$/gm)) {
    const path = destination(match[2])
    if (path && !definitions.has(label(match[1]))) definitions.set(label(match[1]), path[1] ?? path[2])
  }
  const prose = body.replace(/^ {0,3}\[[^\]]+\]:.*$/gm, '')
  let consumed = 0
  for (const match of prose.matchAll(/(?<!!)!?\[([^\]\n]*)\]/g)) {
    if (match.index < consumed) continue
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
        const path = destination(prose.slice(start + 1, end - 1))
        if (path) links.push(path[1] ?? path[2])
      }
    } else {
      const reference = /^\[([^\]\n]*)\]/.exec(prose.slice(start))
      if (reference) consumed = start + reference[0].length
      const path = definitions.get(label(reference?.[1] || match[1]))
      if (path) links.push(path)
    }
  }
  return links
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
  if (documents.has(local) && documents.get(local) === null) return problem('Missing destination in proposed documents')
  try {
    const resolved = await resolvePath(root, local || '.')
    // File systems differ in case sensitivity; references must preserve actual case.
    let parent = root
    for (const segment of local.split('/').filter(Boolean)) {
      if (join(parent, segment) === destination && documents.has(local)) break
      if (!(await readdir(parent)).includes(segment)) {
        if (documents.has(local)) break
        return problem('Missing or wrong-case destination')
      }
      parent = join(parent, segment)
    }
    if (!documents.has(local)) await stat(resolved)
    if (fragment && ['.md', '.markdown'].includes(extname(local).toLowerCase())) {
      const unsupported = () => ({ code: 'unsupported-link-fragment', path: source, message: `Heading fragment coverage is limited for ${href}.`,
        fix: 'Review this reference using the document renderer.' })
      let text = documents.get(local)
      if (text === undefined) {
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(resolved)) } catch (error) {
          if (error instanceof TypeError) return unsupported()
          throw error
        }
      }
      if (!markdownAnchors(text).has(fragment)) {
        if (text.includes('\0') || /<[^>]+\b(?:id|name)\s*=|\{#[^}]+\}|^\s*#{1,6}[^\n]*&[\w#]+;/m.test(markdownBody(text))) return unsupported()
        return problem('Missing heading fragment')
      }
    }
  } catch (error) {
    if (!(error instanceof CommandError) && !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
    return problem('Missing or unsafe destination')
  }
  return null
}
