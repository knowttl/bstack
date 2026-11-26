import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { resolveTarget } from '../lib/repo.ts'
import { createScratch } from '../lib/scratch.ts'
import { readGit } from '../lib/discovery.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn } from '../lib/result.ts'

const share = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 1000 : 0
const count = (counts: Record<string, number>, key: string) => { counts[key] = (counts[key] ?? 0) + 1 }

function parseList(json: string | null, key?: string) {
  const value = json ? JSON.parse(json) : []
  const items = key ? value[key] ?? [] : value
  if (!Array.isArray(items)) throw new TypeError('Expected a list.')
  return items
}

function currentPaths(root: string) {
  const tree = readGit(root, ['ls-tree', '-r', '-z', '--name-only', 'HEAD'])
  const log = readGit(root, ['log', '--first-parent', '--diff-merges=first-parent', '--find-renames=50%', '--name-status', '-z', '--format=%x01', 'HEAD'])
  const current = new Map()
  if (tree.status !== 0 || log.status !== 0) return current
  for (const path of tree.stdout.split('\0').filter(Boolean)) current.set(path, path)
  const active = new Map(current)
  for (const commit of log.stdout.split('\x01')) {
    const tokens = commit.split('\0').map(token => token.trim()).filter(Boolean)
    const ended = []
    const renamed = []
    for (let index = 0; index < tokens.length; index++) {
      const status = tokens[index][0]
      const path = tokens[++index]
      if (status === 'A') ended.push(path)
      if (status !== 'R') continue
      const destination = tokens[++index]
      ended.push(destination)
      if (active.has(destination)) renamed.push([path, active.get(destination)])
    }
    for (const path of ended) active.delete(path)
    for (const [path, file] of renamed) {
      active.set(path, file)
      if (!current.has(path)) current.set(path, file)
    }
  }
  return current
}

