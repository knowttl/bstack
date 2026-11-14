import { readFile } from 'node:fs/promises'
import { readGit } from './discovery.mjs'
import { resolveFilePath } from './paths.mjs'
import { inspectJSON } from './json.mjs'
import { validateData } from './schema.mjs'
import { CommandError } from './result.mjs'
import ledgerSchema from '../../schemas/constraints.schema.json' with { type: 'json' }
import baselineSchema from '../../schemas/baseline.schema.json' with { type: 'json' }
import projectSchema from '../../schemas/project.schema.json' with { type: 'json' }

export const ledgerPath = '.bstack/constraints.json'
export const rungs = ledgerSchema.properties.entries.items.properties.constraint.properties.rung.enum
const checkedRungs = ['eliminate', 'detect']

function parseRecord(text, file, schema) {
  let record
  try { record = inspectJSON(text).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('blocked', [{ code: 'constraints-unavailable', path: file, message: `${file} must be readable JSON.`, fix: `Repair ${file}.` }])
  }
  validateData(schema, record)
  return record
}

async function currentRecord(root, file, schema) {
  let text
  try { text = await readFile(await resolveFilePath(root, file), 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  return parseRecord(text, file, schema)
}

function priorRecord(root, file, schema) {
  const shown = readGit(root, ['show', `origin/main:${file}`])
  return shown.status === 0 ? parseRecord(shown.stdout, file, schema) : null
}

export async function loadConstraints(root, contractFile = '.bstack/project.json') {
  const ledger = await currentRecord(root, ledgerPath, ledgerSchema)
  if (!ledger) return null
  const contract = await currentRecord(root, contractFile, projectSchema)
  return { entries: ledger.entries, contractFile, checkIds: contract ? contract.checks.map(check => check.id) : null }
}

const debt = (baseline, ruleId) => baseline.entries.filter(entry => entry.rule === ruleId).map(entry => JSON.stringify([entry.rule, entry.path, entry.key]))

export async function checkConstraints(root, contractFile) {
  const loaded = await loadConstraints(root, contractFile)
  if (!loaded) return []
  const problems = []
  const report = (code, entry, message, fix) => problems.push({ code, path: ledgerPath, message: `${entry.class}: ${message}`, fix })
  const classes = new Set()
  const priorAvailable = readGit(root, ['rev-parse', '--verify', '--quiet', 'origin/main^{commit}']).status === 0
  const priorLedger = priorAvailable ? priorRecord(root, ledgerPath, ledgerSchema) : null
  if (!priorAvailable && loaded.entries.some(entry => entry.constraint?.check?.baseline)) {
    problems.push({ code: 'prior-unavailable-fetch-the-ref', path: ledgerPath, message: 'The prior constraint baselines cannot be verified.', fix: 'Fetch origin/main before checking that each recorded baseline shrinks.' })
  }
  for (const entry of loaded.entries) {
    if (classes.has(entry.class)) report('duplicate-constraint-class', entry, 'The class is recorded more than once.', 'Merge the occurrences into one entry.')
    classes.add(entry.class)
    const { constraint } = entry
    if (!constraint) {
      if (entry.occurrences.length >= 2) report('constraint-threshold-reached', entry, `The class has ${entry.occurrences.length} cited occurrences and no rung.`, 'Give the class the highest rung that works with /verification correct and record it as a constraint.')
      continue
    }
    const { check } = constraint
    if (!check) {
      if (checkedRungs.includes(constraint.rung)) report('constraint-unproven', entry, `The ${constraint.rung} rung records no proven check.`, 'Prove the check with rule-proof and record its check id, rule id and proof date.')
      continue
    }
    if (!loaded.checkIds?.includes(check.id)) report('constraint-check-missing', entry, `${loaded.contractFile} registers no check ${check.id}.`, 'Register the check in the maintained check configuration or correct the check id.')
    if (!check.baseline) continue
    const baseline = await currentRecord(root, check.baseline, baselineSchema)
    if (!baseline) {
      report('constraint-baseline-missing', entry, `The baseline ${check.baseline} does not exist.`, 'Restore the baseline, or remove the field once its debt is cleared.')
      continue
    }
    const priorCheck = priorLedger?.entries.find(prior => prior.class === entry.class)?.constraint?.check
    const priorBaseline = priorCheck?.baseline ? priorRecord(root, priorCheck.baseline, baselineSchema) : null
    if (!priorBaseline) continue
    const recorded = new Set(debt(priorBaseline, priorCheck.ruleId))
    const grown = debt(baseline, check.ruleId).filter(identity => !recorded.has(identity))
    if (grown.length) report('constraint-baseline-grew', entry, `The baseline ${check.baseline} gained ${grown.length} ${check.ruleId} ${grown.length === 1 ? 'entry' : 'entries'} since origin/main.`, 'Fix the new violations instead of recording them: a recorded baseline only shrinks.')
  }
  return problems
}
