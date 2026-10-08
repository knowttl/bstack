import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

// Commands run outside the checkout against disposable target files and reports.
const entry = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit/scripts/repo-audit.mjs')

async function fixture(t, content = 'Purpose\r\nHousehold scope\r\n') {
  const directory = await mkdtemp(join(tmpdir(), 'bstack citations ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repo = join(directory, 'target')
  await mkdir(join(repo, 'docs'), { recursive: true })
  const path = 'docs/café & [notes].md'
  await writeFile(join(repo, path), content)
  const report = { schemaVersion: 1, mode: 'main-thread', host: 'test host', capabilities: { subagents: false, web: false },
    briefs: [{ id: 'documents', scope: [path], findings: 'The file establishes household scope.', limitations: [],
      files: [{ location: `${path}:2`, state: { kind: 'sha256', value: createHash('sha256').update(content).digest('hex') } }], web: [] }] }
  return { directory, repo, path, report, input: join(directory, 'report.json') }
}

async function run(context, ...extra) {
  await writeFile(context.input, JSON.stringify(context.report))
  const result = spawnSync(process.execPath, [entry, 'cite-check', '--workspace', context.repo, '--report', context.input, '--json', ...extra], { cwd: context.directory, encoding: 'utf8' })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

function git(repo, ...args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

test('correct exact-byte citations pass from another cwd without changing the target', async t => {
  const context = await fixture(t)
  const result = await run(context)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data, { mode: 'main-thread', filesChecked: 1, webRecorded: 0, webVerifiedByChecker: false })
  assert.deepEqual(await readdir(context.repo), ['docs'])
  assert.equal(await readFile(join(context.repo, context.path), 'utf8'), 'Purpose\r\nHousehold scope\r\n')
})

test('wrong path and wrong line are both reported as failed citations', async t => {
  const context = await fixture(t)
  context.report.briefs[0].files.push({ ...context.report.briefs[0].files[0], location: 'missing.md:1' })
  context.report.briefs[0].files[0].location = `${context.path}:3`
  const result = await run(context)
  assert.equal(result.exit, 1)
  assert.deepEqual(result.problems.map(problem => problem.code), ['citation-line-out-of-range', 'citation-file-unavailable'])
  assert.ok(result.problems.every(problem => problem.path && problem.fix))
})

for (const [name, replacement] of [
  ['content changes without changing line count', 'Purpose\r\nDifferent scope\r\n'],
  ['line-ending changes', 'Purpose\nHousehold scope\n']
]) {
  test(`hash citations fail after ${name}`, async t => {
    const context = await fixture(t)
    await writeFile(join(context.repo, context.path), replacement)
    const result = await run(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'stale-citation')
  })
}

test('revision citations remain valid across unrelated commits but fail on dirty cited bytes', async t => {
  const context = await fixture(t)
  git(context.repo, 'init', '-q')
  git(context.repo, 'add', '.')
  git(context.repo, '-c', 'user.name=Fixture author', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'initial')
  const revision = git(context.repo, 'rev-parse', 'HEAD')
  context.report.briefs[0].files[0].state = { kind: 'revision', value: revision }
  assert.equal((await run(context)).exit, 0)
  await writeFile(join(context.repo, 'unrelated.md'), 'Unrelated\n')
  git(context.repo, 'add', '.')
  git(context.repo, '-c', 'user.name=Fixture author', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'unrelated')
  assert.equal((await run(context)).exit, 0)
  await writeFile(join(context.repo, context.path), 'Purpose\r\nChanged scope\r\n')
  const result = await run(context)
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'stale-citation')
})

test('unavailable revisions fail rather than accepting an unverified state', async t => {
  const context = await fixture(t)
  context.report.briefs[0].files[0].state = { kind: 'revision', value: '0'.repeat(40) }
  const result = await run(context)
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'citation-revision-unavailable')
})

for (const [content, line, exit] of [['', 1, 1], ['One line', 1, 0], ['One line\n', 2, 1], ['One\r\nTwo', 2, 0], ['One\rTwo\r', 3, 1]]) {
  test(`line ${line} of ${JSON.stringify(content)} has exit ${exit}`, async t => {
    const context = await fixture(t, content)
    context.report.briefs[0].files[0].location = `${context.path}:${line}`
    assert.equal((await run(context)).exit, exit)
  })
}

for (const [name, modify, code] of [
  ['unknown report fields', report => { report.extra = true }, 'unknown-field'],
  ['duplicate brief IDs', report => { report.briefs.push(report.briefs[0]) }, 'duplicate-id'],
  ['line zero', report => { report.briefs[0].files[0].location = 'README.md:0' }, 'invalid-pattern'],
  ['missing citation state', report => { delete report.briefs[0].files[0].state }, 'missing-field'],
  ['wrong digest length for state kind', report => { report.briefs[0].files[0].state.value = '0'.repeat(40) }, 'invalid-citation-state'],
  ['parent traversal', report => { report.briefs[0].files[0].location = '../report.json:1' }, 'unsafe-path']
]) {
  test(`report rejects ${name}`, async t => {
    const context = await fixture(t)
    modify(context.report)
    const result = await run(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, code)
  })
}

test('web-only metadata passes without claiming that the checker verified the source', async t => {
  const context = await fixture(t)
  context.report.capabilities.web = true
  context.report.briefs[0].files = []
  context.report.briefs[0].web = [{ url: 'https://example.invalid/docs', readDate: '2026-10-08', verification: 'unverified' }]
  const result = await run(context)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data, { mode: 'main-thread', filesChecked: 0, webRecorded: 1, webVerifiedByChecker: false })
})

for (const [url, readDate] of [['file:///outside', '2026-10-08'], ['not a URL', '2026-10-08'], ['https://example.invalid', '2026-02-30']]) {
  test(`web citation ${url} read ${readDate} is invalid`, async t => {
    const context = await fixture(t)
    context.report.briefs[0].web = [{ url, readDate, verification: 'verified' }]
    const result = await run(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'invalid-web-citation')
  })
}

test('missing reports and malformed JSON fail through the command interface', async t => {
  const context = await fixture(t)
  const missing = spawnSync(process.execPath, [entry, 'cite-check', '--workspace', context.repo, '--json'], { encoding: 'utf8' })
  assert.equal(missing.status, 3)
  assert.equal(JSON.parse(missing.stdout).problems[0].code, 'missing-report')
  await writeFile(context.input, '{')
  const malformed = spawnSync(process.execPath, [entry, 'cite-check', '--workspace', context.repo, '--report', context.input, '--json'], { encoding: 'utf8' })
  assert.equal(malformed.status, 1)
  assert.equal(JSON.parse(malformed.stdout).problems[0].code, 'invalid-report')
})
