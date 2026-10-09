import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { run, snapshot } from './discovery-fixture.mjs'
import { canonicalJSON, hashBytes } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

const start = '<!-- bstack:generated render -->'
const end = '<!-- bstack:end -->'
const original = `# Source\n${start}\nold\n${end}\nKeep this.\n`

async function setup(t, source = "process.stdout.write('\\nnew\\n')", document = original) {
  const f = await maintenanceRepo(t)
  f.env = { ...process.env, XDG_CACHE_HOME: join(f.directory, 'cache'), LOCALAPPDATA: join(f.directory, 'cache'), HOME: f.directory, USERPROFILE: f.directory }
  f.contract.generators[0].outputPaths = ['README.md']
  await writeFile(join(f.repo, 'render.mjs'), source)
  await writeFile(join(f.repo, 'README.md'), document)
  await f.save()
  return f
}

test('stale sections pass after scratch proposals are reviewed and protected apply writes them', async t => {
  const f = await setup(t)
  const before = await snapshot(f.repo)
  assert.equal(run('docs generate', f.repo, f.env, ['--check']).problems[0].code, 'stale-generated-section')
  const generated = run('docs generate', f.repo, f.env)
  assert.equal(generated.exit, 0)
  assert.deepEqual(await snapshot(f.repo), before)
  const { proposals } = JSON.parse(await readFile(generated.data.proposalsPath, 'utf8'))
  assert.equal(proposals[0].proposedContent, original.replace('\nold\n', '\nnew\n'))
  const findings = JSON.parse(await readFile(new URL('../inputs/findings-audit.json', import.meta.url), 'utf8'))
  findings.target.root = f.repo
  findings.reviewedScope = ['README.md']
  findings.sources = [findings.sources[0]]
  findings.findings[0].scope = ['README.md']
  findings.findings[0].files = ['README.md']
  findings.findings[0].sourceIds = ['purpose']
  const { diff, ...edit } = proposals[0]
  const plan = { schemaVersion: 1, target: findings.target, findings: 'findings.json', findingsDigest: hashBytes(canonicalJSON(findings)),
    selectedFindingIds: ['F-001'], reviewedScope: [{ path: 'README.md', resolvedPath: join(f.repo, 'README.md') }],
    edits: [{ ...edit, id: 'generated', findingId: 'F-001' }] }
  await writeFile(join(f.directory, 'findings.json'), JSON.stringify(findings))
  const file = join(f.directory, 'plan.json')
  await writeFile(file, JSON.stringify({ ...plan, planDigest: hashBytes(canonicalJSON(plan)) }))
  const preview = run('apply', f.repo, f.env, ['--plan', file, '--dry-run'])
  assert.equal(preview.exit, 0, JSON.stringify(preview))
  assert.equal(preview.data.diff, diff)
  assert.deepEqual(await snapshot(f.repo), before)
  assert.equal(run('apply', f.repo, f.env, ['--plan', file]).exit, 0)
  assert.equal(run('docs generate', f.repo, f.env, ['--check']).exit, 0)
})

for (const [name, document, code] of [
  ['duplicate', `${start}a${end}${start}b${end}`, 'duplicate-marker'],
  ['nested', `${start}${start}${end}${end}`, 'nested-marker'],
  ['orphan end', end, 'unmatched-marker'],
  ['unclosed start', start, 'unmatched-marker'],
  ['unterminated comment', '<!-- bstack:generated render', 'invalid-marker'],
  ['missing', '# Source\n', 'missing-marker']
]) {
  test(`${name} markers reject before executing generators`, async t => {
    const f = await setup(t, "throw new Error('must not execute')", document)
    assert.equal(run('docs generate', f.repo, f.env, ['--check']).problems[0].code, code)
  })
}

for (const [name, source] of [
  ['existing file', "import {writeFileSync} from 'node:fs'; writeFileSync('src/old.mjs', 'changed')"],
  ['ignored file', "import {writeFileSync} from 'node:fs'; writeFileSync('.cache/new', 'changed')"],
  ['deleted file', "import {unlinkSync} from 'node:fs'; unlinkSync('src/old.mjs')"],
  ['link', "import {symlinkSync} from 'node:fs'; symlinkSync('README.md', 'new-link')"]
]) {
  test(`mutation of ${name} fails the read-only contract`, async t => {
    const f = await setup(t, source)
    await mkdir(join(f.repo, '.cache'))
    assert.equal(run('docs generate', f.repo, f.env, ['--check']).problems[0].code, 'generator-mutated-project')
  })
}

