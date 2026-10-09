import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { markdownBody, markdownCoverageLimit, markdownHeadings, markdownLinks, checkLocalLink } from '../lib/document-references.mjs'
import { loadContract } from './contract.mjs'

function glossaryEntries(text, format) {
  const body = markdownBody(text)
  if (format === 'markdown-bold') {
    const headings = markdownHeadings(body)
    const entries = [...body.matchAll(/^\*\*([^*\n]+)\*\*:[ \t]*/gm)]
      .filter(match => !headings.some(heading => heading.start <= match.index && match.index < heading.end))
    return entries.map((match, index) => {
      const end = Math.min(entries[index + 1]?.index ?? body.length, headings.find(heading => heading.start > match.index)?.start ?? body.length)
      return { term: match[1].trim(), definition: body.slice(match.index + match[0].length, end).trim() }
    })
  }
  if (format === 'markdown-table') {
    const lines = body.split('\n')
    const entries = []
    for (let i = 0; i < lines.length - 1; i++) {
      if (!/^\|\s*Term\s*\|\s*Definition\s*\|[ \t]*$/i.test(lines[i]) || !/^\|\s*:?-+:?\s*\|\s*:?-+:?\s*\|[ \t]*$/.test(lines[i + 1])) continue
      i += 2
      for (; i < lines.length && lines[i].startsWith('|'); i++) {
        const row = /^\|([^|]*)\|([^|]*)\|[ \t]*$/.exec(lines[i])
        if (!row) return null
        entries.push({ term: row[1].trim(), definition: row[2].trim() })
      }
    }
    return entries
  }
  return null
}

export async function run(options) {
  const target = await resolveTarget(options)
  const { contract, path: contractPath } = await loadContract(target, options.contract)
  const problems = []
  const coverageLimits = []
  const terms = new Map()
  const documents = []
  const paths = new Set([...contract.documents, ...contract.rules, ...contract.acceptanceSources].map(entry => entry.path))
  for (const path of paths) {
    const bytes = await readFile(await resolveFilePath(target.root, path))
    let text
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch {
      coverageLimits.push({ path, reason: 'Unsupported document encoding; only UTF-8 text is checked.' })
      continue
    }
    if (text.includes('\0') || !['.md', '.markdown'].includes(extname(path).toLowerCase())) {
      coverageLimits.push({ path, reason: 'Local links require supported Markdown text.' })
      continue
    }
    const limit = markdownCoverageLimit(text)
    if (limit) {
      coverageLimits.push({ path, reason: limit })
      documents.push({ path, links: 0 })
      continue
    }
    const links = markdownLinks(text)
    for (const href of links) {
      const problem = await checkLocalLink(target.root, path, href)
      if (problem?.code === 'unsupported-link-fragment') coverageLimits.push({ path, reason: problem.message })
      else if (problem) problems.push(problem)
    }
    if (/<(?:a|img)\b/i.test(markdownBody(text))) coverageLimits.push({ path, reason: 'HTML links and explicit HTML anchors are not checked.' })
    documents.push({ path, links: links.length })
    for (const document of contract.documents.filter(document => document.path === path && document.glossary)) {
      const { context, format } = document.glossary
      const entries = glossaryEntries(text, format)
      if (entries === null) {
        coverageLimits.push({ path, reason: `Unsupported glossary format or fields: ${format}` })
        continue
      }
      if (!entries.length || entries.some(entry => !entry.term || !entry.definition)) problems.push({ code: 'invalid-glossary', path,
        message: 'Supported glossaries require nonempty terms and definitions.', fix: 'Fill the glossary with project concepts or correct its registered format.' })
      if (!terms.has(context)) terms.set(context, new Map())
      for (const entry of entries) {
        const name = entry.term.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
        const previous = terms.get(context).get(name)
        if (previous) problems.push({ code: 'duplicate-term', path, message: `Duplicate term ${entry.term} in context ${context}; first declared in ${previous}.`, fix: 'Keep one canonical entry within this context.' })
        else terms.get(context).set(name, path)
      }
    }
  }
  return { inputs: { repo: target.root, contract: contractPath }, status: problems.length ? 'failed' : 'passed', problems,
    data: { documents, coverageLimits } }
}
