import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { markdownCoverageLimit, markdownLinks, checkLocalLink } from '../lib/document-references.mjs'
import { CommandError } from '../lib/result.mjs'
import { loadContract } from './contract.mjs'
import { run as checkDocuments } from './docs-check.mjs'
import { run as checkGeneratedSections } from './docs-generate.mjs'
import { run as checkKit } from './kit-check.mjs'
import { run as checkFormal } from './formal-check.mjs'

// A registered document's owning skill is read from its registration: the glossary field, or the conventional vision and design IDs.
function fixFor(document) {
  if (document?.glossary) return 'Run /glossary maintain.'
  if (document?.id === 'vision') return 'Run /vision.'
  if (document?.id === 'design') return 'Run /architecture maintain.'
  return 'No skill owns this document; correct it by hand or register it under an owning document ID.'
}

function problemsOf(error) {
  if (!(error instanceof CommandError)) throw error
  return error.problems
}

async function readIfPresent(root, path) {
  return readFile(await resolveFilePath(root, path), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
}

async function contractItems(target, options, coverageLimits) {
  const path = options.contract ?? '.bstack/project.json'
  if (await readIfPresent(target.root, path) === null) {
    return [{ code: 'contract-missing', path, message: 'No maintenance contract is registered.', fix: 'Run /maintenance create.' }]
  }
  let policy
  try { policy = await loadContract(target, options.contract) } catch (error) {
    return problemsOf(error).map(problem => ({ ...problem, fix: 'Run /maintenance create to correct the registration.' }))
  }
  const items = []
  const owner = path => fixFor(policy.contract.documents.find(document => document.path === path))
  const docs = await checkDocuments({ ...options, coveragePolicy: policy })
  items.push(...docs.problems.map(problem => ({ ...problem, fix: owner(problem.path) })))
  coverageLimits.push(...docs.data.coverageLimits)
  const regenerate = 'Run /maintenance and its docs generate command, then apply the reviewed proposal.'
  try { items.push(...(await checkGeneratedSections({ ...options, check: true, coveragePolicy: policy })).problems.map(problem => ({ ...problem, fix: regenerate }))) } catch (error) {
    items.push(...problemsOf(error).map(problem => ({ ...problem, fix: regenerate })))
  }
  return items
}

async function kitItems(target) {
  const items = []
  const entries = await readdir(join(target.root, '.agents/skills')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  for (const name of entries.filter(name => name.startsWith('verify-')).sort()) {
    try { await checkKit({ repo: target.root, app: name.slice('verify-'.length) }) } catch (error) {
      items.push(...problemsOf(error).map(problem => ({ ...problem, fix: 'Run /verification maintain.' })))
    }
  }
  return items
}

// A suite folder has its own prefix, so a verify- kit is never read as a suite. A missing tool leaves a suite unproven, which is a limit and not drift.
async function formalItems(target, coverageLimits) {
  const items = []
  const entries = await readdir(join(target.root, '.agents/skills')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  for (const name of entries.filter(name => name.startsWith('formal-')).sort()) {
    try { await checkFormal({ repo: target.root, suite: name.slice('formal-'.length) }) } catch (error) {
      for (const problem of problemsOf(error)) {
        if (problem.code === 'tool-missing') coverageLimits.push({ path: problem.path, reason: problem.message })
        else items.push({ ...problem, fix: 'Run /formal-verification maintain.' })
      }
    }
  }
  return items
}

async function pointerItems(target, coverageLimits) {
  const text = await readIfPresent(target.root, 'AGENTS.md')
  if (text === null) return []
  const limit = text.includes('\0') ? 'Local links require supported Markdown text.' : markdownCoverageLimit(text)
  if (limit) {
    coverageLimits.push({ path: 'AGENTS.md', reason: limit })
    return []
  }
  const items = []
  for (const href of markdownLinks(text)) {
    const problem = await checkLocalLink(target.root, 'AGENTS.md', href)
    if (problem?.code === 'unsupported-link-fragment') coverageLimits.push({ path: 'AGENTS.md', reason: problem.message })
    else if (problem) items.push({ ...problem, fix: 'Run /agents-md.' })
  }
  return items
}

export async function run(options) {
  const target = await resolveTarget(options)
  const coverageLimits = []
  const problems = [...await contractItems(target, options, coverageLimits), ...await kitItems(target), ...await formalItems(target, coverageLimits),
    ...await pointerItems(target, coverageLimits)]
  return { inputs: { repo: target.root, contract: options.contract ?? '.bstack/project.json' }, status: problems.length ? 'failed' : 'passed', problems,
    data: { coverageLimits } }
}
