import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { readGit } from '../lib/discovery.mjs'
import { matchesPath, pathGlob } from '../lib/glob.mjs'
import { markdownCoverageLimit, markdownLinks, checkLocalLink } from '../lib/document-references.mjs'
import { CommandError } from '../lib/result.mjs'
import { loadContract } from './contract.mjs'
import { run as checkDocuments } from './docs-check.mjs'
import { run as checkGeneratedSections } from './docs-generate.mjs'
import { run as checkKit } from './kit-check.mjs'

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

async function contractItems(target, options) {
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
  items.push(...docs.data.coverageLimits.map(limit => ({ code: 'document-coverage-limit', path: limit.path, message: limit.reason, fix: owner(limit.path) })))
  const regenerate = 'Run /maintenance and its docs generate command, then apply the reviewed proposal.'
  try { items.push(...(await checkGeneratedSections({ ...options, check: true, coveragePolicy: policy })).problems.map(problem => ({ ...problem, fix: regenerate }))) } catch (error) {
    items.push(...problemsOf(error).map(problem => ({ ...problem, fix: regenerate })))
  }
  items.push(...lagging(target, policy.contract, owner))
  return items
}

// A document that no longer moves with the code its scope covers is a candidate for its owner's maintain pass.
function lagging(target, contract, owner) {
  const items = []
  for (const scope of contract.scopes) {
    const globs = scope.paths.map(pathGlob)
    for (const document of contract.documents.filter(document => scope.documentIds.includes(document.id))) {
      const baseline = readGit(target.root, ['log', '-1', '--format=%H', '--', document.path]).stdout.trim()
      if (!baseline) continue
      const changed = readGit(target.root, ['diff', '--name-only', '-z', baseline, 'HEAD']).stdout.split('\0')
        .filter(file => file && globs.some(glob => matchesPath(glob, file)))
      if (changed.length) items.push({ code: 'lagging-document', path: document.path,
        message: `${changed.length} file(s) in scope ${scope.id} changed since ${document.path} last did, at ${baseline.slice(0, 12)}: ${changed.slice(0, 5).join(', ')}.`, fix: owner(document.path) })
    }
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

async function pointerItems(target) {
  const text = await readIfPresent(target.root, 'AGENTS.md')
  if (text === null) return []
  const limit = text.includes('\0') ? 'Local links require supported Markdown text.' : markdownCoverageLimit(text)
  if (limit) return [{ code: 'document-coverage-limit', path: 'AGENTS.md', message: limit, fix: 'Run /agents-md.' }]
  const items = []
  for (const href of markdownLinks(text)) {
    const problem = await checkLocalLink(target.root, 'AGENTS.md', href)
    if (problem) items.push({ ...problem, fix: 'Run /agents-md.' })
  }
  return items
}

export async function run(options) {
  const target = await resolveTarget(options)
  const problems = [...await contractItems(target, options), ...await kitItems(target), ...await pointerItems(target)]
  return { inputs: { repo: target.root, contract: options.contract ?? '.bstack/project.json' }, status: problems.length ? 'failed' : 'passed', problems }
}
