import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath, resolvePath } from '../lib/paths.mjs'
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

async function pathExists(root, path) {
  try { await stat(await resolvePath(root, path)) } catch (error) {
    if (error instanceof CommandError || error.code === 'ENOTDIR') return null
    if (error.code === 'ENOENT') return false
    throw error
  }
  return true
}

function howToReadSection(text) {
  const lines = text.split('\n')
  const start = lines.findIndex(line => /^#{1,6}\s+How to read this\s*$/.test(line))
  if (start < 0) return ''
  const end = lines.findIndex((line, index) => index > start && /^#{1,6}\s/.test(line))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

// A plan is temporary: it is finished when the file its removal condition names exists, and orphaned when a design file it cites is gone or the condition cannot be read.
async function planItems(target, policy) {
  const document = policy.contract.documents.find(document => document.id === 'plan')
  if (!document) return []
  const text = await readIfPresent(target.root, document.path)
  if (text === null) return []
  const items = []
  const orphaned = message => items.push({ code: 'plan-orphaned', path: document.path, message, fix: 'Delete the plan and its AGENTS.md pointer line in a change the user approves, or restore what it depends on.' })
  for (const [, line] of text.matchAll(/^Design: (.+)$/gm)) {
    for (const [, path] of line.matchAll(/`([^`]+):[1-9][0-9]*`/g)) {
      if (!await pathExists(target.root, path)) orphaned(`The plan cites design file ${path}, which is gone.`)
    }
  }
  const condition = howToReadSection(text).match(/^Remove this plan when `([^`]+)` exists\.?\s*$/m)?.[1]
  if (condition === undefined) orphaned('The "How to read this" section states no removal condition of the form "Remove this plan when `<path>` exists."')
  else {
    const exists = await pathExists(target.root, condition)
    if (exists === null) orphaned(`The removal condition path ${condition} cannot be resolved.`)
    else if (exists) items.push({ code: 'plan-finished', path: document.path, message: `${condition} exists, so the plan's removal condition holds.`,
      fix: 'Delete the plan and its AGENTS.md pointer line in a change the user approves.' })
  }
  return items
}

async function contractItems(target, options, coverageLimits) {
  const path = options.contract ?? '.bstack/project.json'
  if (await readIfPresent(target.root, path) === null) {
    return [{ code: 'contract-missing', path, message: 'No maintenance contract is registered.', fix: 'Run /maintenance create.' }]
  }
  let policy
  const sourceProblems = []
  try { policy = await loadContract(target, options.contract, new Set(), sourceProblems) } catch (error) {
    return problemsOf(error).map(problem => ({ ...problem, fix: 'Run /maintenance create to correct the registration.' }))
  }
  const items = sourceProblems.map(problem => ({ ...problem, fix: 'Run /maintenance create to correct the registration.' }))
  const plan = policy.contract.documents.find(document => document.id === 'plan')
  if (!sourceProblems.some(problem => problem.path === plan?.path)) items.push(...await planItems(target, policy))
  if (sourceProblems.length) return items
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
  for (const name of entries.filter(name => name.startsWith('formal-') && name !== 'formal-verification').sort()) {
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