export async function run(options: Options<'export-findings'>) {
  const target = await resolveTarget(options)
  const inputs = { repo: target.root }
  const limitations: string[] = []
  const log = readGit(target.root, ['log', '--format=%s'])
  const subjects = log.status === 0 ? log.stdout.split('\n').filter(Boolean) : null
  if (!subjects) limitations.push('Git history is unreadable, so fix and revert counts are unavailable.')
  const git = subjects && {
    commits: subjects.length,
    fixes: subjects.filter(subject => /^fix(\([^)]*\))?!?:/i.test(subject)).length,
    reverts: subjects.filter(subject => /^revert\b/i.test(subject)).length
  }
  const store = join(process.env.NM_HOME ?? join(homedir(), '.no-mistakes'), 'state.sqlite')
  const noHistory = (reason: string) => ({ data: { root: target.root, store, runs: { total: 0, read: 0 }, git, limitations: [...limitations, reason] }, inputs } satisfies CommandReturn)
  const gate = readGit(target.root, ['remote', 'get-url', 'no-mistakes'])
  if (gate.status !== 0) return noHistory('The repo has no no-mistakes remote, so no run history is linked to it.')
  const repoId = basename(gate.stdout.trim(), '.git')
  if (!existsSync(store)) return noHistory(`No no-mistakes state store exists at ${store}.`)

  const { DatabaseSync } = await import('node:sqlite')
  const database = new DatabaseSync(store, { readOnly: true })
  try {
    database.exec('BEGIN')
    const repo = database.prepare('SELECT working_path, upstream_url FROM repos WHERE id = ?').get(repoId) as { working_path: string; upstream_url: string } | undefined
    if (!repo) return noHistory(`The state store has no repo record ${repoId}.`)
    const runs = database.prepare('SELECT id, status, branch, created_at FROM runs WHERE repo_id = ? ORDER BY created_at, id').all(repoId) as { id: string; status: string; branch: string; created_at: number }[]
    if (!runs.length) return noHistory('The repo record has no runs.')
    const rounds = database.prepare(`SELECT sr.run_id, sr.step_name, r.round, r.findings_json, r.selected_finding_ids, r.selection_source
      FROM step_rounds r JOIN step_results sr ON sr.id = r.step_result_id JOIN runs ru ON ru.id = sr.run_id
      WHERE ru.repo_id = ? ORDER BY sr.run_id, sr.step_name, r.round`).all(repoId) as { run_id: string; step_name: string; round: number; findings_json: string | null; selected_finding_ids: string | null; selection_source: string | null }[]
    const steps = database.prepare(`SELECT sr.run_id, sr.step_name, sr.duration_ms
      FROM step_results sr JOIN runs ru ON ru.id = sr.run_id WHERE ru.repo_id = ?`).all(repoId) as { run_id: string; step_name: string; duration_ms: number | null }[]
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
        const entry = found.get(key) ?? { run: row.run_id, step: row.step_name, id: finding.id, file: finding.file, text: finding.description, severity: finding.severity, action: finding.action, firstRound: row.round, selected: false, declined: false }
        if (selected.includes(finding.id)) entry.selected = true
        else if (userDecided) entry.declined = true
        found.set(key, entry)
      }
    }
    if (unreadable.size) limitations.push(`${unreadable.size} runs have unreadable findings and are left out of every aggregate: ${[...unreadable].join(', ')}.`)

    const readRuns = runs.filter(entry => !unreadable.has(entry.id))
    const findings = [...found.values()].filter(entry => !unreadable.has(entry.run))
    const readSteps = steps.filter(step => !unreadable.has(step.run_id))
    const bySeverity: Record<string, number> = {}
    const byAction: Record<string, number> = {}
    const byStep: Record<string, number> = {}
    const byRun: Record<string, number> = {}
    const byFile = new Map()
    const current = currentPaths(target.root)
    const absent = new Set()
    for (const finding of findings) {
      count(bySeverity, finding.severity)
      count(byAction, finding.action)
      count(byStep, finding.step)
      count(byRun, finding.run)
      if (!finding.file) continue
      finding.recordedFile = finding.file
      finding.atHead = current.has(finding.file)
      if (finding.atHead) finding.file = current.get(finding.file)
      else absent.add(finding.file)
      const hotspot = byFile.get(finding.file) ?? { file: finding.file, recordedPaths: new Set(), atHead: finding.atHead, runs: new Set(), findings: 0 }
      hotspot.recordedPaths.add(finding.recordedFile)
      hotspot.runs.add(finding.run)
      hotspot.findings++
      byFile.set(finding.file, hotspot)
    }
    if (absent.size) limitations.push(`${absent.size} finding paths are not files at HEAD and no rename leads from them to one, so they keep their recorded path with atHead false: ${[...absent].sort().join(', ')}. Renames are followed along the first-parent history of HEAD at Git 50% similarity, so a deleted file, an undetected rename or unreadable history all leave a path unmapped.`)
    let findingsExport
    if (options['export-findings']) {
      const path = join(await createScratch(target), 'findings.json')
      await writeFile(path, JSON.stringify(findings.map(finding => ({ run: finding.run, step: finding.step, round: finding.firstRound, id: finding.id, file: finding.file ?? null,
        recordedFile: finding.recordedFile ?? null, atHead: finding.atHead ?? null, text: finding.text ?? null })), null, 2) + '\n', { flag: 'wx' })
      findingsExport = { path, count: findings.length }
    }
    const fromRound2 = findings.filter(finding => finding.firstRound >= 2).length
    const fromRound3 = findings.filter(finding => finding.firstRound >= 3).length
    const stepMs: Record<string, number> = {}
    for (const step of readSteps) stepMs[step.step_name] = (stepMs[step.step_name] ?? 0) + (step.duration_ms ?? 0)
    const totalMs = Object.values(stepMs).reduce((sum, ms) => sum + ms, 0)
    const byStatus: Record<string, number> = {}
    for (const entry of readRuns) count(byStatus, entry.status)
    const multiRoundRuns = readRuns.filter(entry => (reviewRounds.get(entry.id) ?? 0) >= 2).length

    return {
      data: {
        root: target.root,
        store,
        repo: { id: repoId, workingPath: repo.working_path, upstreamUrl: repo.upstream_url },
        runs: {
          total: runs.length,
          read: readRuns.length,
          byStatus,
          multiRoundRuns,
          reworkRate: share(multiRoundRuns, readRuns.length),
          firstAt: new Date(runs[0].created_at * 1000).toISOString(),
          lastAt: new Date(runs.at(-1)!.created_at * 1000).toISOString(),
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
          .map(hotspot => ({ file: hotspot.file, recordedPaths: [...hotspot.recordedPaths].sort(), atHead: hotspot.atHead, runs: hotspot.runs.size, findings: hotspot.findings }))
          .sort((a, b) => b.runs - a.runs || b.findings - a.findings || a.file.localeCompare(b.file)),
        stepTime: Object.entries(stepMs).map(([step, ms]) => ({ step, ms, share: share(ms, totalMs) })).sort((a, b) => b.ms - a.ms || a.step.localeCompare(b.step)),
        git,
        ...(findingsExport ? { findingsExport } : {}),
        limitations
      },
      inputs
    } satisfies CommandReturn
  } finally {
    database.close()
  }
}
