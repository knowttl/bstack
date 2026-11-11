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
const skill = join(root, 'skills/readme')
const entry = join(skill, 'scripts/readme.mjs')
function hash(value: string | null) { return value === null ? null : createHash('sha256').update(value).digest('hex') }
// The documented digest algorithm is implemented here independently of production.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)!
}

function readme(directory: string, args: readonly string[]) {
  const env = { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const result = spawnSync(process.execPath, [entry, ...args, '--json'], { encoding: 'utf8', env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

// Writes the findings and change set an agent records in scratch after the author approves the exact bytes.
async function approvedPlan(directory: string, repo: string, original: string | null, proposed: string) {
  const target = { mode: 'repo', root: repo, revision: null }
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  Object.assign(findings, { target, reviewedScope: ['README.md'], requiredOutcomes: ['starting-checks'] })
  Object.assign(findings.findings[0], { scope: ['README.md'], files: ['README.md'] })
  await writeFile(join(directory, 'findings.json'), JSON.stringify(findings))
  const plan = {
    schemaVersion: 1, target, findings: 'findings.json', findingsDigest: hash(canonical(findings)), selectedFindingIds: ['F-001'],
    reviewedScope: [{ path: 'README.md', resolvedPath: join(repo, 'README.md') }],
    edits: [{ id: 'E-1', findingId: 'F-001', path: 'README.md', originalHash: hash(original), proposedHash: hash(proposed),
      operation: original === null ? 'create' : 'replace-file', payload: { content: proposed }, proposedContent: proposed }],
    planDigest: ''
  }
  const { planDigest, ...reviewed } = plan
  plan.planDigest = hash(canonical(reviewed))!
  const file = join(directory, `plan-${plan.planDigest}.json`)
  await writeFile(file, JSON.stringify(plan))
  return file
}

test('readme ships only apply, state show and cite-check', async () => {
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.deepEqual(help.stdout.match(/^ {2}\S.*$/gm)!.map(line => line.trim()).sort(), ['apply', 'cite-check', 'state show'])
})

test('apply creates the approved README and then replaces it, writing nothing else and nothing on a dry run', async t => {
  const { directory, repo } = await emptyRepo(t)
  const first = '# greeter\n\nGreet people from the command line.\n'
  const second = `${first}\n## Install\n\n\`\`\`bash\nnpm install -g greeter\n\`\`\`\n`

  const before = await snapshot(repo)
  const createPlan = await approvedPlan(directory, repo, null, first)
  assert.equal(readme(directory, ['apply', '--repo', repo, '--plan', createPlan, '--dry-run']).exit, 0)
  assert.deepEqual(await snapshot(repo), before)
  const created = readme(directory, ['apply', '--repo', repo, '--plan', createPlan])
  assert.equal(created.exit, 0, JSON.stringify(created))
  assert.deepEqual(await snapshot(repo), { ...before, 'README.md': hash(first) })

  const replacePlan = await approvedPlan(directory, repo, first, second)
  const replaced = readme(directory, ['apply', '--repo', repo, '--plan', replacePlan])
  assert.equal(replaced.exit, 0, JSON.stringify(replaced))
  assert.deepEqual(await snapshot(repo), { ...before, 'README.md': hash(second) })
  assert.equal(readme(directory, ['state', 'show', '--repo', repo, '--run', replaced.data.runId]).exit, 0)
})
