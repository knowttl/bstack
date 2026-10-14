import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, cp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

// Public commands run from another directory with literal Unicode and shell metacharacters.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack review 日本語 $; '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const workspace = join(directory, 'idea')
  const cache = join(directory, 'cache')
  await mkdir(workspace)
  const draft = '# Vision\nKeep household planning local.\n'
  const draftPath = join(directory, 'draft.md')
  const proposalsPath = join(directory, 'proposals.json')
  const revisedPath = join(directory, 'revised.md')
  const inputPath = join(directory, 'round.json')
  await writeFile(draftPath, draft)
  await writeFile(revisedPath, '# Vision\nKeep household planning local, including offline access.\n')
  const proposals = { schemaVersion: 1, draftRevision: createHash('sha256').update(draft).digest('hex'), project: 'Pantry', runNote: 'Author decisions',
    cards: [{ id: 'local', title: 'Cloud sync', body: 'Share household data through a server.', tests: 'Keep planning local.', why: 'Sharing is useful. A server changes the responsibility.' },
      { id: 'offline', title: 'Offline use', body: 'Work without network access.', tests: 'Keep planning local.', why: 'Reliable access adds storage responsibility.' }] }
  await writeFile(proposalsPath, JSON.stringify(proposals))
  const { NODE_TEST_CONTEXT, ...env } = process.env
  function command(subcommand, args, entry = join(root, 'skills/vision/scripts/vision.mjs'), target = workspace) {
    const result = spawnSync(process.execPath, [entry, 'vision-board', subcommand, '--workspace', target, '--json', ...args], {
      cwd: directory, encoding: 'utf8', env: { ...env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }
    })
    return { ...result, envelope: JSON.parse(result.stdout) }
  }
  const built = command('build', ['--draft', draftPath, '--proposals', proposalsPath])
  assert.equal(built.status, 0, built.stdout)
  const board = built.envelope.data
  const input = { schemaVersion: 1, runId: board.runId, draftRevision: board.draftRevision, complete: true,
    verdicts: [{ id: 'local', verdict: 'Off mission', notes: 'Keep household data local.' }, { id: 'offline', verdict: 'In vision', notes: 'Offline planning is part of local use.' }] }
  async function ingest(value = input, draft = revisedPath, selectedBoard = board.board) {
    await writeFile(inputPath, JSON.stringify(value))
    return command('verdicts', ['--board', selectedBoard, '--input', inputPath, '--draft', draft])
  }
  return { directory, workspace, cache, draft, draftPath, revisedPath, proposalsPath, proposals, board, input, command, ingest }
}

test('resumed review preserves previous drafts and decisions and refuses an old round on the revised board', async t => {
  const box = await setup(t)
  // A new process resumes an earlier build using its explicit board path.
  const accepted = await box.ingest()
  assert.equal(accepted.status, 0, accepted.stdout)
  const saved = accepted.envelope.data
  assert.notEqual(saved.scratch, box.board.scratch)
  assert.equal(await readFile(saved.previousDraft, 'utf8'), box.draft)
  assert.equal(await readFile(saved.draft, 'utf8'), await readFile(box.revisedPath, 'utf8'))
  assert.equal(saved.approval, 'pending-author-review')
  const review = JSON.parse(await readFile(saved.review, 'utf8'))
  assert.deepEqual(review.verdicts, box.input.verdicts)
  assert.equal(review.reviewedDraftRevision, box.board.draftRevision)
  await writeFile(box.proposalsPath, JSON.stringify({ ...box.proposals, draftRevision: saved.draftRevision }))
  const rebuilt = box.command('build', ['--draft', saved.draft, '--proposals', box.proposalsPath])
  assert.equal(rebuilt.status, 0, rebuilt.stdout)
  const stale = await box.ingest(box.input, box.revisedPath, rebuilt.envelope.data.board)
  assert.equal(stale.status, 1)
  assert.equal(stale.envelope.problems[0].code, 'stale-verdicts')
  assert.deepEqual(await readdir(box.workspace), [])
  assert.equal(await readFile(saved.previousDraft, 'utf8'), box.draft)
})

