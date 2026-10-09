import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { previousPolicy, mapInventory } from '../lib/evidence-policy.mjs'
import { CommandError } from '../lib/result.mjs'
import { loadContract } from './contract.mjs'
import { relative, resolve } from 'node:path'
import { resolveLinks } from '../lib/paths.mjs'

// Inventory reads are independent of ambient Git overrides, just like target resolution.
const gitEnv = { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined }

// Callers of later assessment validation must use this live inventory, never a supplied path list.
export function collectInventory(root, base) {
  function invoke(args, input) {
    return spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env: gitEnv, input, maxBuffer: 64 * 1024 * 1024 })
  }
  function git(args, input) {
    const result = invoke(args, input)
    if (result.error || result.status !== 0) throw new CommandError('blocked', [{ code: 'git-inventory-unavailable',
      message: result.error?.message ?? result.stderr.trim(), fix: 'Restore Git access and the required objects before collecting evidence.' }])
    return result.stdout.replace(/\n$/, '')
  }
  const headResult = invoke(['rev-parse', '--verify', 'HEAD^{commit}'])
  const head = headResult.status === 0 ? headResult.stdout.trim() : null
  if (!head) {
    const branch = invoke(['symbolic-ref', '-q', 'HEAD'])
    const ref = branch.status === 0 ? invoke(['show-ref', '--verify', '--quiet', branch.stdout.trim()]) : null
    if (branch.error || branch.status !== 0 || ref.error || ref.status !== 1) {
      throw new CommandError('blocked', [{ code: 'head-unavailable', message: 'HEAD cannot resolve to a commit or an unborn branch.', fix: 'Restore the current branch before comparing.' }])
    }
  }
  let resolvedBase
  if (base === 'empty' && !head) resolvedBase = { ref: 'empty', kind: 'empty-tree', objectId: git(['hash-object', '-t', 'tree', '--stdin'], '') }
  else {
    const result = invoke(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`])
    if (result.error || result.status !== 0) {
      const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true'
      throw new CommandError('blocked', [{ code: 'base-unavailable', path: base,
        message: shallow ? 'The required comparison base is unavailable in this shallow clone.' : 'The comparison base does not resolve to a commit.',
        fix: shallow ? `Fetch the full origin history with git fetch --unshallow origin, then fetch the required base with git fetch origin ${base}.` : 'Fetch or select the required commit. Use --base empty only before the first commit.' }])
    }
    resolvedBase = { ref: base, kind: 'commit', objectId: result.stdout.trim() }
  }
  const changes = []
  function diff(source, args) {
    const fields = git(['diff', '--no-ext-diff', '--no-textconv', '--ignore-submodules=none', '--name-status', '-z', '--find-renames', ...args, '--']).split('\0')
    for (let index = 0; index < fields.length && fields[index];) {
      const status = fields[index++]
      const path = fields[index++]
      if (/^[RC]/.test(status)) changes.push({ source, status, oldPath: path, path: fields[index++] })
      else changes.push({ source, status, path })
    }
  }
  if (head) diff('committed', [resolvedBase.objectId, head])
  diff('staged', ['--cached', head ?? resolvedBase.objectId])
  diff('unstaged', [])
  for (const path of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) changes.push({ source: 'new', status: 'A', path })
  const paths = [...new Set(changes.flatMap(change => change.oldPath ? [change.oldPath, change.path] : [change.path]))].sort()
  return { base: resolvedBase, head, changes, paths }
}

export async function run(options) {
  if (!options.base) throw new CommandError('usage-error', [{ code: 'missing-base', message: 'An explicit comparison base is required.', fix: 'Supply --base <ref>, or --base empty before the first commit.' }])
  const target = await resolveTarget(options)
  const inventory = collectInventory(target.root, options.base)
  if (options.portable) {
    const path = relative(target.root, await resolveLinks(resolve(target.root, options.portable))).split('\\').join('/')
    if (!inventory.head || path.startsWith('../') || path === '..' || !path) throw new CommandError('usage-error', [{
      code: 'invalid-portable-assessment', message: 'Portable collection needs a committed source and an internal assessment path.',
      fix: 'Commit source changes, then supply --portable <repo-relative-assessment>.' }])
    if (inventory.changes.some(change => change.oldPath && [change.oldPath, change.path].includes(path) || change.source !== 'committed' && change.path !== path)) throw new CommandError('blocked', [{
      code: 'uncommitted-source', message: 'Commit source changes before collecting portable review.', fix: 'Commit the reviewed implementation first.' }])
    inventory.changes = inventory.changes.filter(change => change.path !== path && change.oldPath !== path)
    inventory.paths = inventory.paths.filter(item => item !== path)
  }
  const removedPaths = new Set(inventory.changes.filter(change => change.status === 'D' || change.status.startsWith('R')).map(change => change.oldPath ?? change.path))
  const { contract, path: contractPath } = await loadContract(target, options.contract, removedPaths)
  const previous = await previousPolicy(target.root, inventory.base, contractPath, inventory, options['previous-contract'])
  const { mappings, unmappedPaths, candidateDocuments } = mapInventory(inventory, [contract, ...(previous ? [previous.contract] : [])])
  const assessment = { schemaVersion: 1, repo: options.portable ? '.' : target.root, contract: contractPath, previousContract: previous?.path ?? null, ...inventory, mappings, unmappedPaths,
    documents: candidateDocuments.map(document => ({ ...document, assessment: null })),
    unmappedAssessments: unmappedPaths.map(path => ({ path, assessment: null })), decisions: [], coverage: [], execution: [], fingerprint: null }
  const directory = await createScratch(target)
  const path = join(directory, 'assessment.json')
  await writeFile(path, JSON.stringify(assessment, null, 2) + '\n')
  return { inputs: { repo: target.root, contract: contractPath, base: options.base },
    data: { ...inventory, mappings, candidateDocuments, unmappedPaths, path } }
}
