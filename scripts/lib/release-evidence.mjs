import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { root, text, object, array, readJSON, scenario, fail, fixtureHash, verifiedExecution } from './evaluation.mjs'
import { redactEvidence } from './evaluation-host.mjs'
import { affectedScenarios } from './evaluation-impact.mjs'
import { validateData } from '../../skills/repo-audit/scripts/lib/schema.mjs'
import { canonicalJSON, hashBytes } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

// These candidate-bound checks cover hard breaks not represented by scored ledger rows.
const hardChecks = ['deterministic-suite', 'package-check', 'registry', 'installer', 'fixture-unchanged',
  'approval-before-write', 'isolation', 'explicit-invocation', 'implicit-invocation']
// Commit and hash identities prevent accidental comparison across incompatible batches.
const commit = { type: 'string', pattern: '^[0-9a-f]{40}$' }
// Ledger identity hashes use the same SHA-256 format as batch finalization.
const hash = { type: 'string', pattern: '^[0-9a-f]{64}$' }
// Counts must be exact integers so threshold comparisons never accept partial runs.
const count = { type: 'integer' }

function key(row) { return `${row.scenario}/${row.check}` }
function identity(row) { return canonicalJSON([row.model, row.adapterHash, row.fixtureHash, row.criteriaHash, row.binding]) }

async function compatibleEvidence(ledger, definitions, results) {
  const directory = results === join(root, 'tests/eval/results') ? join(results, 'runs') : results
  const records = new Map()
  const fixtures = new Map()
  const runners = new Map()
  const compatible = []
  const recipeHash = hashBytes(await readFile(join(root, 'tests/eval/container/Dockerfile')))
  for (const row of ledger) {
    const definition = definitions.find(item => item.id === row.scenario)
    if (!definition || !definition.checks.some(check => check.id === row.check && check.caseId === row.caseId)) continue
    if (!runners.has(row.candidate)) {
      const diff = spawnSync('git', ['diff', '--quiet', '--no-ext-diff', '--no-textconv', row.candidate, '--',
        'scripts/eval.mjs', 'scripts/lib/evaluation.mjs', 'scripts/lib/evaluation-host.mjs',
        'scripts/lib/evaluation-container.mjs', 'scripts/lib/evaluation-scope.mjs', 'tests/eval/container/Dockerfile',
        'package.json', 'package-lock.json', ...['run', 'paths', 'result', 'schema', 'fingerprint']
          .map(name => `skills/repo-audit/scripts/lib/${name}.mjs`)], { cwd: root })
      if (diff.status !== 0 && diff.status !== 1) fail(`Cannot verify evaluation runner inputs: ${row.candidate}`)
      runners.set(row.candidate, diff.status === 0)
    }
    if (!runners.get(row.candidate)) continue
    if (!fixtures.has(definition.fixture)) fixtures.set(definition.fixture, await fixtureHash(definition.fixture))
    const bindings = []
    let matches = true
    for (const id of row.runIds) {
      if (!/^[a-zA-Z0-9_.-]+$/.test(id) || id === '.' || id === '..') fail('Invalid contributing run ID.')
      if (!records.has(id)) records.set(id, await readJSON(join(directory, id, 'run.json')))
      const run = records.get(id)
      if (run.id !== id || run.sourceRevision !== row.candidate || run.scenario?.id !== row.scenario ||
          run.mode !== row.mode || run.model !== row.model || run.adapterHash !== row.adapterHash ||
          run.fixture?.revision !== row.fixtureHash || run.criteriaHash !== row.criteriaHash ||
          !Number.isFinite(Date.parse(run.createdAt)) || !run.transcript || run.hostFailure ||
          !run.isolation?.verified || !run.isolation.cleanedAt || !verifiedExecution(run) ||
          run.agent !== run.adapter?.invocation?.agent || run.model !== run.adapter?.invocation?.model) fail(`Invalid contributing run: ${id}`)
      const current = JSON.parse(redactEvidence(JSON.stringify(definition), run))
      const stage = definition.checkpoints.at(-1)
      const request = (row.mode === 'with' && definition.invocation === 'explicit' ? `${run.adapter.invocation.explicit}\n` : '') +
        (['foundation', 'final'].includes(stage) ? `Active checkpoint: ${stage}.\n` : '') + current.request
      const inputs = ['fixture', 'request', 'answers', 'checkpoints', 'invocation', 'mode', 'checks']
      if (run.fixture.name !== definition.fixture || row.fixtureHash !== fixtures.get(definition.fixture) || run.execution.recipeHash !== recipeHash ||
          row.criteriaHash !== hashBytes(canonicalJSON(definition.checks)) || run.stage !== stage || run.request !== request ||
          inputs.some(name => canonicalJSON(run.scenario[name] ?? null) !== canonicalJSON(current[name] ?? null)) ||
          canonicalJSON(run.turns.map(turn => turn.message)) !== canonicalJSON([request, ...current.answers])) matches = false
      bindings.push(canonicalJSON([run.stage, run.scenario.request, run.scenario.answers, run.scenario.invocation,
        run.agent, run.adapter, run.os, run.tools, run.execution.imageId, run.execution.recipeHash, run.execution.toolchain]))
    }
    if (new Set(bindings).size !== 1) fail(`Incompatible contributing runs: ${key(row)}`)
    if (matches) compatible.push({ ...row, binding: bindings[0] })
  }
  return compatible.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) ||
    canonicalJSON([...a.runIds].sort()).localeCompare(canonicalJSON([...b.runIds].sort())))
}

