import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolveTarget } from '../lib/repo.ts'
import { resolveFilePath } from '../lib/paths.ts'
import { inspectJSON } from '../lib/json.ts'
import { validateData } from '../lib/schema.ts'
import { validateFindings } from './findings.ts'
import { CommandError } from '../lib/result.ts'
import type { Findings } from './findings.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn } from '../lib/result.ts'

type DebtEntry = { rule: string; path: string; key: string }

const identity = (entry: DebtEntry) =>JSON.stringify([entry.rule, entry.path, entry.key])

export async function run(options: Options<'baseline' | 'violations' | 'refresh' | 'finding' | 'findings' | 'entry'>) {
  const adding = (['finding', 'findings', 'entry'] as const).some(key => options[key])
  if (!options.baseline || !options.violations || (adding && (!options.refresh || !(['finding', 'findings', 'entry'] as const).every(key => options[key])))) {
    throw new CommandError('usage-error', [{ code: 'invalid-baseline-options', message: 'Checking needs baseline and violations; adding needs refresh, a selected finding, findings and one entry.', fix: 'Use --baseline <repo-relative-file> --violations <file> [--refresh [--finding <id> --findings <file> --entry <file>]].' }])
  }
  const target = await resolveTarget(options)
  const path = await resolveFilePath(target.root, options.baseline)
  const read = async (path: string) => inspectJSON(await readFile(path, 'utf8')).value
  const baseline: { entries: DebtEntry[] } = await read(path)
  const schema = JSON.parse(await readFile(new URL('../../schemas/baseline.schema.json', import.meta.url), 'utf8'))
  validateData(schema, baseline)
  const entrySchema = schema.properties.entries.items
  const violations: DebtEntry[] = await read(options.violations)
  const { reason, removalCondition, ...properties } = entrySchema.properties
  validateData({ type: 'array', uniqueItems: true, items: { type: 'object', additionalProperties: false, required: ['rule', 'path', 'key'], properties } }, violations)
  for (const entries of [baseline.entries, violations]) {
    if (new Set(entries.map(identity)).size !== entries.length) throw new CommandError('failed', [{ code: 'duplicate-violation', message: 'Rule, path and key must identify one entry.', fix: 'Remove duplicate violation identities.' }])
    for (const entry of entries) await resolveFilePath(target.root, entry.path)
  }
  const current = new Set(violations.map(identity))
  const recorded = new Set(baseline.entries.map(identity))
  let newDebt = violations.filter(entry => !recorded.has(identity(entry)))
  const removedDebt = baseline.entries.filter(entry => !current.has(identity(entry)))
  const retained = baseline.entries.filter(entry => current.has(identity(entry)))
  if (adding) {
    const entry: DebtEntry = await read(options.entry!)
    validateData(entrySchema, entry)
    const findings: Findings = await read(options.findings!)
    await validateFindings(findings, target)
    const finding = findings.findings.find(item => item.id === options.finding)
    if (!finding || finding.status !== 'selected' || finding.category !== 'debt' || finding.resolved ||
        !findings.selectedFindingIds.includes(finding.id) || !finding.scope.includes(entry.path) || !newDebt.some(item => identity(item) === identity(entry))) {
      throw new CommandError('failed', [{ code: 'unauthorized-baseline-entry', message: 'The new entry must match a current violation in the selected unresolved debt finding scope.', fix: 'Select the matching debt finding and supply its narrow entry.' }])
    }
    retained.push(entry)
    newDebt = newDebt.filter(item => identity(item) !== identity(entry))
  }
  const problems = newDebt.map(entry => ({ code: 'new-debt', message: `Unrecorded violation: ${identity(entry)}`, fix: 'Fix it or select its debt finding before adding a narrow entry.' }))
  if (!options.refresh) problems.push(...removedDebt.map(entry => ({ code: 'stale-debt', message: `Fixed entry must be removed: ${identity(entry)}`, fix: 'Run baseline check with --refresh to remove fixed entries.' })))
  if (options.refresh && !problems.length) {
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify({ schemaVersion: 1, entries: retained }, null, 2) + '\n', { flag: 'wx', mode: (await stat(path)).mode })
      await rename(temporary, path)
    } finally { await rm(temporary, { force: true }) }
  }
  return { status: problems.length ? 'failed' : 'passed', problems, data: { baseline: path, debt: retained, newDebt, removedDebt, refreshed: Boolean(options.refresh && !problems.length) } } satisfies CommandReturn
}
