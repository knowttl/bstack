import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { emptyRepo, git, run } from './discovery-fixture.ts'

type Finding = { id: string; severity: string; file: string; action: string }
type Round = { round: number; findings: Finding[]; selected?: string[]; source?: string }
type Step = { name: string; ms: number; rounds: Round[] }
type Run = { id: string; status: string; branch: string; steps: Step[]; unreadable?: boolean }

const finding = (id: string, file: string, severity = 'error', action = 'auto-fix'): Finding => ({ id, severity, file, action })

async function fixture(t: import('node:test').TestContext, runs: Run[], { remote = true, store = true, gateId = 'abc123', subjects = ['feat: add', 'fix(core): repair', 'Revert "feat: add"'] } = {}) {
  const { directory, repo } = await emptyRepo(t)
  for (const subject of subjects) git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', subject)
  if (remote) git(repo, 'remote', 'add', 'no-mistakes', join(directory, 'nm', 'repos', `${gateId}.git`))
  const home = join(directory, 'nm')
  await mkdir(home, { recursive: true })
  if (store) {
    const database = new DatabaseSync(join(home, 'state.sqlite'))
    database.exec(`
      CREATE TABLE repos (id TEXT PRIMARY KEY, working_path TEXT, upstream_url TEXT);
      CREATE TABLE runs (id TEXT PRIMARY KEY, repo_id TEXT, branch TEXT, status TEXT, created_at INTEGER);
      CREATE TABLE step_results (id TEXT PRIMARY KEY, run_id TEXT, step_name TEXT, duration_ms INTEGER);
      CREATE TABLE step_rounds (id TEXT PRIMARY KEY, step_result_id TEXT, round INTEGER, findings_json TEXT, selected_finding_ids TEXT, selection_source TEXT);
      INSERT INTO repos VALUES ('abc123', '/work/demo', 'https://example.invalid/demo.git');
      INSERT INTO repos VALUES ('other', '/work/other', 'https://example.invalid/other.git');
      INSERT INTO runs VALUES ('foreign', 'other', 'main', 'completed', 1);
    `)
    let sequence = 0
    runs.forEach((entry, index) => {
      database.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?)').run(entry.id, 'abc123', entry.branch, entry.status, 1000 + index)
      for (const step of entry.steps) {
        const stepId = `step-${++sequence}`
        database.prepare('INSERT INTO step_results VALUES (?, ?, ?, ?)').run(stepId, entry.id, step.name, step.ms)
        for (const round of step.rounds) {
          database.prepare('INSERT INTO step_rounds VALUES (?, ?, ?, ?, ?, ?)').run(`round-${++sequence}`, stepId, round.round,
            entry.unreadable ? '{not json' : JSON.stringify({ findings: round.findings }), JSON.stringify(round.selected ?? []), round.source ?? null)
        }
      }
    })
    database.close()
  }
  return { repo, env: { ...process.env, NM_HOME: home }, store: join(home, 'state.sqlite') }
}

const history: Run[] = [
  { id: 'run-a', status: 'completed', branch: 'feat/a', steps: [
    { name: 'review', ms: 3000, rounds: [
      { round: 1, findings: [finding('R1', 'a.mjs'), finding('R2', 'b.mjs', 'warning', 'ask-user')], selected: ['R1'], source: 'auto_fix' },
      { round: 2, findings: [finding('R2', 'b.mjs', 'warning', 'ask-user'), finding('R3', 'a.mjs')], selected: ['R2', 'R3'], source: 'user' },
      { round: 3, findings: [finding('R4', 'c.mjs', 'warning', 'ask-user')], selected: [], source: 'user_declined' }
    ] },
    { name: 'test', ms: 500, rounds: [{ round: 1, findings: [] }] }
  ] },
  { id: 'run-b', status: 'failed', branch: 'feat/b', steps: [
    { name: 'review', ms: 1500, rounds: [{ round: 1, findings: [finding('R1', 'a.mjs')], selected: ['R1'], source: 'auto_fix' }] }
  ] }
]

test('history aggregates rounds, findings, hotspots, step time and Git counts for the linked repo only', async t => {
  const { repo, env, store } = await fixture(t, history)
  const before = createHash('sha256').update(await readFile(store)).digest('hex')
  const result = run('history', repo, env)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.problems, [])
  assert.deepEqual(result.data.repo, { id: 'abc123', workingPath: '/work/demo', upstreamUrl: 'https://example.invalid/demo.git' })
  assert.deepEqual({ total: result.data.runs.total, read: result.data.runs.read, byStatus: result.data.runs.byStatus }, { total: 2, read: 2, byStatus: { completed: 1, failed: 1 } })
  assert.deepEqual(result.data.runs.perRun, [
    { id: 'run-a', status: 'completed', branch: 'feat/a', reviewRounds: 3, findings: 4 },
    { id: 'run-b', status: 'failed', branch: 'feat/b', reviewRounds: 1, findings: 1 }
  ])
  assert.deepEqual(result.data.findings, {
    total: 5, bySeverity: { error: 3, warning: 2 }, byAction: { 'auto-fix': 3, 'ask-user': 2 }, byStep: { review: 5 },
    skipped: 1, firstRaisedFromRound2: 2, firstRaisedFromRound3: 1, lateRoundShare: { fromRound2: 0.4, fromRound3: 0.2 }
  })
  assert.deepEqual(result.data.hotspots, [{ file: 'a.mjs', runs: 2, findings: 3 }])
  assert.deepEqual(result.data.stepTime, [{ step: 'review', ms: 4500, share: 0.9 }, { step: 'test', ms: 500, share: 0.1 }])
  assert.deepEqual(result.data.git, { commits: 3, fixes: 1, reverts: 1 })
  assert.deepEqual(result.data.limitations, [])
  assert.equal(createHash('sha256').update(await readFile(store)).digest('hex'), before)
})

test('history leaves a run with unreadable findings out of every aggregate and names it', async t => {
  const { repo, env } = await fixture(t, [...history, { id: 'run-c', status: 'completed', branch: 'feat/c', unreadable: true, steps: [{ name: 'review', ms: 9000, rounds: [{ round: 1, findings: [] }] }] }])
  const result = run('history', repo, env)
  assert.equal(result.exit, 0)
  assert.deepEqual({ total: result.data.runs.total, read: result.data.runs.read }, { total: 3, read: 2 })
  assert.equal(result.data.findings.total, 5)
  assert.equal(result.data.stepTime[0].ms, 4500)
  assert.match(result.data.limitations[0], /run-c/)
})

for (const [name, options, reason] of [
  ['the repo has no no-mistakes remote', { remote: false }, /no no-mistakes remote/],
  ['the state store is absent', { store: false }, /No no-mistakes state store/],
  ['the store has no record for the linked repo', { gateId: 'missing' }, /no repo record missing/],
  ['the linked repo has no runs', {}, /repo record has no runs/]
] as const) {
  test(`history passes with a limitation when ${name}`, async t => {
    const { repo, env } = await fixture(t, [], options)
    const result = run('history', repo, env)
    assert.equal(result.exit, 0)
    assert.deepEqual(result.data.runs, { total: 0, read: 0 })
    assert.match(result.data.limitations.at(-1), reason)
    assert.equal(result.data.git.fixes, 1)
  })
}