for (const source of ["process.exit(2)", "process.stdout.write('x'.repeat(70000))", "process.stdout.write(Buffer.from([255]))"]) {
  test(`unsuccessful or inexact generator output cannot pass: ${source}`, async t => {
    const f = await setup(t, source)
    assert.equal(run('docs generate', f.repo, f.env, ['--check']).problems[0].code, 'generator-failed')
  })
}

test('multiple sections preserve surrounding bytes and use independent generator outputs', async t => {
  const f = await setup(t, "process.stdout.write('\\nnew\\n')", `${original}<!-- bstack:generated second -->old${end}`)
  f.contract.generators.push({ ...f.contract.generators[0], id: 'second', command: { executable: 'node', args: ['-e', "process.stdout.write('second')"], cwd: '.', versionArgs: ['--version'] } })
  await f.save()
  const result = run('docs generate', f.repo, f.env)
  assert.equal(result.exit, 0)
  assert.equal(result.data.proposals[0].proposedContent, `${original.replace('\nold\n', '\nnew\n')}<!-- bstack:generated second -->second${end}`)
})

test('plain regeneration output exposes a readable proposal file', async t => {
  const f = await setup(t)
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../skills/repo-audit/scripts/repo-audit.mjs', import.meta.url)),
    'docs', 'generate', '--repo', f.repo], { encoding: 'utf8', env: f.env })
  assert.equal(result.status, 0, result.stderr)
  const [status, path] = result.stdout.trim().split('\n')
  assert.equal(status, 'docs generate: passed')
  const { proposals } = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(proposals[0].proposedContent, original.replace('\nold\n', '\nnew\n'))
  assert.equal(await readFile(join(f.repo, 'README.md'), 'utf8'), original)
})

test('aliased destinations combine sections and replace each generator section once', async t => {
  const document = `${original}<!-- bstack:generated second -->old${end}`
  const f = await setup(t, "process.stdout.write('\\nnew\\n')", document)
  await mkdir(join(f.repo, 'docs'))
  await symlink('../README.md', join(f.repo, 'docs/readme.md'))
  f.contract.generators[0].outputPaths = ['README.md', 'docs/readme.md']
  f.contract.generators.push({ ...f.contract.generators[0], id: 'second', outputPaths: ['docs/readme.md'],
    command: { executable: 'node', args: ['-e', "process.stdout.write('second')"], cwd: '.', versionArgs: ['--version'] } })
  await f.save()
  const result = run('docs generate', f.repo, f.env)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.proposals.length, 1)
  assert.equal(result.data.sections.length, 2)
  assert.equal(result.data.proposals[0].path, 'README.md')
  const content = `${original.replace('\nold\n', '\nnew\n')}<!-- bstack:generated second -->second${end}`
  assert.equal(result.data.proposals[0].proposedContent, content)
  assert.equal(await readFile(join(f.repo, 'README.md'), 'utf8'), document)
  await writeFile(join(f.repo, 'README.md'), content)
  const checked = run('docs generate', f.repo, f.env, ['--check'])
  assert.equal(checked.exit, 0, JSON.stringify(checked))
  assert.equal(checked.data.sections.length, 2)
})

test('recursive docs generation is rejected as a child command', async t => {
  const f = await setup(t)
  f.contract.generators[0].command.args = ['repo-audit.mjs', 'docs', 'generate']
  await f.save()
  assert.equal(run('docs generate', f.repo, f.env, ['--check']).problems[0].code, 'recursive-check')
})

test('an unchanged section passes without target writes or scratch proposals', async t => {
  const f = await setup(t, "process.stdout.write('\\nold\\n')")
  const before = await snapshot(f.repo)
  assert.equal(run('docs generate', f.repo, f.env, ['--check']).exit, 0)
  assert.deepEqual(run('docs generate', f.repo, f.env).data.proposals, [])
  assert.deepEqual(await snapshot(f.repo), before)
})
