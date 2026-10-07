import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

// Tests invoke the public fixture command from outside the checkout.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

async function sandbox(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'bstack contract 日本語 $; ')))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const target = join(directory, 'target')
  const cache = process.platform === 'darwin' ? join(directory, 'Library', 'Caches') : join(directory, 'cache')
  await mkdir(join(target, 'inside'), { recursive: true })
  await writeFile(join(target, 'brief.md'), 'original\n')
  return { directory, target, cache }
}

function run(box, input, args = [], json = true, cache = box.cache) {
  const { NODE_TEST_CONTEXT, ...env } = process.env
  return spawnSync(process.execPath, [join(root, 'tests', 'inputs', 'contract.mjs'),
    ...(json ? ['--json'] : []), '--input', join(root, 'tests', 'inputs', input), ...args], {
    cwd: box.directory, encoding: 'utf8', env: { ...env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache, HOME: box.directory, USERPROFILE: box.directory }
  })
}

function envelope(result, status, exitCode) {
  assert.equal(result.status, exitCode, result.stderr + result.stdout)
  assert.equal(result.stderr, '')
  const output = JSON.parse(result.stdout)
  assert.deepEqual(Object.keys(output), ['schemaVersion', 'command', 'status', 'problems', 'data', 'inputs'])
  assert.equal(output.schemaVersion, 1)
  assert.equal(output.command, 'contract-test')
  assert.equal(output.status, status)
  for (const problem of output.problems) {
    assert.ok(problem.code)
    assert.ok(problem.message)
    assert.ok(problem.fix)
  }
  return output
}

test('draft workspace stores distinct runs in scratch and leaves workspace unchanged', async t => {
  const box = await sandbox(t)
  const args = ['--workspace', box.target, '--mode', 'draft']
  const first = envelope(run(box, 'draft.json', args), 'passed', 0)
  const second = envelope(run(box, 'draft.json', args), 'passed', 0)
  assert.equal(first.inputs.target.mode, 'workspace')
  assert.equal(dirname(first.data.scratch), dirname(second.data.scratch))
  assert.notEqual(first.data.scratch, second.data.scratch)
  assert.equal(await readFile(join(first.data.scratch, 'draft.txt'), 'utf8'), 'draft\n')
  assert.deepEqual(await readdir(box.target), ['brief.md', 'inside'])
  assert.equal(await readFile(join(box.target, 'brief.md'), 'utf8'), 'original\n')
})

