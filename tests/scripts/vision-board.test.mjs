import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'

// Exercise the installed command from a different working directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Include both context delimiters and template-like content in every user-controlled field.
const text = '"quotes" \'apostrophe\' `backticks` ${globalThis.injected=true} <script>bad</script> & 日本語 {{PROJECT}} \u2028\u2029'

async function setup(t, draft = '# Vision\n' + text + '\n') {
  const directory = await mkdtemp(join(tmpdir(), 'bstack board 日本語 $; '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const target = join(directory, 'target')
  const cache = join(directory, 'cache')
  await mkdir(target)
  const draftPath = join(directory, 'draft.md')
  const proposalsPath = join(directory, 'proposals.json')
  await writeFile(draftPath, draft)
  const proposals = { schemaVersion: 1, draftRevision: createHash('sha256').update(draft).digest('hex'), project: text, runNote: text,
    cards: [{ id: text, title: text, body: text, tests: text, why: text }, { id: 'vision-round-complete', title: 'Second', body: 'Change', tests: 'Principle', why: 'Both sides' }] }
  async function run(data = proposals, args = []) {
    await writeFile(proposalsPath, JSON.stringify(data))
    const { NODE_TEST_CONTEXT, ...env } = process.env
    const result = spawnSync(process.execPath, [join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), 'vision-board', 'build',
      '--workspace', target, '--draft', draftPath, '--proposals', proposalsPath, '--json', ...args], {
      cwd: directory, encoding: 'utf8', env: { ...env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }
    })
    return { ...result, envelope: JSON.parse(result.stdout) }
  }
  return { directory, target, cache, draft, proposals, run }
}

function render(board) {
  const elements = new Map()
  const queued = []
  const timers = []
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', hidden: false, dataset: {}, classList: {
      contains: () => false, add() {}
    }, querySelector: selector => selector === '.vr-reason' ? { value: text } : { textContent: 'Conditional' } })
    return elements.get(id)
  } }
  const context = { document, window: { lavish: { queuePrompt: (...args) => queued.push(args), sendQueuedPrompts() {} } }, setTimeout: fn => timers.push(fn) }
  const scripts = [...board.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length, 1)
  runInNewContext(scripts[0][1], context)
  return { elements, queued, context, timers }
}

test('board build renders escaped text and preserves raw revision-bound verdict data', async t => {
  const box = await setup(t)
  const result = await box.run()
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const output = result.envelope.data
  assert.deepEqual(await readdir(box.target), [])
  assert.equal(await readFile(join(output.scratch, 'draft.md'), 'utf8'), box.draft)
  assert.deepEqual(JSON.parse(await readFile(join(output.scratch, 'proposals.json'), 'utf8')), box.proposals)
  const metadata = JSON.parse(await readFile(join(output.scratch, 'board.json'), 'utf8'))
  assert.equal(metadata.runId, output.runId)
  assert.equal(metadata.draftRevision, box.proposals.draftRevision)
  assert.deepEqual(metadata.cardIds, box.proposals.cards.map(card => card.id))
  const board = await readFile(output.board, 'utf8')
  assert.ok(board.match(/<title>([\s\S]*?)<\/title>/)[1].startsWith('/vision review - '))
  assert.ok(board.includes('&lt;script&gt;bad&lt;/script&gt;'))
  assert.ok(board.includes('&quot;quotes&quot;'))
  const view = render(board)
  assert.equal(view.context.injected, undefined)
  const stack = view.elements.get('vr-stack').innerHTML
  assert.ok(stack.includes('&lt;script&gt;bad&lt;/script&gt;'))
  assert.ok(stack.includes('&amp; 日本語 {{PROJECT}}'))
  assert.ok(!stack.includes('<script>bad'))
  assert.ok(view.elements.get('vr-doc').innerHTML.includes('&lt;script&gt;bad&lt;/script&gt;'))
  assert.deepEqual([...stack.matchAll(/id="(vrc-\d+)"/g)].map(match => match[1]), ['vrc-0', 'vrc-1'])
  runInNewContext('commit(0); commit(1); sendBack()', view.context)
  assert.equal(view.queued[0][1].data.id, text)
  assert.equal(view.queued[0][1].data.notes, text.trim())
  assert.equal(view.queued[0][1].data.runId, output.runId)
  assert.equal(view.queued[0][1].data.draftRevision, output.draftRevision)
  assert.equal(view.queued[2][1].data.runId, output.runId)
  assert.notEqual(view.queued[1][1].queueKey, view.queued[2][1].queueKey)
  assert.ok(!view.elements.get('vr-ledger').innerHTML.includes('<script>bad'))
  const second = await box.run()
  assert.equal(second.status, 0)
  assert.notEqual(second.envelope.data.runId, output.runId)
  assert.notEqual(second.envelope.data.scratch, output.scratch)
})

for (const [name, change, code] of [
  ['duplicate IDs', p => { p.cards[1].id = p.cards[0].id }, 'duplicate-id'],
  ['blank IDs', p => { p.cards[0].id = ' ' }, 'missing-id'],
  ['missing IDs', p => { delete p.cards[0].id }, 'missing-field'],
  ['stale draft', p => { p.draftRevision = '0'.repeat(64) }, 'stale-draft'],
  ['unknown fields', p => { p.extra = true }, 'unknown-field'],
  ['empty cards', p => { p.cards = [] }, 'min-items'],
  ['wrong field types', p => { p.cards[0].title = 12 }, 'invalid-type']
]) {
  test(`board rejects ${name} before scratch writes`, async t => {
    const box = await setup(t)
    change(box.proposals)
    const result = await box.run()
    assert.equal(result.status, 1)
    assert.ok(result.envelope.problems.some(problem => problem.code === code), result.stdout)
    assert.deepEqual(await readdir(box.target), [])
    assert.deepEqual((await readdir(box.directory)).sort(), ['draft.md', 'proposals.json', 'target'])
  })
}

for (const [name, draft] of [['empty', ' \n'], ['invalid UTF-8', Buffer.from([0xc0, 0xaf])]]) {
  test(`board rejects an ${name} draft without scratch writes`, async t => {
    const box = await setup(t, draft)
    const result = await box.run()
    assert.equal(result.status, 1)
    assert.equal(result.envelope.problems[0].code, 'invalid-draft')
    assert.deepEqual(await readdir(box.target), [])
    assert.deepEqual((await readdir(box.directory)).sort(), ['draft.md', 'proposals.json', 'target'])
  })
}

test('board reports missing files, missing options and unknown options', async t => {
  const box = await setup(t)
  const missing = spawnSync(process.execPath, [join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), 'vision-board', 'build', '--workspace', box.target, '--json'], { encoding: 'utf8' })
  assert.equal(missing.status, 3)
  assert.equal(JSON.parse(missing.stdout).problems[0].code, 'missing-input')
  const unknown = await box.run(box.proposals, ['--unexpected'])
  assert.equal(unknown.status, 3)
  await rm(join(box.directory, 'draft.md'))
  const unreadable = await box.run()
  assert.equal(unreadable.status, 1)
  assert.equal(unreadable.envelope.problems[0].code, 'invalid-input')
})

test('board ships the unchanged upstream stylesheet beside its generated HTML', async t => {
  const box = await setup(t)
  const result = await box.run()
  assert.equal(result.status, 0)
  assert.deepEqual(await readFile(join(result.envelope.data.scratch, 'review.css')), await readFile(join(root, 'upstream/vision/skills/vision/assets/review.css')))
})
