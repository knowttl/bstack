import { readFile } from 'node:fs/promises'
import { readGit } from './discovery.mjs'
import { inspectJSON } from './json.mjs'
import { validateData, validateIds } from './schema.mjs'
import { pathGlob, matchesPath } from './glob.mjs'
import { CommandError } from './result.mjs'
import { resolvePath } from './paths.mjs'

export function baseText(root, base, path) {
  if (base.kind === 'empty-tree') return ''
  const tree = readGit(root, ['ls-tree', '-z', base.objectId, '--', path])
  if (tree.status === 0 && (!tree.stdout || tree.stdout.split(' ')[1] !== 'blob')) return ''
  const result = readGit(root, ['show', `${base.objectId}:${path}`])
  if (result.status === 0) return result.stdout
  throw new CommandError('blocked', [{ code: 'previous-source-unavailable', path,
    message: 'The comparison source cannot be read.', fix: 'Restore the comparison commit and its blobs before validating evidence.' }])
}

// Discover prior config even when the proposed contract moved or removed its old location.
export async function previousPolicy(root, base, contractPath, inventory, priorPath) {
  if (base.kind === 'empty-tree') return null
  const tree = readGit(root, ['ls-tree', '-r', '--name-only', '-z', base.objectId])
  if (tree.status !== 0) throw new CommandError('blocked', [{ code: 'previous-contract-unavailable',
    message: 'Previous policy tree is unavailable.', fix: 'Restore the comparison tree and previous contract objects.' }])
  const candidates = []
  const paths = tree.stdout.split('\0').filter(Boolean)
  const removed = new Set(inventory.changes.filter(change => change.status === 'D' || change.status.startsWith('R')).map(change => change.oldPath ?? change.path))
  const relocated = new Set(inventory.changes.filter(change => change.status.startsWith('R') && change.path === contractPath).map(change => change.oldPath))
  if (priorPath) await resolvePath(root, priorPath, undefined, true)
  const selected = [...new Set([...(paths.includes('.bstack/project.json') ? ['.bstack/project.json'] : []), ...(priorPath ? [priorPath] : [])])]
  if (!selected.length) {
    for (const path of paths) {
      const source = baseText(root, base, path)
      let value
      try { value = inspectJSON(source).value } catch { continue }
      if (value && typeof value === 'object' && ['documents', 'scopes', 'checks'].every(key => Object.hasOwn(value, key))) {
        throw new CommandError('blocked', [{ code: 'previous-contract-reconciliation-required', path,
          message: 'A possible existing policy needs explicit prior-authority reconciliation.',
          fix: 'Reconcile prior authority and supply --previous-contract <repo-relative-file> from the comparison base.' }])
      }
    }
    return null
  }
  for (const path of selected) {
    if (!paths.includes(path)) throw new CommandError('blocked', [{ code: 'previous-contract-unavailable', path,
      message: 'The selected previous contract is absent from the comparison base.', fix: 'Select the authoritative contract path at the comparison base.' }])
    const text = baseText(root, base, path)
    let value
    try { value = inspectJSON(text).value } catch (error) {
      throw new CommandError('blocked', [{ code: 'previous-contract-unavailable', path,
        message: 'Previous contract is not readable JSON.', fix: 'Restore or explicitly migrate the previous policy before validating.' }])
    }
    if (value?.schemaVersion !== 1) throw new CommandError('blocked', [{ code: 'previous-contract-version', path,
      message: 'Previous contract version is unsupported.', fix: 'Provide a reviewed migration for the previous contract version.' }])
    try {
      validateData(JSON.parse(await readFile(new URL('../../schemas/project.schema.json', import.meta.url), 'utf8')), value)
      for (const key of ['documents', 'scopes', 'rules', 'checks', 'generators', 'acceptanceSources']) validateIds(value[key], key)
      for (const scope of value.scopes) {
        scope.paths.forEach(pathGlob)
        if (scope.documentIds.some(id => !value.documents.some(doc => doc.id === id)) || scope.ruleIds.some(id => !value.rules.some(rule => rule.id === id))) throw new Error('Unknown scope reference')
      }
      for (const rule of value.rules) if (rule.checkIds.some(id => !value.checks.some(check => check.id === id))) throw new Error('Unknown check reference')
    } catch {
      throw new CommandError('blocked', [{ code: 'previous-contract-invalid', path,
        message: 'Previous coverage policy is invalid.', fix: 'Restore or review a migration of the previous policy; proposed coverage cannot replace it.' }])
    }
    if (removed.has(path) && !relocated.has(path)) throw new CommandError('blocked', [{ code: 'previous-contract-reconciliation-required', path,
      message: 'A possible prior contract was deleted without a clear rename to the proposed location.',
      fix: 'Explicitly reconcile the deleted policy and its obligations; restore its prior location or record a clear Git rename before validating.' }])
    candidates.push({ path, contract: value })
  }
  if (candidates.length > 1) throw new CommandError('blocked', [{ code: 'ambiguous-previous-contract',
    message: 'Multiple prior maintenance contracts exist.', fix: 'Select and reconcile the authoritative previous policy before validating.' }])
  return candidates[0]
}

export function mapInventory(inventory, contracts) {
  const mappings = inventory.paths.map(path => {
    const scopes = contracts.flatMap(contract => contract.scopes.filter(scope => scope.paths.some(pattern => matchesPath(pathGlob(pattern), path))))
    return { path, scopeIds: [...new Set(scopes.map(scope => scope.id))],
      documentIds: [...new Set(scopes.flatMap(scope => scope.documentIds))], ruleIds: [...new Set(scopes.flatMap(scope => scope.ruleIds))] }
  })
  const candidateDocuments = contracts.flatMap(contract => contract.documents).filter((document, i, all) =>
    all.findIndex(item => item.id === document.id && item.path === document.path) === i &&
    mappings.some(mapping => mapping.documentIds.includes(document.id) || mapping.path === document.path))
  return { mappings, candidateDocuments, unmappedPaths: mappings.filter(mapping => !mapping.documentIds.length).map(mapping => mapping.path) }
}
