import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { root, text, object, array, readJSON, checkRegistry, fail, verifiedExecution } from './evaluation.mjs'
import { scopeVersion } from './evaluation-scope.mjs'
import { readAdapter } from './evaluation-host.mjs'
import { correctedScore, validateScore } from './evaluation-scoring.mjs'
import { validateData } from '../../skills/repo-audit/scripts/lib/schema.mjs'
import { hashBytes, canonicalJSON } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

// AC-64 explicitly tests extension using only the resulting target guidance.
const withoutOnly = 'final-independent-extension'

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) fail(`Release evidence source check failed: git ${args.join(' ')}`)
  return result.stdout.trim()
}

export async function completeRelease(results) {
  const registryPath = join(root, 'tests/acceptance/cases.json')
  const registry = await readJSON(registryPath)
  const manifest = await readJSON(join(results, 'release/manifest.json'))
  validateData(object({ schemaVersion: { const: 1 },
    cases: array(object({ caseId: text, runId: text })),
    comparisons: array(object({ scenario: text, without: text, with: text })) }), manifest)
  const definitions = (await readJSON(join(root, 'tests/eval/scenarios/scenarios.json'))).scenarios
  const expected = registry.cases.filter(item => item.evidenceType !== 'automated' && item.id !== 'AC-46')
  if (new Set(manifest.cases.map(item => item.caseId)).size !== manifest.cases.length) fail('Duplicate final acceptance selection.')
  if (manifest.cases.length !== expected.length || expected.some(item => !manifest.cases.some(row => row.caseId === item.id))) fail('Select exactly one final run for every agent or manual acceptance case.')
  const paired = definitions.filter(item => item.id !== withoutOnly)
  if (new Set(manifest.comparisons.map(item => item.scenario)).size !== manifest.comparisons.length) fail('Duplicate final scenario comparison.')
  if (manifest.comparisons.length !== paired.length || paired.some(item => !manifest.comparisons.some(row => row.scenario === item.id))) fail('Every scenario requires its final comparison, except the without-only independent extension.')
  const incomplete = registry.cases.filter(item => item.procedure.status !== 'completed').map(item => item.id)
  if (incomplete.length) fail(`Incomplete acceptance procedures: ${incomplete.join(', ')}`)
  const revision = git('rev-parse', 'HEAD')
  const fixtureRevision = git('rev-parse', 'HEAD:tests/fixtures')
  const cache = new Map()
  async function run(id) {
    if (cache.has(id)) return cache.get(id)
    if (!/^[\dTZ.-]+-[0-9a-f-]{36}$/.test(id)) fail('Invalid release run ID.')
    const directory = join(results, 'release/runs', id)
    const recordBytes = await readFile(join(directory, 'run.json'))
    const record = await correctedScore(directory, JSON.parse(recordBytes))
    // The approved scope rerun retains this exact successful baseline; its
    // fixture, criteria, request and toolchain still undergo the usual checks.
    const approvedBaseline = id === '2026-10-11T19-10-46.903Z-8014183b-8ca5-4060-b239-5c8f9c176a89' &&
      hashBytes(recordBytes) === '4930d2928e98e6d162fbb8052d2884be0d7d40c5994a453b17b6b60cc42a732a'
    const definition = definitions.find(item => item.id === record.scenario?.id)
    if (!definition || record.id !== id || canonicalJSON(definition) !== canonicalJSON(record.scenario) ||
        record.criteriaHash !== hashBytes(canonicalJSON(definition.checks)) || record.stage !== definition.checkpoints.at(-1) ||
        record.fixture?.revision !== fixtureRevision) fail(`Stale scenario, stage, scoring criteria or fixture: ${id}`)
    const adapter = await readAdapter(join(root, 'tests/eval/adapters/codex-final.json'), definition.id)
    if (canonicalJSON(record.adapter) !== canonicalJSON(adapter) || record.adapterHash !== hashBytes(canonicalJSON(adapter)) ||
        record.agent !== adapter.invocation.agent || record.model !== adapter.invocation.model ||
        record.hostFailure || !record.isolation?.verified || !record.isolation.cleanedAt ||
        ![2, scopeVersion].includes(record.scopeGuard?.version) || !verifiedExecution(record) || (!record.execution && !approvedBaseline) ||
        !record.turns?.length || record.turns.some(turn => !turn.sessionId) || !record.transcript || !record.answers) fail(`Unverified or unscored release run: ${id}`)
    git('merge-base', '--is-ancestor', record.sourceRevision, 'HEAD')
    const request = (record.mode === 'with' && definition.invocation === 'explicit' ? `${adapter.invocation.explicit}\n` : '') +
      (['foundation', 'final'].includes(record.stage) ? `Active checkpoint: ${record.stage}.\n` : '') + definition.request
    if (record.request !== request || record.turns[0].message !== request ||
        record.turns.slice(1).some((turn, index) => turn.message !== definition.answers[index])) fail(`Changed agent request or scripted answers: ${id}`)
    // Grader repairs do not change a captured agent's inputs.
    git('diff', '--quiet', record.sourceRevision, '--', 'skills/repo-audit', 'install', 'tests/fixtures',
      'tests/eval/adapters')
    if (!approvedBaseline) {
      git('diff', '--quiet', record.sourceRevision, '--', 'scripts/lib/evaluation-host.mjs',
        'scripts/lib/evaluation-container.mjs', 'tests/eval/container')
      if (record.execution.recipeHash !== hashBytes(await readFile(join(root, 'tests/eval/container/Dockerfile')))) fail(`Changed evaluation container recipe: ${id}`)
    }
    if (record.tools.node !== process.version) fail(`Node version changed: ${id}`)
    const version = spawnSync(record.adapter.executable, record.adapter.versionArgs, { cwd: root, encoding: 'utf8' })
    if (version.status !== 0 || version.stdout.trim() !== record.tools.agent) fail(`Agent tool version changed: ${id}`)
    const transcript = await readFile(resolve(directory, record.transcript), 'utf8')
    const conversation = await readFile(join(directory, record.conversation), 'utf8')
    const answers = record.scoreCorrection ? { runId: record.id, reviewer: record.scoreCorrection.corrector,
      checks: record.scoreCorrection.checks } : await readJSON(resolve(directory, record.answers))
    validateScore(record, answers, transcript)
    if (!transcript.trim() || transcript !== conversation || record.conversationHash !== hashBytes(transcript) ||
        answers.runId !== id || !answers.reviewer?.trim() || answers.checks.length !== definition.checks.length || record.caseResults.length !== definition.checks.length) fail(`Invalid retained scoring artifacts: ${id}`)
    const lines = transcript.trimEnd().split(/\r?\n/).length
    for (const check of definition.checks) {
      const scored = record.caseResults.filter(item => item.id === check.id)
      const answered = answers.checks.filter(item => item.id === check.id)
      if (scored.length !== 1 || answered.length !== 1 || scored[0].caseId !== check.caseId || scored[0].scoring !== 'human' ||
          typeof answered[0].passed !== 'boolean' || ['passed', 'startLine', 'endLine'].some(key => scored[0][key] !== answered[0][key]) ||
          answered[0].startLine < 1 || answered[0].endLine < answered[0].startLine || answered[0].endLine > lines) fail(`Unsupported scored claim: ${id}/${check.id}`)
    }
    cache.set(id, record)
    return record
  }
  for (const selection of manifest.cases) {
    const entry = expected.find(item => item.id === selection.caseId)
    const record = await run(selection.runId)
    const checks = record.caseResults.filter(check => check.caseId === selection.caseId)
    if (record.scenario.id !== entry.procedure.name || record.mode !== (record.scenario.id === withoutOnly ? 'without' : 'with') ||
        !checks.length || checks.some(check => !check.passed)) fail(`No passing final case evidence: ${selection.caseId}`)
    if (record.scenario.id !== withoutOnly && !manifest.comparisons.some(comparison => comparison.with === selection.runId && comparison.scenario === record.scenario.id)) fail(`Selected case is outside its final scenario pair: ${selection.caseId}`)
  }
  for (const comparison of manifest.comparisons) {
    const before = await run(comparison.without)
    const after = await run(comparison.with)
    if (before.scenario.id !== comparison.scenario || after.scenario.id !== comparison.scenario ||
        !after.caseResults.every(check => check.passed) || canonicalJSON(before.tools) !== canonicalJSON(after.tools) || before.os !== after.os) fail(`Invalid final scenario pair: ${comparison.scenario}`)
    const result = spawnSync(process.execPath, [join(root, 'scripts/eval.mjs'), 'compare', '--without', comparison.without,
      '--with', comparison.with, '--results', join(results, 'release/runs'), '--json'], { cwd: root, encoding: 'utf8' })
    if (result.status !== 0 || JSON.parse(result.stdout).status !== 'passed') fail(`Scenario does not meet the design pass rule: ${comparison.scenario}`)
  }
  // Execute the registry's exact named automated procedures on the current inputs.
  const checked = await checkRegistry(registryPath)
  if (checked.planned) fail('Release acceptance still contains planned procedures.')
  if (process.platform !== 'linux') fail('AC-74 requires real Linux lifecycle execution under R27.')
  return { sourceRevision: revision, passed: registry.cases.length, total: registry.cases.length,
    automated: registry.cases.filter(item => item.evidenceType === 'automated').map(item => ({
      caseId: item.id, suite: item.procedure.path, test: item.procedure.name })),
    selected: manifest.cases, comparisons: manifest.comparisons, withoutOnly }
}
