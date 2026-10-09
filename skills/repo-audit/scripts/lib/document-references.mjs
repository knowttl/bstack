import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { isInside, resolvePath } from './paths.mjs'
import { CommandError } from './result.mjs'

export function markdownBody(text) {
  let fence
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
      return ''
    }
    if (marker) { fence = marker[1]; return '' }
    return /^(?: {4}|\t)/.test(line) ? '' : line
  }).join('\n').replace(/<!--[\s\S]*?(?:-->|$)/g, '')
}

export function markdownAnchors(text) {
  const anchors = new Set()
  const counts = new Map()
  for (const match of markdownBody(text).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$|^([^\n]+)\n {0,3}(?:=+|-+)\s*$/gm)) {
    const title = (match[1] ?? match[2]).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '')
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    const count = counts.get(slug) ?? 0
    counts.set(slug, count + 1)
    anchors.add(slug + (count ? `-${count}` : ''))
  }
  return anchors
}

// Bounded Markdown destinations: balanced parentheses, angle paths and optional titles.
export function markdownLinks(text) {
  const body = markdownBody(text).replace(/(`+)[\s\S]*?\1/g, '')
  const definitions = new Map()
  const links = []
  const label = value => value.trim().replace(/\s+/g, ' ').toLowerCase()
  const destination = value => /^<([^>\n]+)>|^(\S+)/.exec(value.trim())
  for (const match of body.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(.+)$/gm)) {
    const path = destination(match[2])
    if (path) definitions.set(label(match[1]), path[1] ?? path[2])
  }
  const prose = body.replace(/^ {0,3}\[[^\]]+\]:.*$/gm, '')
  let consumed = 0
  for (const match of prose.matchAll(/(?<!!)!?\[([^\]\n]+)\]/g)) {
    if (match.index < consumed) continue
    if (match.index > 0 && prose[match.index - 1] === '\\') continue
    const start = match.index + match[0].length
    if (prose[start] === '(') {
      let end = start + 1
      let depth = 1
      let angle = false
      for (; end < prose.length && depth; end++) {
        const char = prose[end]
        if (char === '\\') { end++; continue }
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