for (const [name, change, code] of [
  ['unknown card', value => { value.verdicts[0].id = 'unknown' }, 'card-mismatch'],
  ['duplicate card', value => { value.verdicts[1].id = 'local' }, 'duplicate-id'],
  ['missing card', value => { value.verdicts.pop() }, 'card-mismatch'],
  ['missing card ID', value => { delete value.verdicts[0].id }, 'missing-field'],
  ['blank card ID', value => { value.verdicts[0].id = ' ' }, 'missing-id'],
  ['different run', value => { value.runId = 'another-run' }, 'stale-verdicts'],
  ['different revision', value => { value.draftRevision = '0'.repeat(64) }, 'stale-verdicts'],
  ['unknown verdict', value => { value.verdicts[0].verdict = 'Approved' }, 'invalid-enum'],
  ['incomplete round', value => { value.complete = false }, 'invalid-const'],
  ['unknown field', value => { value.approved = true }, 'unknown-field']
]) {
  test(`verdict ingestion refuses ${name} without creating a new draft`, async t => {
    const box = await setup(t)
    const before = await readdir(dirname(box.board.scratch))
    change(box.input)
    const result = await box.ingest()
    assert.equal(result.status, 1, result.stdout)
    assert.ok(result.envelope.problems.some(problem => problem.code === code), result.stdout)
    assert.deepEqual(await readdir(dirname(box.board.scratch)), before)
    assert.equal(await readFile(join(box.board.scratch, 'draft.md'), 'utf8'), box.draft)
    assert.deepEqual(await readdir(box.workspace), [])
  })
}

for (const [name, bytes] of [['empty', ' \n'], ['invalid UTF-8', Buffer.from([0xc0, 0xaf])]]) {
  test(`verdict ingestion refuses an ${name} revised draft`, async t => {
    const box = await setup(t)
    await writeFile(box.revisedPath, bytes)
    const result = await box.ingest()
    assert.equal(result.status, 1)
    assert.equal(result.envelope.problems[0].code, 'invalid-draft')
  })
}

test('review refuses changed original draft bytes and another workspace', async t => {
  const box = await setup(t)
  await writeFile(join(box.board.scratch, 'draft.md'), box.draft + 'Changed.\n')
  const changed = await box.ingest()
  assert.equal(changed.status, 1)
  assert.equal(changed.envelope.problems[0].code, 'incompatible-board')
  await writeFile(join(box.board.scratch, 'draft.md'), box.draft)
  const second = join(box.directory, 'second')
  await mkdir(second)
  const wrong = box.command('launch', ['--board', box.board.board], undefined, second)
  assert.equal(wrong.status, 1)
  assert.equal(wrong.envelope.problems[0].code, 'incompatible-board')
})

test('launch reports a missing pinned runtime and preserves the draft for resume', async t => {
  const box = await setup(t)
  const installed = join(box.directory, 'installed')
  await cp(join(root, 'skills/vision'), installed, { recursive: true, filter: path => !path.split(/[/\\]/).includes('node_modules') })
  const result = box.command('launch', ['--board', box.board.board], join(installed, 'scripts/vision.mjs'))
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.envelope.problems[0].code, 'board-runtime-unavailable')
  assert.ok(result.envelope.problems[0].fix.includes('npm ci --omit=dev'))
  assert.equal(await readFile(join(box.board.scratch, 'draft.md'), 'utf8'), box.draft)
  assert.equal(JSON.parse(await readFile(join(box.board.scratch, 'launch.json'), 'utf8')).status, 'failed')
  assert.deepEqual(await readdir(box.workspace), [])
})

// The documented digest algorithm is implemented here independently of production.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
const sha256 = value => createHash('sha256').update(value).digest('hex')

test('the approved revision reaches the idea workspace only through apply', async t => {
  const box = await setup(t)
  const saved = (await box.ingest()).envelope.data
  const approved = await readFile(saved.draft, 'utf8')
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  findings.target = { mode: 'workspace', root: box.workspace, revision: null }
  findings.reviewedScope = ['VISION.md']
  Object.assign(findings.findings[0], { files: ['VISION.md'], scope: ['VISION.md'] })
  const plan = { schemaVersion: 1, target: findings.target, findings: 'findings.json', findingsDigest: sha256(canonical(findings)), selectedFindingIds: ['F-001'],
    reviewedScope: [{ path: 'VISION.md', resolvedPath: join(box.workspace, 'VISION.md') }],
    edits: [{ id: 'E-001', findingId: 'F-001', path: 'VISION.md', originalHash: null, proposedHash: sha256(approved), operation: 'create', payload: { content: approved }, proposedContent: approved }] }
  plan.planDigest = sha256(canonical(plan))
  const planFile = join(box.directory, 'plan.json')
  await writeFile(join(box.directory, 'findings.json'), JSON.stringify(findings))
  await writeFile(planFile, JSON.stringify(plan))
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const apply = (...flags) => spawnSync(process.execPath, [join(root, 'skills/vision/scripts/vision.mjs'), 'apply', '--workspace', box.workspace, '--plan', planFile, '--json', ...flags], {
    cwd: box.directory, encoding: 'utf8', env: { ...env, HOME: box.directory, USERPROFILE: box.directory, XDG_CACHE_HOME: box.cache, LOCALAPPDATA: box.cache }
  })
  const preview = apply('--dry-run')
  assert.equal(preview.status, 0, preview.stdout)
  assert.deepEqual(await readdir(box.workspace), [])
  const written = apply()
  assert.equal(written.status, 0, written.stdout)
  assert.equal(await readFile(join(box.workspace, 'VISION.md'), 'utf8'), approved)
})