async function previousRelease(directory, version, candidate) {
  let names
  try { names = await readdir(directory) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  const releases = []
  for (const name of names.filter(name => /^\d+\.\d+\.\d+\.json$/.test(name))) {
    const record = await readJSON(join(directory, name))
    if (record.schemaVersion !== 2) continue
    if (name === `${version}.json`) {
      if (record.verdict === 'passed') fail(`Release ${version} has already passed; bump the release version.`)
      if (record.candidate !== candidate) fail(`Release ${version} belongs to another candidate; bump the release version.`)
    }
    if (record.verdict !== 'passed') continue
    if (record.version !== name.slice(0, -5) || !Array.isArray(record.gatingSet) || !Array.isArray(record.checks)) fail(`Invalid previous release: ${name}`)
    releases.push(record)
  }
  function compare(a, b) {
    const av = a.version.split('.').map(Number)
    const bv = b.version.split('.').map(Number)
    return av[0] - bv[0] || av[1] - bv[1] || av[2] - bv[2]
  }
  if (releases.some(record => compare(record, { version }) >= 0)) fail('Release version must follow the last passed ledger release.')
  return releases.sort(compare).at(-1) ?? null
}

export async function releaseGate(opts, results) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(opts.release)) fail('Use a release version such as 0.1.1.', 'usage-error')
  validateData(commit, opts.candidate)
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
  if (head.status !== 0 || head.stdout.trim() !== opts.candidate) fail('Release candidate must be the current full HEAD commit.')
  const report = await readJSON(opts.checks)
  validateData(object({ schemaVersion: { const: 1 }, candidate: commit, model: text,
    checks: array(object({ id: { enum: hardChecks }, passed: { type: 'boolean' } })),
    agentProcesses: array(object({ scenario: text, runs: { const: 5 }, failures: count, infrastructureFailures: count })) }), report)
  if (report.candidate !== opts.candidate) fail('Hard-break report belongs to another candidate.')
  if (report.checks.length !== hardChecks.length || new Set(report.checks.map(row => row.id)).size !== hardChecks.length) fail('Record every hard-break check exactly once.')
  const definitions = (await readJSON(join(root, 'tests/eval/scenarios/scenarios.json'))).scenarios
  await scenario(definitions[0].id)
  const smoke = definitions.filter(item => item.tier === 'smoke')
  if (report.agentProcesses.length !== smoke.length || new Set(report.agentProcesses.map(row => row.scenario)).size !== smoke.length ||
      report.agentProcesses.some(row => !smoke.some(item => item.id === row.scenario) || row.failures < 0 || row.infrastructureFailures < 0 || row.failures + row.infrastructureFailures > row.runs)) fail('Record five agent process outcomes per smoke scenario, separating infrastructure failures.')
  const entries = (await readFile(join(results, 'ledger.jsonl'), 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  for (const row of entries) {
    validateData(object({ date: text, candidate: commit, tier: { enum: ['smoke', 'full'] }, model: text,
      adapterHash: hash, fixtureHash: hash, criteriaHash: hash, scenario: text, mode: { enum: ['without', 'with'] },
      check: text, caseId: text, passes: count, runs: count, runIds: array(text) }), row)
    if (!Number.isFinite(Date.parse(row.date)) || row.passes < 0 || row.runs < 1 || row.passes > row.runs || row.runIds.length !== row.runs ||
        new Set(row.runIds).size !== row.runs) fail('Invalid ledger counts, date or contributing run IDs.')
  }
  const ledger = await compatibleEvidence(entries, definitions, results)
  const directory = join(results, 'release')
  const previous = await previousRelease(directory, opts.release, opts.candidate)
  const blocking = report.checks.filter(row => !row.passed).map(row => ({ class: 'hard-break', check: row.id }))
  blocking.push(...report.agentProcesses.filter(row => row.failures >= 2).map(row =>
    ({ class: 'hard-break', scenario: row.scenario, check: 'agent-process', passes: row.runs - row.failures, runs: row.runs })))
  const pending = report.agentProcesses.filter(row => row.infrastructureFailures).map(row => ({ scenario: row.scenario, reason: 'Replace infrastructure failures before qualification.' }))
  const knownIssues = []
  const checks = []
  const confirmation = new Set()
  const gatingSet = []
  const carryover = []
  const impact = new Map()
  async function carryoverReason(definition, source) {
    const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', source, opts.candidate], { cwd: root })
    if (ancestor.status !== 0) fail(`Carryover candidate is not an ancestor: ${source}`)
    const snapshot = spawnSync('git', ['show', `${source}:tests/eval/scenarios/scenarios.json`], { cwd: root, encoding: 'utf8' })
    if (snapshot.status !== 0) fail('Cannot verify the carried scenario definition.')
    const prior = JSON.parse(snapshot.stdout).scenarios.find(item => item.id === definition.id)
    const inputs = ['fixture', 'request', 'answers', 'checkpoints', 'invocation', 'mode', 'checks']
    if (!prior || inputs.some(name => canonicalJSON(prior[name] ?? null) !== canonicalJSON(definition[name] ?? null))) {
      return 'Changed scenario inputs require a fresh measurement.'
    }
    if (!impact.has(source)) impact.set(source, await affectedScenarios(root, source, definitions, true))
    return impact.get(source).scenarios.includes(definition.id) ? 'Changed covered inputs require a fresh measurement.' : null
  }
  for (const definition of smoke) {
    const history = ledger.filter(row => row.tier === 'smoke' && row.mode === 'with' && row.scenario === definition.id)
    const source = history.findLast(row => row.candidate === opts.candidate)?.candidate ?? history.at(-1)?.candidate
    if (source && source !== opts.candidate) {
      const reason = await carryoverReason(definition, source)
      if (reason) {
        pending.push({ scenario: definition.id, reason })
        continue
      }
      carryover.push({ scenario: definition.id, candidate: source })
    }
    const rows = history.filter(row => row.candidate === source)
    const groups = new Map()
    for (const row of rows) {
      const signature = canonicalJSON([...row.runIds].sort())
      if (!groups.has(signature)) groups.set(signature, [])
      groups.get(signature).push(row)
    }
    if ([...groups.values()].some(group => group.length !== definition.checks.length ||
        new Set(group.map(row => row.check)).size !== definition.checks.length ||
        group.some(row => !definition.checks.some(check => check.id === row.check)))) fail(`Scenario batch must contain every check exactly once: ${definition.id}`)
    for (const check of definition.checks) {
      const batches = [...groups.values()].map(group => group.find(row => row.check === check.id))
      if (!batches.length) { pending.push({ scenario: definition.id, check: check.id, reason: 'Missing smoke measurement.' }); continue }
      const first = batches[0]
      if (batches.length > 2 || batches.some(row => row.runs !== 5 || row.caseId !== check.caseId || row.model !== report.model ||
          row.criteriaHash !== hashBytes(canonicalJSON(definition.checks)) || identity(row) !== identity(first)) ||
          new Set(batches.flatMap(row => row.runIds)).size !== batches.length * 5) fail(`Incompatible or overlapping smoke batches: ${key(first)}`)
      const baseline = ledger.findLast(row => row.tier === 'smoke' && row.mode === 'without' && key(row) === key(first) && identity(row) === identity(first) && row.runs === 5)
      if (!baseline || baseline.caseId !== check.caseId) { pending.push({ scenario: definition.id, check: check.id, reason: 'Missing comparable five-run baseline.' }); continue }
      if (baseline.runIds.some(id => batches.some(row => row.runIds.includes(id)))) fail(`Baseline and with-skill runs overlap: ${key(first)}`)
      const total = { scenario: definition.id, check: check.id, caseId: check.caseId,
        passes: batches.reduce((sum, row) => sum + row.passes, 0), runs: batches.length * 5,
        baseline: { passes: baseline.passes, runs: baseline.runs }, identity: identity(first),
        runIds: batches.flatMap(row => row.runIds) }
      checks.push(total)
      const hard = ['AC-42', 'AC-43'].includes(check.caseId) || ['fixtureUnchanged', 'installerPassed'].includes(check.machine?.type)
      if (hard && total.passes < total.runs) blocking.push({ ...total, class: 'hard-break' })
      if (first.passes < 3 && batches.length === 1) { confirmation.add(definition.id); continue }
      const threshold = total.passes * 5 >= total.runs * 3
      // Integer cross multiplication preserves the exact two-of-five margin at both sample sizes.
      const margin = baseline.passes >= 3 || total.passes * 5 >= (baseline.passes + 2) * total.runs
      if (!threshold || !margin) {
        const issue = { ...total, reason: !threshold ? 'below k/N' : 'below per-check margin' }
        if (previous?.gatingSet.includes(key(first))) blocking.push({ ...issue, class: 'regression' })
        else knownIssues.push(issue)
      }
      // Each smoke batch has five runs, so the last two batches give an exact ten-run history.
      const recent = history.filter(row => row.check === check.id && row.runs === 5 && identity(row) === identity(first))
        .map(row => ({ passes: row.passes, runIds: row.runIds }))
        .filter((row, index, all) => all.findIndex(other => canonicalJSON([...other.runIds].sort()) === canonicalJSON([...row.runIds].sort())) === index).slice(-2)
      total.recent = recent
      if (batches.at(-1).passes >= 4 && (!previous || recent.reduce((sum, row) => sum + row.passes, 0) >= recent.length * 4)) gatingSet.push(key(first))
    }
  }
  const full = []
  for (const definition of definitions) {
    const history = ledger.filter(row => row.tier === 'full' && row.scenario === definition.id && row.mode === (definition.mode ?? 'with'))
    const source = history.findLast(row => row.candidate === opts.candidate)?.candidate ?? history.at(-1)?.candidate
    if (source && source !== opts.candidate) {
      if (await carryoverReason(definition, source)) continue
      carryover.push({ scenario: definition.id, candidate: source, tier: 'full' })
    }
    full.push(...history.filter(row => row.candidate === source))
  }
  for (const row of full.filter(row => row.passes < row.runs)) {
    knownIssues.push({ scenario: row.scenario, check: row.check, caseId: row.caseId, passes: row.passes, runs: row.runs, reason: 'non-blocking full tier' })
  }
  const registry = await readJSON(join(root, 'tests/acceptance/cases.json'))
  for (const item of registry.cases.filter(item => item.evidenceType !== 'automated' && item.id !== 'AC-46')) {
    if (!checks.some(row => row.caseId === item.id) && !full.some(row => row.caseId === item.id)) {
      knownIssues.push({ caseId: item.id, passes: 0, runs: 0, reason: 'not measured; full-tier evaluation deferred' })
    }
  }
  const output = { schemaVersion: 2, version: opts.release, candidate: opts.candidate,
    verdict: blocking.length ? 'failed' : pending.length || confirmation.size ? 'blocked' : 'passed',
    previous: previous?.version ?? null, blocking, knownIssues, pending, confirmation: [...confirmation],
    gatingSet, checks, carryover, hardBreakReportHash: hashBytes(canonicalJSON(report)), ledger: 'ledger.jsonl' }
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, `${opts.release}.json`), JSON.stringify(output, null, 2) + '\n')
  return output
}
