import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { git, run } from './discovery-fixture.mjs'
import { selectCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const assessmentPath = '.bstack/assessment.json'
const checkerPath = '.bstack/bin/bstack-check.mjs'

function commit(repo) {
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  return git(repo, 'rev-parse', 'HEAD')
}

function check(f, extra = [], checker = join(f.repo, checkerPath)) {
  const result = spawnSync(process.execPath, [checker, '--repo', f.repo, '--base', f.base,
    '--assessment', join(f.repo, assessmentPath), '--json', ...extra], { cwd: f.directory, env: f.env, encoding: 'utf8' })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

async function fixture(t) {
  const f = await maintenanceRepo(t)
  f.env = { ...process.env, HOME: join(f.directory, 'home'), USERPROFILE: join(f.directory, 'home'),
    CODEX_HOME: join(f.directory, 'home/.codex'), XDG_CONFIG_HOME: join(f.directory, 'home/config'),
    XDG_CACHE_HOME: join(f.directory, 'cache'), LOCALAPPDATA: join(f.directory, 'cache'),
    BSTACK_LEAF_LOG: join(f.directory, 'leaf.log') }
  await mkdir(f.env.HOME)
  await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { maintain: 'node .bstack/bin/bstack-check.mjs' } }))
  await mkdir(join(f.repo, '.bstack/bin'))
  await cp(join(root, 'skills/repo-audit/scripts/bstack-check.mjs'), join(f.repo, checkerPath))
  await writeFile(join(f.repo, 'src/change.mjs'), 'export const price = 12\n')
  await writeFile(join(f.repo, 'leaf.mjs'), "import { appendFileSync } from 'node:fs'; appendFileSync(process.env.BSTACK_LEAF_LOG, 'run\\n'); process.exit(0)\n")
  f.contract.generators = []
  f.contract.checks[0].command.args = ['leaf.mjs']
  await f.save()
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'export const price = 12;\n')
  commit(f.repo)
  const collected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', assessmentPath])
  assert.equal(collected.exit, 0, JSON.stringify(collected))
  f.assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
  f.assessment.coverage = ['boundary']
  f.complete = () => {
    for (const entry of [...f.assessment.documents, ...f.assessment.unmappedAssessments]) entry.assessment = {
      result: 'no-impact', changedBehavior: 'The source update preserves price 12 and the documented public contract.',
      changedPaths: f.assessment.paths, reason: 'The source value and public pricing behavior are unchanged.',
      citations: [{ path: 'README.md', pointer: '# Source', version: 'base' }], dependentWork: [] }
  }
  f.complete()
  f.write = () => writeFile(join(f.repo, assessmentPath), JSON.stringify(f.assessment, null, 2) + '\n')
  await f.write()
  const bound = run('evidence validate', f.repo, f.env, ['--base', f.base, '--assessment', join(f.repo, assessmentPath)])
  assert.ok(bound.data.fingerprint, JSON.stringify(bound))
  f.assessment.fingerprint = bound.data.fingerprint
  await f.write()
  commit(f.repo)
  return f
}

test('different-root clean clone runs one fresh leaf with isolated home and cache and unchanged committed review', async t => {
  const f = await fixture(t)
  const before = await readFile(join(f.repo, assessmentPath))
  const local = check(f)
  assert.equal(local.exit, 0, JSON.stringify(local))
  assert.equal(local.data.checks.length, 1)
  assert.equal(await readFile(f.env.BSTACK_LEAF_LOG, 'utf8'), 'run\n')
  const clone = join(f.directory, 'clone')
  git(f.directory, 'clone', '-q', '--no-local', f.repo, clone)
  f.repo = clone
  f.env.HOME = join(f.directory, 'clean-home')
  f.env.USERPROFILE = f.env.HOME
  f.env.CODEX_HOME = join(f.env.HOME, '.codex')
  f.env.XDG_CONFIG_HOME = join(f.env.HOME, 'config')
  f.env.XDG_CACHE_HOME = join(f.directory, 'clean-cache')
  f.env.LOCALAPPDATA = f.env.XDG_CACHE_HOME
  await mkdir(f.env.HOME)
  await rm(f.env.BSTACK_LEAF_LOG)
  assert.deepEqual(await readdir(f.env.HOME), [])
  await assert.rejects(readdir(join(clone, 'node_modules')), { code: 'ENOENT' })
  await assert.rejects(readdir(join(clone, 'skills')), { code: 'ENOENT' })
  const aggregate = await selectCommand('npm', ['run', 'maintain', '--', '--repo', clone, '--base', f.base,
    '--assessment', join(clone, assessmentPath), '--json'], { env: f.env })
  const execution = spawnSync(aggregate.executable, aggregate.args, { cwd: clone, env: f.env, encoding: 'utf8' })
  assert.equal(execution.status, 0, execution.stderr + execution.stdout)
  const clean = { exit: execution.status, ...JSON.parse(execution.stdout.trim().split('\n').at(-1)) }
  assert.equal(clean.exit, 0, JSON.stringify(clean))
  assert.equal(clean.data.fingerprint, local.data.fingerprint)
  assert.equal(clean.data.checks.length, 1)
  assert.equal(await readFile(f.env.BSTACK_LEAF_LOG, 'utf8'), 'run\n')
  assert.deepEqual(await readFile(join(clone, assessmentPath)), before)
  assert.equal(git(clone, 'status', '--porcelain'), '')
  assert.equal(clean.data.comparison.mergeBase, f.base)
  await writeFile(join(clone, 'leaf.mjs'), 'process.exit(1)\n')
  const rejected = spawnSync(aggregate.executable, aggregate.args, { cwd: clone, env: f.env, encoding: 'utf8' })
  assert.notEqual(rejected.status, 0)
})

