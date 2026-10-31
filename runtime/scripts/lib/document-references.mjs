import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { lexer, walkTokens } from 'marked'
import { isInside, resolvePath } from './paths.mjs'
import { CommandError } from './result.mjs'

export function markdownTokens(text) {
  return lexer(text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'), { gfm: true })
}

export function* markdownBlocks(tokens) {
  for (const token of tokens) {
    if (token.type === 'blockquote') yield* markdownBlocks(token.tokens)
    else if (token.type === 'list') {
      for (const item of token.items) yield* markdownBlocks(item.tokens)
    } else yield token
  }
}

function inlineText(tokens) {
  return tokens.map(token => token.tokens ? inlineText(token.tokens) : token.type === 'html' ? '' : token.type === 'br' ? '\n' : token.text ?? '').join('')
}

function* referenceTokens(tokens) {
  for (const token of tokens) {
    yield token
    if (token.type === 'image') continue
    if (token.type === 'table') {
      for (const cell of [...token.header, ...token.rows.flat()]) yield* referenceTokens(cell.tokens)
    } else if (token.type === 'list') yield* referenceTokens(token.items)
    else if (token.tokens) yield* referenceTokens(token.tokens)
  }
}

export function markdownAnchors(text) {
  const anchors = new Set()
  const counts = new Map()
  walkTokens(markdownTokens(text), token => {
    if (token.type !== 'heading') return
    const title = inlineText(token.tokens).replace(/[ \t]*\n[ \t]*/g, '\n')
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
    let count = counts.get(slug) ?? 0
    let anchor = slug + (count ? `-${count}` : '')
    while (anchors.has(anchor)) anchor = `${slug}-${++count}`
    counts.set(slug, count + 1)
    anchors.add(anchor)
  })
  return anchors
}

export function markdownCoverageLimit(text) {
  let limited = false
  walkTokens(markdownTokens(text), token => {
    if (token.type === 'html' && !token.text.startsWith('<!--')) limited = true
    const value = ['link', 'image', 'def'].includes(token.type) ? token.href : ['text', 'escape'].includes(token.type) && !token.tokens ? token.text : ''
    if (/&[\w#]+;|\{#[^}]+\}/.test(value)) limited = true
  })
  return limited ? 'HTML, entities and custom anchors require renderer review.' : null
}

export function markdownLinks(text) {
  const links = []
  for (const token of referenceTokens(markdownTokens(text))) {
    if (['link', 'image'].includes(token.type) && !/&[\w#]+;/.test(token.href)) links.push(token.href)
  }
  return links
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
      if (markdownCoverageLimit(text)) return unsupported()
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
