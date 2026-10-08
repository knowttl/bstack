import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'
import { validateData, validateIds } from '../../skills/repo-audit/scripts/lib/schema.mjs'
import { CommandError } from '../../skills/repo-audit/scripts/lib/result.mjs'

// Repository-owned formats are resolved independently of the invoking directory.
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Nonempty strings are the shared primitive for joining IDs and evidence descriptions.
export const text = { type: 'string', minLength: 1 }

export function object(properties) {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties }
}

export function array(items) { return { type: 'array', items } }
export function fail(message, status = 'blocked') {
  throw new CommandError(status, [{ code: 'invalid-evidence', message, fix: 'Use the format and prerequisites in docs/evaluation.md.' }])
}
export async function readJSON(path) { return JSON.parse(await readFile(path, 'utf8')) }

export function options(args, values, flags = []) {
  const result = {}
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith('--') ? args[i].slice(2) : ''
    if (![...values, ...flags, 'json'].includes(name) || Object.hasOwn(result, name)) fail(`Unknown or repeated argument: ${args[i]}. Allowed: ${[...values, ...flags, 'json'].map(name => `--${name}`).join(', ')}`, 'usage-error')
    if (flags.includes(name) || name === 'json') result[name] = true
    else if (!args[i + 1] || args[i + 1].startsWith('--')) fail(`Missing value for ${args[i]}`, 'usage-error')
    else result[name] = args[++i]
  }
  return result
}

export async function scenario(id) {
  const scenarios = await readJSON(join(root, 'tests', 'eval', 'scenarios', 'scenarios.json'))
  const schema = object({ schemaVersion: { const: 1 }, scenarios: array(object({
    id: text, fixture: text, request: text, answers: array(text), checkpoints: array(text),
    invocation: { enum: ['explicit', 'implicit'] }, checks: array(object({ id: text, caseId: text, question: text }))
  })) })
  validateData(schema, scenarios)
  validateIds(scenarios.scenarios, '$/scenarios')
  const fixtures = await readJSON(join(root, 'tests', 'fixtures', 'fixtures.json'))
  const registry = await readJSON(join(root, 'tests', 'acceptance', 'cases.json'))
  for (const item of scenarios.scenarios) {
    validateIds(item.checks, '$/checks')
    if (!Object.hasOwn(fixtures, item.fixture) || !item.checks.length || !item.checkpoints.length || new Set(item.checkpoints).size !== item.checkpoints.length) fail(`Invalid scenario: ${item.id}`)
    for (const check of item.checks) if (!registry.cases.some(entry => entry.id === check.caseId)) fail(`Unknown acceptance ID: ${check.caseId}`)
  }
  const selected = scenarios.scenarios.find(item => item.id === id)
  if (!selected) fail(`Unknown scenario: ${id}`, 'usage-error')
  return selected
}

export async function checkRegistry(path) {
  const registry = await readJSON(path)
  validateData(object({ schemaVersion: { const: 1 }, cases: array(object({
    id: text, ownerTask: text, criterionSource: text, evidenceType: { enum: ['automated', 'agent', 'manual'] },
    procedure: { type: 'object' }
  })) }), registry)
  validateIds(registry.cases, '$/cases')
  const design = await readFile(join(root, 'docs', 'design.md'), 'utf8')
  const section = design.split('### Acceptance cases\n')[1].split('## Evidence and limitations')[0]
  const ids = [...section.matchAll(/^(\d+)\. /gm)].map(match => `AC-${match[1]}`)
  if (registry.cases.length !== ids.length || ids.some(id => !registry.cases.some(item => item.id === id))) fail('Registry must register every design acceptance ID exactly once.')
  const plan = await readFile(join(root, 'docs', 'implementation-plan.md'), 'utf8')
  const tasks = [...plan.matchAll(/^### (T[\da.]+) /gm)].map(match => match[1])
  for (const item of registry.cases) {
    if (!tasks.includes(item.ownerTask)) fail(`Unknown owner task: ${item.ownerTask}`)
    if (item.criterionSource !== `docs/design.md#${item.id}`) fail(`Invalid criterion source for ${item.id}`)
    const procedure = item.procedure
    if (procedure.status === 'planned') {
      validateData(object({ status: { const: 'planned' }, description: text }), procedure)
      if (!procedure.description.trim()) fail(`Empty procedure for ${item.id}`)
    } else {
      validateData(object({ status: { const: 'completed' }, path: text, name: text, artifacts: { ...array(text), minItems: 1 } }), procedure)
      if (item.evidenceType === 'automated') {
        const suites = Object.values(await readJSON(join(root, 'tests', 'tasks.json'))).flat()
        if (!suites.includes(procedure.path)) fail(`Unregistered test: ${procedure.path}`)
        const program = parse(await readFile(resolve(root, procedure.path), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' })
        const names = program.body.filter(node => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression' && node.expression.callee.name === 'test').map(node => node.expression.arguments[0]?.value)
        if (!names.includes(procedure.name)) fail(`Completed procedure must name an existing literal test: ${procedure.name}`)
      } else {
        if (procedure.path !== 'tests/eval/scenarios/scenarios.json') fail('Agent and manual procedures must name a scenario.')
        await scenario(procedure.name)
      }
      for (const file of [procedure.path, ...procedure.artifacts]) {
        if (!(await stat(resolve(root, file))).isFile() || !(await readFile(resolve(root, file))).length) fail(`Evidence is missing or empty: ${file}`)
      }
    }
  }
  return { registered: registry.cases.length, planned: registry.cases.filter(item => item.procedure.status === 'planned').length, passed: 0 }
}