for (const mutation of ['missing assessment', 'stale document', 'incomplete assessment', 'missing base', 'failed leaf', 'saved success']) {
  test(`clean checker rejects ${mutation}`, async t => {
    const f = await fixture(t)
    if (mutation === 'missing assessment') await rm(join(f.repo, assessmentPath))
    if (mutation === 'stale document') await writeFile(join(f.repo, 'README.md'), '# Source\n[missing](missing.md)\n')
    if (mutation === 'incomplete assessment') { f.assessment.documents[0].assessment = null; await f.write(); commit(f.repo) }
    if (mutation === 'missing base') f.base = 'missing-base'
    if (['failed leaf', 'saved success'].includes(mutation)) {
      const first = check(f)
      assert.equal(first.exit, 0, JSON.stringify(first))
      await writeFile(join(f.repo, 'leaf.mjs'), 'process.exit(1)\n')
      // Bind a new committed source review; an earlier result cannot replace this run.
      commit(f.repo)
      const collected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', assessmentPath])
      assert.equal(collected.exit, 0, JSON.stringify(collected))
      f.assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
      f.assessment.coverage = ['boundary']
      f.complete()
      if (mutation === 'saved success') f.assessment.execution = [{ runId: first.data.path, plan: 'saved-success.json' }]
      await f.write()
      const bound = run('evidence validate', f.repo, f.env, ['--base', f.base, '--assessment', join(f.repo, assessmentPath)])
      f.assessment.fingerprint = bound.data.fingerprint
      await f.write()
      commit(f.repo)
    }
    const result = check(f)
    assert.notEqual(result.exit, 0, JSON.stringify(result))
    if (['failed leaf', 'saved success'].includes(mutation)) {
      assert.equal(result.exit, 1, JSON.stringify(result))
      assert.equal(result.data.checks[0].execution.exitCode, 1)
    }
  })
}

for (const command of ['recursive', 'cycle']) test(`preflight rejects ${command} leaves before execution`, async t => {
  const f = await fixture(t)
  if (command === 'recursive') f.contract.checks[0].command.args = [checkerPath]
  else {
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { verify: 'npm run again', again: 'npm run verify' } }))
    f.contract.checks[0].command = { executable: 'npm', args: ['run', 'verify'], cwd: '.', versionArgs: ['--version'] }
  }
  await f.save()
  f.assessment.repo = f.repo
  await f.write()
  const result = check(f)
  assert.notEqual(result.exit, 0)
  assert.ok(result.problems.some(problem => problem.code === 'recursive-check'), JSON.stringify(result))
  const collected = run('evidence collect', f.repo, f.env, ['--base', f.base])
  assert.ok(collected.problems.some(problem => problem.code === 'recursive-check'), JSON.stringify(collected))
  await assert.rejects(readFile(f.env.BSTACK_LEAF_LOG), { code: 'ENOENT' })
})

test('shallow clone blocks missing comparison until the documented fetch', async t => {
  const f = await fixture(t)
  const source = f.repo
  const clone = join(f.directory, 'shallow')
  git(f.directory, 'clone', '-q', '--depth', '1', pathToFileURL(source).href, clone)
  f.repo = clone
  const result = check(f)
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'base-unavailable')
  assert.match(result.problems[0].fix, /git fetch --unshallow origin/)
  git(clone, 'fetch', '-q', '--unshallow', 'origin')
  git(clone, 'fetch', '-q', 'origin', f.base)
  assert.equal(check(f).exit, 0, JSON.stringify(check(f)))
})

test('extracted comparison checker rejects a removed contract even after the proposed checker is replaced', async t => {
  const f = await fixture(t)
  const previous = join(f.directory, 'previous.mjs')
  await writeFile(previous, git(f.repo, 'show', `${f.base}:${checkerPath}`) + '\n')
  await rm(join(f.repo, '.bstack/project.json'))
  await writeFile(join(f.repo, checkerPath), 'process.exit(0)\n')
  const replacement = { ...f.contract, scopes: [], rules: [], checks: [] }
  await writeFile(join(f.repo, '.bstack/proposed.json'), JSON.stringify(replacement))
  f.assessment.repo = f.repo
  f.assessment.head = commit(f.repo)
  await f.write()
  commit(f.repo)
  const result = check(f, ['--contract', '.bstack/proposed.json'], previous)
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'previous-contract-reconciliation-required')
})

test('policy changes execute the extracted comparison checker before the current leaf phase', async t => {
  const f = await fixture(t)
  f.contract.scopes[0].paths.push('extra/**')
  await f.save()
  commit(f.repo)
  const collected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', assessmentPath])
  assert.equal(collected.exit, 0, JSON.stringify(collected))
  f.assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
  f.assessment.coverage = ['boundary']
  f.complete()
  await f.write()
  const bound = run('evidence validate', f.repo, f.env, ['--base', f.base, '--assessment', join(f.repo, assessmentPath)])
  f.assessment.fingerprint = bound.data.fingerprint
  await f.write()
  commit(f.repo)
  const result = check(f)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.previous.status, 'passed')
  assert.equal(result.data.previous.data.checks.length, 1)
  assert.equal(result.data.checks.length, 1)
  assert.equal(await readFile(f.env.BSTACK_LEAF_LOG, 'utf8'), 'run\nrun\n')
})

test('checker requires explicit inputs and accepts only its documented options', async t => {
  const f = await fixture(t)
  assert.equal(check(f, ['--workspace', f.repo]).exit, 3)
  const result = spawnSync(process.execPath, [join(f.repo, checkerPath), '--repo', f.repo, '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 3)
})
