import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { resolveTarget } from '../lib/repo.mjs'
import { readGit } from '../lib/discovery.mjs'

const share = (part, whole) => whole ? Math.round(part / whole * 1000) / 1000 : 0
const count = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1 }

function parseList(json, key) {
  const value = json ? JSON.parse(json) : []
  const items = key ? value[key] ?? [] : value
  if (!Array.isArray(items)) throw new TypeError('Expected a list.')
  return items
}

export async function run(options) {
  const target = await resolveTarget(options)
  const inputs = { repo: target.root }
  const limitations = []
  const log = readGit(target.root, ['log', '--format=%s'])
  const subjects = log.status === 0 ? log.stdout.split('\n').filter(Boolean) : null
  if (!subjects) limitations.push('Git history is unreadable, so fix and revert counts are unavailable.')
  const git = subjects && {
    commits: subjects.length,
    fixes: subjects.filter(subject => /^fix(\([^)]*\))?!?:/i.test(subject)).length,
    reverts: subjects.filter(subject => /^revert\b/i.test(subject)).length
  }
  const store = join(process.env.NM_HOME ?? join(homedir(), '.no-mistakes'), 'state.sqlite')
  const noHistory = reason => ({ data: { root: target.root, store, runs: { total: 0, read: 0 }, git, limitations: [...limitations, reason] }, inputs })
  const gate = readGit(target.root, ['remote', 'get-url', 'no-mistakes'])
  if (gate.status !== 0) return noHistory('The repo has no no-mistakes remote, so no run history is linked to it.')
  const repoId = basename(gate.stdout.trim(), '.git')
  if (!existsSync(store)) return noHistory(`No no-mistakes state store exists at ${store}.`)

  const database = new DatabaseSync(store, { readOnly: true })
  try {
    database.exec('BEGIN')
    const repo = database.prepare('SELECT working_path, upstream_url FROM repos WHERE id = ?').get(repoId)
    if (!repo) return noHistory(`The state store has no repo record ${repoId}.`)
    const runs = database.prepare('SELECT id, status, branch, created_at FROM runs WHERE repo_id = ? ORDER BY created_at, id').all(repoId)
    if (!runs.length) return noHistory('The repo record has no runs.')
    const rounds = database.prepare(`SELECT sr.run_id, sr.step_name, r.round, r.findings_json, r.selected_finding_ids, r.selection_source
      FROM step_rounds r JOIN step_results sr ON sr.id = r.step_result_id JOIN runs ru ON ru.id = sr.run_id
      WHERE ru.repo_id = ? ORDER BY sr.run_id, sr.step_name, r.round`).all(repoId)
    const steps = database.prepare(`SELECT sr.run_id, sr.step_name, sr.duration_ms
      FROM step_results sr JOIN runs ru ON ru.id = sr.run_id WHERE ru.repo_id = ?`).all(repoId)
    database.exec('COMMIT')

    const unreadable = new Set()
    const reviewRounds = new Map()
    const found = new Map()
    for (const row of rounds) {
      let listed
      let selected
      try {
        listed = parseList(row.findings_json, 'findings')
        selected = parseList(row.selected_finding_ids)
      } catch {
        unreadable.add(row.run_id)
        continue
      }
      if (row.step_name === 'review') reviewRounds.set(row.run_id, Math.max(reviewRounds.get(row.run_id) ?? 0, row.round))
      const userDecided = row.selection_source === 'user' || row.selection_source === 'user_declined'
      for (const finding of listed) {
        const key = `${row.run_id}\0${row.step_name}\0${finding.id}`
        const entry = found.get(key) ?? { run: row.run_id, step: row.step_name, file: finding.file, severity: finding.severity, action: finding.action, firstRound: row.round, selected: false, declined: false }
        if (selected.includes(finding.id)) entry.selected = true
        else if (userDecided) entry.declined = true
        found.set(key, entry)
      }
    }
    if (unreadable.size) limitations.push(`${unreadable.size} runs have unreadable findings and are left out of every aggregate: ${[...unreadable].join(', ')}.`)

    const readRuns = runs.filter(entry => !unreadable.has(entry.id))
    const findings = [...found.values()].filter(entry => !unreadable.has(entry.run))
    const readSteps = steps.filter(step => !unreadable.has(step.run_id))
    const bySeverity = {}
    const byAction = {}
    const byStep = {}
    const byRun = {}
    const byFile = new Map()
    for (const finding of findings) {
      count(bySeverity, finding.severity)
      count(byAction, finding.action)
      count(byStep, finding.step)
      count(byRun, finding.run)
      if (!finding.file) continue
      const hotspot = byFile.get(finding.file) ?? { file: finding.file, runs: new Set(), findings: 0 }
      hotspot.runs.add(finding.run)
      hotspot.findings++
      byFile.set(finding.file, hotspot)
    }
    const fromRound2 = findings.filter(finding => finding.firstRound >= 2).length
    const fromRound3 = findings.filter(finding => finding.firstRound >= 3).length
    const stepMs = {}
    for (const step of readSteps) stepMs[step.step_name] = (stepMs[step.step_name] ?? 0) + (step.duration_ms ?? 0)
    const totalMs = Object.values(stepMs).reduce((sum, ms) => sum + ms, 0)
    const byStatus = {}
    for (const entry of readRuns) count(byStatus, entry.status)

    return {
      data: {
        root: target.root,
        store,
        repo: { id: repoId, workingPath: repo.working_path, upstreamUrl: repo.upstream_url },
        runs: {
          total: runs.length,
          read: readRuns.length,
          byStatus,
          firstAt: new Date(runs[0].created_at * 1000).toISOString(),
          lastAt: new Date(runs.at(-1).created_at * 1000).toISOString(),
          perRun: readRuns.map(entry => ({ id: entry.id, status: entry.status, branch: entry.branch, reviewRounds: reviewRounds.get(entry.id) ?? 0, findings: byRun[entry.id] ?? 0 }))
        },
        findings: {
          total: findings.length,
          bySeverity,
          byAction,
          byStep,
          skipped: findings.filter(finding => finding.declined && !finding.selected).length,
          firstRaisedFromRound2: fromRound2,
          firstRaisedFromRound3: fromRound3,
          lateRoundShare: { fromRound2: share(fromRound2, findings.length), fromRound3: share(fromRound3, findings.length) }
        },
        hotspots: [...byFile.values()].filter(hotspot => hotspot.runs.size >= 2)
          .map(hotspot => ({ file: hotspot.file, runs: hotspot.runs.size, findings: hotspot.findings }))
          .sort((a, b) => b.runs - a.runs || b.findings - a.findings || a.file.localeCompare(b.file)),
        stepTime: Object.entries(stepMs).map(([step, ms]) => ({ step, ms, share: share(ms, totalMs) })).sort((a, b) => b.ms - a.ms || a.step.localeCompare(b.step)),
        git,
        limitations
      },
      inputs
    }
  } finally {
    database.close()
  }
}
