import { readFile } from 'node:fs/promises'
import { resolveTarget } from '../lib/repo.mjs'
import { readGit } from '../lib/discovery.mjs'
import { validateData } from '../lib/schema.mjs'
import { pathGlob, matchesPath } from '../lib/glob.mjs'
import { CommandError } from '../lib/result.mjs'

// Locks describe resolution, rather than authored responsibility or coupling.
const lockfiles = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'uv.lock', 'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'Gemfile.lock', 'composer.lock']
// These generated directory conventions match discovery. Projects declare other generated paths explicitly.
const generatedPaths = ['.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.cache'].map(name => `**/${name}/**`)

export async function run(options) {
  if (!options.range) throw new CommandError('usage-error', [{ code: 'missing-range', message: '--range is required.', fix: 'Supply --range <base>..<head> or --range <head> for all reachable history.' }])
  const target = await resolveTarget(options)
  function git(args) {
    const result = readGit(target.root, args)
    if (result.error || result.status !== 0) throw new CommandError('blocked', [{ code: 'history-unreadable', message: 'Requested Git history or objects could not be read.', fix: 'Supply locally available commit revisions and complete history.' }])
    return result.stdout
  }
  function commit(value) {
    if (!value || value.startsWith('-') || value.includes('..') || value.includes('\0')) throw new CommandError('usage-error', [{ code: 'invalid-range', message: 'Expected a commit or a two-dot commit range.', fix: 'Use --range <base>..<head> or --range <head>.' }])
    return git(['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`]).trim()
  }
  const parts = options.range.split('..')
  if (parts.length > 2 || parts.some(part => !part || part.startsWith('.') || part.startsWith('-'))) throw new CommandError('usage-error', [{ code: 'invalid-range', message: 'Only single revisions and two-dot ranges are supported.', fix: 'Use --range <base>..<head> or --range <head>.' }])
  const base = parts.length === 2 ? commit(parts[0]) : null
  const head = commit(parts.at(-1))
  const range = base ? `${base}..${head}` : head
  let policy = { schemaVersion: 1, generatedPaths: [], formattingCommits: [] }
  if (options.exclusions) {
    try { policy = JSON.parse(await readFile(options.exclusions, 'utf8')) } catch {
      throw new CommandError('failed', [{ code: 'invalid-exclusions', path: options.exclusions, message: 'Exclusions must be readable JSON.', fix: 'Supply data matching schemas/measure-exclusions.json.' }])
    }
    validateData(JSON.parse(await readFile(new URL('../../schemas/measure-exclusions.json', import.meta.url), 'utf8')), policy)
  }
  const rules = [
    ...lockfiles.map(name => ({ reason: 'lockfile', pattern: `**/${name}` })),
    ...[...generatedPaths, ...policy.generatedPaths].map(pattern => ({ reason: 'generated', pattern }))
  ].map(rule => ({ ...rule, glob: pathGlob(rule.pattern) }))
  const formatting = new Set(policy.formattingCommits.map(commit))
  const excluded = new Map()
  function exclusion(path) {
    if (excluded.get(path)?.reason === 'non-blob') return true
    const rule = rules.find(rule => matchesPath(rule.glob, path))
    if (rule) excluded.set(path, { path, reason: rule.reason, pattern: rule.pattern })
    return Boolean(rule)
  }
  const files = new Map()
  const shallow = git(['rev-parse', '--is-shallow-repository']).trim() === 'true'
  for (const entry of git(['ls-tree', '-r', '-z', '-l', head]).split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t')
    const [, type, , size] = entry.slice(0, tab).trim().split(/\s+/u)
    const path = entry.slice(tab + 1)
    if (exclusion(path)) continue
    if (type !== 'blob') { excluded.set(path, { path, reason: 'non-blob' }); continue }
    files.set(path, { path, bytes: Number(size), commits: [] })
  }
  const log = git(['log', '--format=%x00%H%x00', '--name-status', '-z', '--root', '--find-renames=50%', '--diff-merges=first-parent', range, '--'])
  const commits = []
  let record
  const tokens = log.split('\0')
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index].replace(/^\n/u, '')
    if (!token) continue
    if (/^[a-f0-9]{40,64}$/u.test(token)) { record = { commit: token, changes: [] }; commits.push(record); continue }
    const originalPath = tokens[++index]
    const renamed = token.startsWith('R')
    const path = renamed ? tokens[++index] : originalPath
    record.changes.push({ status: token[0], path, ...(renamed ? { originalPath } : {}) })
  }
  if ([...formatting].some(value => !commits.some(record => record.commit === value))) throw new CommandError('failed', [{ code: 'exclusion-outside-range', message: 'Every formatting commit must belong to the selected range.', fix: 'Remove out-of-range exclusions or change the range.' }])
  // Walk newest to oldest so older names join the final name, including chained renames.
  const aliases = new Map()
  const pairs = new Map()
  const renames = []
  for (const record of commits) {
    const touched = new Set()
    for (const change of record.changes) {
      if (change.status === 'D') aliases.delete(change.path)
      const path = aliases.get(change.path) ?? change.path
      if (change.originalPath) {
        aliases.delete(change.path)
        aliases.set(change.originalPath, path)
        renames.push({ commit: record.commit, path: change.path, originalPath: change.originalPath, canonicalPath: path })
      }
      if (change.status === 'A') aliases.delete(change.path)
      const omitted = exclusion(change.path) || (change.originalPath ? exclusion(change.originalPath) : false) || exclusion(path)
      if (formatting.has(record.commit) || omitted) continue
      if (!files.has(path)) files.set(path, { path, bytes: null, commits: [] })
      touched.add(path)
    }
    const paths = [...touched].sort()
    for (const path of paths) files.get(path).commits.push(record.commit)
    for (let a = 0; a < paths.length; a++) for (let b = a + 1; b < paths.length; b++) {
      const key = JSON.stringify([paths[a], paths[b]])
      if (!pairs.has(key)) pairs.set(key, { paths: [paths[a], paths[b]], commits: [] })
      pairs.get(key).commits.push(record.commit)
    }
  }
  return { inputs: { repo: target.root, range: options.range, exclusions: options.exclusions ?? null }, data: {
    range: { requested: options.range, base, head, resolved: range },
    shallow,
    renameHandling: 'Git 50% similarity detection, older paths joined to newest names within each file lifetime in the range', renames,
    exclusions: { rules: rules.map(({ reason, pattern }) => ({ reason, pattern })), files: [...excluded.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0), formattingCommits: [...formatting].sort() },
    files: [...files.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(file => ({ ...file, changeCount: file.commits.length })),
    coChangePairs: [...pairs.values()].map(pair => ({ ...pair, changeCount: pair.commits.length })),
    limitations: ['Sizes are bytes at the resolved head, with null for files absent there. Working-tree edits are not measured.', 'History and co-change are investigation signals, not violations, import analysis or observed merge conflicts. Formatting exclusions are explicitly declared, not inferred from commit messages.', 'Merge commits use their first-parent diff. Rename lineage is bounded by the selected range. Shallow history may omit ancestors.']
  } }
}