for (const committed of [false, true]) {
  test(`Git target resolves from a subdirectory with ${committed ? 'a commit' : 'no commits'}`, async t => {
    const box = await sandbox(t)
    const git = (...args) => {
      const result = spawnSync('git', ['-C', box.target, ...args], { encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
    }
    git('init', '-q')
    if (committed) {
      git('add', 'brief.md')
      git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture')
    }
    await symlink(join(box.target, 'inside'), join(box.target, 'internal-link'), process.platform === 'win32' ? 'junction' : 'dir')
    const output = envelope(run(box, 'valid-paths.json', ['--repo', join(box.target, 'inside'), '--mode', 'repo']), 'passed', 0)
    assert.equal(output.inputs.target.root, box.target)
    assert.deepEqual(output.data.paths, [join(box.target, 'new folder', '日本語 $literal; [x].md'), join(box.target, 'inside', 'new.md'), join(box.target, 'inside', 'new.md')])
    assert.deepEqual(await readdir(box.target), ['.git', 'brief.md', 'inside', 'internal-link'])
  })
}

for (const name of ['repo ', 'repo \t\r']) {
  test(`Git target preserves trailing whitespace ${JSON.stringify(name)}`, { skip: process.platform === 'win32' }, async t => {
    const box = await sandbox(t)
    const target = join(box.directory, name)
    await mkdir(join(target, 'inside'), { recursive: true })
    await mkdir(join(box.directory, 'repo'))
    const git = spawnSync('git', ['-C', target, 'init', '-q'], { encoding: 'utf8' })
    assert.equal(git.status, 0, git.stderr)
    const output = envelope(run(box, 'draft.json', ['--repo', join(target, 'inside'), '--mode', 'repo']), 'passed', 0)
    assert.equal(output.inputs.target.root, target)
    assert.deepEqual(await readdir(join(box.directory, 'repo')), [])
  })
}

for (const [name, args, code] of [
  ['missing target', ['--mode', 'draft'], 'missing-target'],
  ['unknown options', ['--unexpected', '--other'], 'unknown-option'],
  ['missing value', ['--workspace', '--mode', 'draft'], 'missing-value'],
  ['duplicate option', ['--json', '--mode', 'draft'], 'duplicate-option'],
  ['conflicting targets', ['--repo', '.', '--workspace', '.', '--mode', 'draft'], 'conflicting-targets']
]) {
  test(`arguments reject ${name} with a JSON usage error`, async t => {
    const box = await sandbox(t)
    const output = envelope(run(box, 'draft.json', args), 'usage-error', 3)
    assert.ok(output.problems.some(problem => problem.code === code))
    assert.deepEqual(await readdir(box.directory), ['target'])
  })
}

for (const [input, status, exitCode, code, count] of [
  ['traversal.json', 'usage-error', 3, 'unsafe-path', 3],
  ['absolute-paths.json', 'usage-error', 3, 'unsafe-path', 4],
  ['unknown-fields.json', 'failed', 1, 'unknown-field', 2],
  ['invalid-types.json', 'failed', 1, 'invalid-input', 1]
]) {
  test(`rejects ${input} before scratch writes and reports every problem`, async t => {
    const box = await sandbox(t)
    const output = envelope(run(box, input, ['--workspace', box.target, '--mode', 'draft']), status, exitCode)
    assert.equal(output.problems.length, count)
    assert.ok(output.problems.every(problem => problem.code === code))
    assert.deepEqual(await readdir(box.directory), ['target'])
  })
}

test('escaping existing links and new children under escaping parents are refused before writes', async t => {
  const box = await sandbox(t)
  const outside = join(box.directory, 'outside')
  await mkdir(outside)
  await writeFile(join(outside, 'old.md'), 'unchanged')
  await symlink(outside, join(box.target, 'outside-link'), process.platform === 'win32' ? 'junction' : 'dir')
  const output = envelope(run(box, 'escaping-links.json', ['--workspace', box.target, '--mode', 'draft']), 'usage-error', 3)
  assert.deepEqual(output.problems.map(problem => problem.code), ['escaping-path', 'escaping-path'])
  assert.deepEqual(await readdir(outside), ['old.md'])
  assert.equal(await readFile(join(outside, 'old.md'), 'utf8'), 'unchanged')
  assert.deepEqual(await readdir(box.directory), ['outside', 'target'])
})

test('dangling parents are refused rather than treated as missing directories', async t => {
  const box = await sandbox(t)
  await symlink(join(box.directory, 'absent'), join(box.target, 'dangling'), process.platform === 'win32' ? 'junction' : 'dir')
  const output = envelope(run(box, 'dangling-link.json', ['--workspace', box.target, '--mode', 'draft']), 'usage-error', 3)
  assert.equal(output.problems[0].code, 'unresolved-path')
  assert.deepEqual(await readdir(box.directory), ['target'])
})

test('missing Git prerequisite returns blocked rather than passing', async t => {
  const box = await sandbox(t)
  const output = envelope(run(box, 'draft.json', ['--repo', box.target, '--mode', 'repo']), 'blocked', 2)
  assert.equal(output.problems[0].code, 'git-unavailable')
  assert.deepEqual(await readdir(box.directory), ['target'])
})

test('repo commands refuse workspace mode', async t => {
  const box = await sandbox(t)
  const output = envelope(run(box, 'draft.json', ['--workspace', box.target, '--mode', 'repo']), 'usage-error', 3)
  assert.equal(output.problems[0].code, 'workspace-not-supported')
})

test('scratch refuses a cache link into the target before creating directories', async t => {
  const box = await sandbox(t)
  await mkdir(dirname(box.cache), { recursive: true })
  await symlink(box.target, box.cache, process.platform === 'win32' ? 'junction' : 'dir')
  const output = envelope(run(box, 'draft.json', ['--workspace', box.target, '--mode', 'draft']), 'blocked', 2)
  assert.equal(output.problems[0].code, 'scratch-inside-target')
  assert.deepEqual(await readdir(box.target), ['brief.md', 'inside'])
})

test('scratch follows a cache link outside the target', async t => {
  const box = await sandbox(t)
  const outside = join(box.directory, 'outside')
  await mkdir(outside)
  await mkdir(dirname(box.cache), { recursive: true })
  await symlink(outside, box.cache, process.platform === 'win32' ? 'junction' : 'dir')
  const output = envelope(run(box, 'draft.json', ['--workspace', box.target, '--mode', 'draft']), 'passed', 0)
  const key = createHash('sha256').update(box.target).digest('hex')
  assert.equal(dirname(output.data.scratch), join(outside, 'bstack', key))
  assert.equal(await readFile(join(output.data.scratch, 'draft.txt'), 'utf8'), 'draft\n')
  assert.deepEqual(await readdir(box.target), ['brief.md', 'inside'])
})

test('scratch follows a run-parent link outside the target', async t => {
  const box = await sandbox(t)
  const outside = join(box.directory, 'outside')
  await mkdir(outside)
  await mkdir(join(box.cache, 'bstack'), { recursive: true })
  const key = createHash('sha256').update(box.target).digest('hex')
  await symlink(outside, join(box.cache, 'bstack', key), process.platform === 'win32' ? 'junction' : 'dir')
  const output = envelope(run(box, 'draft.json', ['--workspace', box.target, '--mode', 'draft']), 'passed', 0)
  assert.equal(dirname(output.data.scratch), outside)
  assert.equal(await readFile(join(output.data.scratch, 'draft.txt'), 'utf8'), 'draft\n')
  assert.deepEqual(await readdir(box.target), ['brief.md', 'inside'])
})

test('scratch refuses a run-parent link inside the target before creating directories', async t => {
  const box = await sandbox(t)
  await mkdir(join(box.cache, 'bstack'), { recursive: true })
  const key = createHash('sha256').update(box.target).digest('hex')
  await symlink(box.target, join(box.cache, 'bstack', key), process.platform === 'win32' ? 'junction' : 'dir')
  const output = envelope(run(box, 'draft.json', ['--workspace', box.target, '--mode', 'draft']), 'blocked', 2)
  assert.equal(output.problems[0].code, 'scratch-inside-target')
  assert.deepEqual(await readdir(box.target), ['brief.md', 'inside'])
})

test('target aliases use the same scratch identity', async t => {
  const box = await sandbox(t)
  const alias = join(box.directory, 'alias')
  await symlink(box.target, alias, process.platform === 'win32' ? 'junction' : 'dir')
  const original = envelope(run(box, 'draft.json', ['--workspace', box.target, '--mode', 'draft']), 'passed', 0)
  const linked = envelope(run(box, 'draft.json', ['--workspace', alias, '--mode', 'draft']), 'passed', 0)
  assert.equal(linked.inputs.target.root, box.target)
  assert.equal(dirname(linked.data.scratch), dirname(original.data.scratch))
})

for (const target of ['absent', 'brief.md']) {
  test(`unavailable target ${target} is blocked without writes`, async t => {
    const box = await sandbox(t)
    const output = envelope(run(box, 'draft.json', ['--workspace', join(box.target, target), '--mode', 'draft']), 'blocked', 2)
    assert.equal(output.problems[0].code, 'target-unavailable')
    assert.deepEqual(await readdir(box.directory), ['target'])
  })
}

test('human output is a short summary with the same failed exit code', async t => {
  const box = await sandbox(t)
  const result = run(box, 'unknown-fields.json', ['--workspace', box.target, '--mode', 'draft'], false)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /^contract-test: failed\nunknown-field:/)
  assert.match(result.stdout, /Fix: Remove the unknown field/)
})
