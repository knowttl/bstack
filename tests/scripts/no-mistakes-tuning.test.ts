import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { emptyRepo, snapshot } from './discovery-fixture.ts'

// The skill is driven only through its installed entry point, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const skill = join(root, 'skills/no-mistakes-tuning')
const entry = join(skill, 'scripts/no-mistakes-tuning.mjs')
// The gate config is the only file this skill may write.
const config = '.no-mistakes.yaml'
function hash(value: string | null) { return value === null ? null : createHash('sha256').update(value).digest('hex') }
// The documented digest algorithm is implemented here independently of production.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)!
}

function tuning(directory: string, args: readonly string[]) {
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

// Writes the findings and change set an agent records in scratch after the user approves the exact bytes.
async function approvedPlan(directory: string, repo: string, original: string | null, proposed: string) {
  const target = { mode: 'repo', root: repo, revision: null }
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  Object.assign(findings, { target, reviewedScope: [config], requiredOutcomes: ['starting-checks'] })
  Object.assign(findings.findings[0], { scope: [config], files: [config] })
  await writeFile(join(directory, 'findings.json'), JSON.stringify(findings))
  const plan = {
    schemaVersion: 1, target, findings: 'findings.json', findingsDigest: hash(canonical(findings)), selectedFindingIds: ['F-001'],
    reviewedScope: [{ path: config, resolvedPath: join(repo, config) }],
    edits: [{ id: 'E-1', findingId: 'F-001', path: config, originalHash: hash(original), proposedHash: hash(proposed),
      operation: original === null ? 'create' : 'replace-file', payload: { content: proposed }, proposedContent: proposed }],
    planDigest: ''
  }
  const { planDigest, ...reviewed } = plan
  plan.planDigest = hash(canonical(reviewed))!
  const file = join(directory, `plan-${plan.planDigest}.json`)
  await writeFile(file, JSON.stringify(plan))
  return file
}

test('no-mistakes-tuning declares explicit-only invocation metadata and ships only apply and state show', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  assert.equal(parse(document.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1])['disable-model-invocation'], true)
  assert.equal(parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8')).policy.allow_implicit_invocation, false)
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.deepEqual(help.stdout.match(/^ {2}\S.*$/gm)!.map(line => line.trim()).sort(), ['apply', 'state show'])
})

test('apply creates the approved gate config and then replaces it, writing nothing else and nothing on a dry run', async t => {
  const { directory, repo } = await emptyRepo(t)
  const first = 'commands:\n  test: npm test\n'
  const second = `${first}auto_fix:\n  review: 2\nignore_patterns:\n  - ".gitignore"\n`

  const before = await snapshot(repo)
  const createPlan = await approvedPlan(directory, repo, null, first)
  assert.equal(tuning(directory, ['apply', '--repo', repo, '--plan', createPlan, '--dry-run']).exit, 0)
  assert.deepEqual(await snapshot(repo), before)
  const created = tuning(directory, ['apply', '--repo', repo, '--plan', createPlan])
  assert.equal(created.exit, 0, JSON.stringify(created))
  assert.deepEqual(await snapshot(repo), { ...before, [config]: hash(first) })

  const replacePlan = await approvedPlan(directory, repo, first, second)
  const replaced = tuning(directory, ['apply', '--repo', repo, '--plan', replacePlan])
  assert.equal(replaced.exit, 0, JSON.stringify(replaced))
  assert.deepEqual(await snapshot(repo), { ...before, [config]: hash(second) })
  assert.equal(tuning(directory, ['state', 'show', '--repo', repo, '--run', replaced.data.runId]).exit, 0)
})
