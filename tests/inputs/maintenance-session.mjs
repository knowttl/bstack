import assert from 'node:assert/strict'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

// This deterministic host fixture exercises real commands, not model judgement.
export async function maintenanceSession() {
  const repo = process.cwd()
  const skill = join(process.env.HOME, '.agents/skills/repo-audit')
  const helper = join(skill, 'scripts/repo-audit.mjs')
  const assessmentPath = '.bstack/assessment.json'
  const source = 'packages/core/internal/database.ts'
  const events = []
  function command(executable, args, expected = 0, env = process.env) {
    const result = spawnSync(executable, args, { cwd: repo, env, encoding: 'utf8' })
    assert.equal(result.status, expected, result.stdout + result.stderr)
    events.push({ type: 'item.completed', item: { type: 'command_execution', command: [executable, ...args].join(' '),
      exit_code: result.status, aggregated_output: result.stdout + result.stderr } })
    return result.stdout
  }
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  function commit() {
    git('add', '.bstack', source)
    git('commit', '-qm', 'maintenance fixture')
    return git('rev-parse', 'HEAD')
  }
  const invoke = (name, args) => JSON.parse(command(process.execPath, [helper, ...name.split(' '), '--repo', repo, ...args, '--json']))
  await readFile(join(skill, 'references/maintenance-contract.md'), 'utf8')
  // Prepare an already selected narrow contract before starting routine maintenance.
  await mkdir(join(repo, '.bstack/bin'), { recursive: true })
  await cp(join(skill, 'scripts/bstack-check.mjs'), join(repo, '.bstack/bin/bstack-check.mjs'))
  const contract = { schemaVersion: 1,
    documents: [{ id: 'design', path: 'DESIGN.md' }],
    scopes: [{ id: 'pricing', paths: ['packages/core/**'], documentIds: ['design'], ruleIds: ['price'] }],
    rules: [{ id: 'price', path: 'DESIGN.md', pointer: 'The agreed checkout total is 10.', checkIds: ['units'] }],
    checks: [{ id: 'units', command: { executable: 'node', args: ['--test', 'unit.test.mjs'], cwd: '.', versionArgs: ['--version'] },
      inputScopes: ['packages/**', 'unit.test.mjs', 'package.json'] }], generators: [],
    acceptanceSources: [{ id: 'checkout', path: 'DESIGN.md', pointer: 'The agreed checkout total is 10.' }] }
  await writeFile(join(repo, '.bstack/project.json'), JSON.stringify(contract))
  const base = commit()
  const original = await readFile(join(repo, source), 'utf8')
  await writeFile(join(repo, source), original.replace('return 12 }', 'const unitPrice = 12; return unitPrice }'))
  commit()
  const collected = invoke('evidence collect', ['--base', base, '--portable', assessmentPath])
  const assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
  assessment.coverage = ['price']
  for (const entry of assessment.documents) entry.assessment = {
    result: 'no-impact', changedBehavior: 'price now names the intermediate unitPrice and still returns 12.',
    changedPaths: [source], reason: 'The checkout acceptance remains total 10. This internal refactor preserves the existing mismatch at 12; it does not authorise changing that requirement or claim to fix the journey.',
    citations: [{ path: 'DESIGN.md', pointer: 'The agreed checkout total is 10.', version: 'base' }], dependentWork: [] }
  assert.deepEqual(assessment.unmappedPaths, [])
  const save = () => writeFile(join(repo, assessmentPath), JSON.stringify(assessment, null, 2) + '\n')
  await save()
  const bound = JSON.parse(command(process.execPath, [helper, 'evidence', 'validate', '--repo', repo,
    '--base', base, '--assessment', join(repo, assessmentPath), '--json'], 2))
  assert.deepEqual(bound.problems.map(problem => problem.code).sort(), ['required-check-missing', 'stale-review'])
  assessment.fingerprint = bound.data.fingerprint
  await save()
  commit()
  const checker = join(repo, '.bstack/bin/bstack-check.mjs')
  const args = ['--repo', repo, '--base', base, '--assessment', join(repo, assessmentPath), '--json']
  const local = JSON.parse(command(process.execPath, [checker, ...args]))
  const clone = join(process.env.XDG_CACHE_HOME, 'clean-shop')
  command('git', ['clone', '-q', '--no-local', repo, clone])
  const home = join(process.env.XDG_CACHE_HOME, 'clean-home')
  const cache = join(process.env.XDG_CACHE_HOME, 'clean-cache')
  await mkdir(home)
  await mkdir(cache)
  const cleanEnv = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'),
    XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }
  const clean = JSON.parse(command(process.execPath, [join(clone, '.bstack/bin/bstack-check.mjs'),
    '--repo', clone, '--base', base, '--assessment', join(clone, assessmentPath), '--json'], 0, cleanEnv))
  assert.equal(clean.data.fingerprint, local.data.fingerprint)
  assert.deepEqual(clean.data.checks.map(record => record.execution.exitCode), [0])
  assert.equal(git('diff', '--stat', 'HEAD'), '')
  assert.equal(await readFile(join(repo, 'DESIGN.md'), 'utf8'), '# Shop design\n\nThe UI never touches storage.\nThe agreed checkout total is 10.\n')
  command(process.execPath, ['journey.mjs'], 1)
  events.push({ type: 'item.completed', item: { type: 'agent_message', text:
    'Fake-only bounded maintenance complete: reviewed no-impact, local and different-root standalone checks passed with fresh units. Existing checkout journey remains failed (expected 10, actual 12); overall product readiness is withheld. No goal interview or full audit was performed.' } })
  return events
}
