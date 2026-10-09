import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, readFile, writeFile, rm, readdir, chmod, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { git, run } from './discovery-fixture.mjs'
import { selectCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'
import { fingerprint } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const assessmentPath = '.bstack/assessment.json'
const checkerPath = '.bstack/bin/bstack-check.mjs'

function commit(repo) {
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  return git(repo, 'rev-parse', 'HEAD')
}

function check(f, extra = [], checker = join(f.repo, checkerPath), assessment = join(f.repo, assessmentPath)) {
  const result = spawnSync(process.execPath, [checker, '--repo', f.repo, '--base', f.base,
    '--assessment', assessment, '--json', ...extra], { cwd: f.directory, env: f.env, encoding: 'utf8' })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

async function fixture(t, { initial = false, submodule = false, diagnostic = false, portableModes = false, executionError = false, formatAssessment = false, policyChange = false } = {}) {
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
  if (diagnostic) await writeFile(join(f.repo, 'leaf.mjs'), "import { writeFileSync } from 'node:fs'; writeFileSync('diagnostic.txt', 'details'); console.log('leaf diagnostic'); process.exit(1)\n")
  if (formatAssessment) await writeFile(join(f.repo, 'leaf.mjs'), "import { readFileSync, writeFileSync } from 'node:fs'; const path = '.bstack/assessment.json'; writeFileSync(path, JSON.stringify(JSON.parse(readFileSync(path, 'utf8')))); console.log('assessment formatted'); process.exit(0)\n")
  if (executionError) {
    await mkdir(join(f.repo, 'leaf-work'))
    await writeFile(join(f.repo, 'leaf-work/input.txt'), 'input\n')
    await writeFile(join(f.repo, 'leaf.mjs'), "import { rmSync, symlinkSync } from 'node:fs'; rmSync('leaf-work', { recursive: true }); symlinkSync('missing-work', 'leaf-work'); console.log('first leaf diagnostic'); process.exit(1)\n")
    f.contract.checks.push({ id: 'second', command: { executable: 'node', args: ['--version'], cwd: 'leaf-work', versionArgs: ['--version'] }, inputScopes: ['src/**'] })
  }
  if (submodule) {
    const module = join(f.directory, 'module')
    await mkdir(module)
    git(module, 'init', '-q')
    await writeFile(join(module, 'content.txt'), 'reviewed module\n')
    if (portableModes) await chmod(join(module, 'content.txt'), 0o744)
    commit(module)
    git(f.repo, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', module, 'vendor')
    f.contract.checks[0].inputScopes.push('vendor')
    if (portableModes) {
      await chmod(join(f.repo, 'vendor'), 0o700)
      await chmod(join(f.repo, 'vendor/content.txt'), 0o744)
    }
  }
  if (portableModes) {
    f.contract.checks[0].inputScopes.push('src')
    await chmod(join(f.repo, 'src'), 0o700)
    await chmod(join(f.repo, 'src/change.mjs'), 0o744)
  }
  await f.save()
  if (initial) await rm(join(f.repo, '.bstack/project.json'))
  f.base = commit(f.repo)
  if (initial) await f.save()
  if (policyChange) {
    f.contract.scopes[0].paths.push('extra/**')
    await f.save()
  }
  await writeFile(join(f.repo, 'src/change.mjs'), 'export const price = 12;\n')
  commit(f.repo)
  const collected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', assessmentPath])
  assert.equal(collected.exit, 0, JSON.stringify(collected))
  f.assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
  f.assessment.coverage = ['boundary']
  if (initial) f.assessment.foundation = { findingId: 'F-001', record: {
    schemaVersion: 1, stage: 'foundation', target: { mode: 'repo', root: f.repo, revision: f.assessment.head }, nextChange: 'Establish pricing checks',
    reviewedScope: ['.bstack/project.json'], sources: [{ id: 'intent', pointer: 'README.md', intent: 'documented', summary: 'Preserve pricing' }],
    findings: [{ id: 'F-001', problem: 'Missing maintenance policy', files: ['.bstack/project.json'], command: null, principle: 'Preserve pricing', consequence: 'Drift',
      fix: 'Install contract', scope: ['.bstack/project.json'], verification: 'syntax', blocksNextChange: true, category: 'missing-protection',
      status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['intent'] }], selectedFindingIds: ['F-001'], requiredOutcomes: ['syntax', 'journey', 'foundation-review'], execution: [], limitations: [] } }
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

async function bindReview(f, portable = assessmentPath) {
  const collected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', portable])
  assert.equal(collected.exit, 0, JSON.stringify(collected))
  f.assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
  f.assessment.coverage = ['boundary']
  f.complete()
  await f.write()
  const bound = run('evidence validate', f.repo, f.env, ['--base', f.base, '--assessment', join(f.repo, portable)])
  assert.ok(bound.data.fingerprint, JSON.stringify(bound))
  f.assessment.fingerprint = bound.data.fingerprint
  await f.write()
  commit(f.repo)
}

for (const state of ['committed', 'untracked', 'absent', 'escaping']) test(`portable collection resolves ${state} assessment directory aliases`, { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t)
  const destination = state === 'escaping' ? join(f.directory, 'outside') : '.bstack'
  if (state === 'escaping') await mkdir(destination)
  await symlink(destination, join(f.repo, 'reviews'), 'dir')
  if (state === 'untracked') git(f.repo, 'rm', '--cached', assessmentPath)
  if (state === 'absent') await rm(join(f.repo, assessmentPath))
  if (state === 'untracked') {
    git(f.repo, 'add', 'reviews')
    git(f.repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'assessment alias')
  } else commit(f.repo)
  if (state === 'escaping') {
    const rejected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', 'reviews/assessment.json'])
    assert.equal(rejected.exit, 3, JSON.stringify(rejected))
    assert.equal(rejected.problems[0].code, 'invalid-portable-assessment')
    return
  }
  await bindReview(f, 'reviews/assessment.json')
  assert.ok(!f.assessment.paths.includes(assessmentPath))
  const checked = check(f, [], join(f.repo, checkerPath), join(f.repo, 'reviews/assessment.json'))
  assert.equal(checked.exit, 0, JSON.stringify(checked))
  assert.equal(checked.data.fingerprint, f.assessment.fingerprint)
})

const structuralChanges = [
  ['link destination', "writeFileSync('build/API.md', '# Other\\n')", 'broken-local-link'],
  ['generator input', "writeFileSync('build/input.txt', 'new\\n')", 'stale-generated-section'],
  ['generator output', "writeFileSync('build/FACTS.md', '# Missing markers\\n')", 'missing-marker'],
  ['generator command', "writeFileSync('build/generate.mjs', \"process.stdout.write('new\\\\n')\\n\")", 'stale-generated-section'],
  ['unchanged generator output', "writeFileSync('build/input.txt', 'old\\n')", null]
]
for (const policy of ['proposed', 'previous']) for (const [change, mutation, code] of structuralChanges) {
  test(`${policy} policy rechecks ignored ${change} after the leaf`, async t => {
    const f = await fixture(t)
    await mkdir(join(f.repo, 'build'))
    await writeFile(join(f.repo, '.gitignore'), 'build/\n')
    if (change === 'link destination') {
      await writeFile(join(f.repo, 'GUIDE.md'), '# Source\n[Price](build/API.md#price)\n')
      await writeFile(join(f.repo, 'build/API.md'), '# Price\n')
      f.contract.documents.push({ id: 'guide', path: 'GUIDE.md' })
    } else {
      await writeFile(join(f.repo, 'build/input.txt'), 'old\n')
      await writeFile(join(f.repo, 'build/FACTS.md'), '<!-- bstack:generated facts -->old\n<!-- bstack:end -->\n')
      await writeFile(join(f.repo, 'build/generate.mjs'), "import { readFileSync } from 'node:fs'; process.stdout.write(readFileSync('build/input.txt', 'utf8'))\n")
      f.contract.generators.push({ id: 'facts', command: { executable: 'node', args: ['build/generate.mjs'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['build/input.txt'], outputPaths: ['build/FACTS.md'] })
    }
    await writeFile(join(f.repo, 'leaf.mjs'), `import { appendFileSync, writeFileSync } from 'node:fs'; ${mutation}; appendFileSync(process.env.BSTACK_LEAF_LOG, 'run\\n'); console.log('leaf completed');\n`)
    await f.save()
    f.base = commit(f.repo)
    if (policy === 'previous') {
      if (change === 'link destination') f.contract.documents.pop()
      else f.contract.generators = []
      await f.save()
    }
    await writeFile(join(f.repo, 'src/change.mjs'), 'export const price = 12;;\n')
    commit(f.repo)
    await bindReview(f)
    const before = await readFile(join(f.repo, assessmentPath))
    const result = check(f)
    assert.equal(result.exit, code ? 1 : 0, JSON.stringify(result))
    if (code) assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result))
    const saved = JSON.parse(await readFile(result.data.path, 'utf8'))
    assert.equal(saved.data.checks.length, 1)
    assert.equal(saved.data.checks[0].execution.exitCode, 0)
    assert.equal(saved.data.checks[0].execution.stdout, 'leaf completed\n')
    assert.equal(await readFile(f.env.BSTACK_LEAF_LOG, 'utf8'), 'run\n')
    assert.deepEqual(await readFile(join(f.repo, assessmentPath)), before)
  })
}

test('portable initial foundation survives cloning while revision and selection remain required', async t => {
  const f = await fixture(t, { initial: true })
  const local = check(f)
  assert.equal(local.exit, 0, JSON.stringify(local))
  const before = await readFile(join(f.repo, assessmentPath))
  const clone = join(f.directory, 'clone')
  git(f.directory, 'clone', '-q', '--no-local', f.repo, clone)
  f.repo = clone
  const clean = check(f)
  assert.equal(clean.exit, 0, JSON.stringify(clean))
  assert.equal(clean.data.fingerprint, local.data.fingerprint)
  assert.deepEqual(await readFile(join(clone, assessmentPath)), before)
  f.assessment.foundation.record.target.revision = f.base
  await f.write()
  assert.ok(check(f).problems.some(problem => problem.code === 'unselected-foundation'))
  f.assessment.foundation.record.target.revision = f.assessment.head
  f.assessment.foundation.record.selectedFindingIds = []
  f.assessment.foundation.record.findings[0].status = 'proposed'
  await f.write()
  assert.ok(check(f).problems.some(problem => problem.code === 'unselected-foundation'))
})

test('repository and assessment aliases preserve portable review identity', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t)
  const direct = check(f)
  assert.equal(direct.exit, 0, JSON.stringify(direct))
  const alias = join(f.directory, 'alias')
  await symlink(f.repo, alias, 'dir')
  f.repo = alias
  const aliased = check(f)
  assert.equal(aliased.exit, 0, JSON.stringify(aliased))
  assert.equal(aliased.data.fingerprint, direct.data.fingerprint)
  assert.equal(aliased.data.checks.length, 1)
  const validated = run('evidence validate', alias, f.env, ['--base', f.base, '--assessment', join(alias, assessmentPath)])
  assert.equal(validated.data.fingerprint, direct.data.fingerprint, JSON.stringify(validated))
  assert.ok(!validated.problems.some(problem => problem.code === 'portable-source-mismatch'))
})

for (const policy of ['document', 'generator']) test(`removed ${policy} registration cannot bypass previous structural coverage`, async t => {
  const f = await fixture(t)
  if (policy === 'document') {
    await writeFile(join(f.repo, 'GUIDE.md'), '# Source\n[Target](link-target.md)\n')
    await writeFile(join(f.repo, 'link-target.md'), '# Target\n')
    f.contract.documents.push({ id: 'guide', path: 'GUIDE.md' })
  } else {
    await writeFile(join(f.repo, 'facts.txt'), 'old\n')
    await writeFile(join(f.repo, 'generate.mjs'), "import { readFileSync } from 'node:fs'; process.stdout.write(readFileSync('facts.txt', 'utf8'))\n")
    await writeFile(join(f.repo, 'GUIDE.md'), '# Source\n<!-- bstack:generated facts -->old\n<!-- bstack:end -->\n')
    f.contract.generators.push({ id: 'facts', command: { executable: 'node', args: ['generate.mjs'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['facts.txt'], outputPaths: ['GUIDE.md'] })
  }
  await f.save()
  f.base = commit(f.repo)
  const command = policy === 'document' ? 'docs check' : 'docs generate'
  const extra = policy === 'document' ? [] : ['--check']
  assert.equal(run(command, f.repo, f.env, extra).exit, 0)
  if (policy === 'document') {
    f.contract.documents.pop()
    await rm(join(f.repo, 'link-target.md'))
  } else {
    f.contract.generators = []
    await writeFile(join(f.repo, 'facts.txt'), 'new\n')
  }
  await f.save()
  commit(f.repo)
  const collected = run('evidence collect', f.repo, f.env, ['--base', f.base, '--portable', assessmentPath])
  assert.equal(collected.exit, 0, JSON.stringify(collected))
  f.assessment = JSON.parse(await readFile(collected.data.path, 'utf8'))
  f.assessment.coverage = ['boundary']
  f.complete()
  await f.write()
  const bound = run('evidence validate', f.repo, f.env, ['--base', f.base, '--assessment', join(f.repo, assessmentPath)])
  assert.ok(bound.data.fingerprint, JSON.stringify(bound))
  f.assessment.fingerprint = bound.data.fingerprint
  await f.write()
  commit(f.repo)
  assert.equal(run(command, f.repo, f.env, extra).exit, 0)
  const result = check(f)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.equal(result.data.phase, 'preflight')
  assert.equal(result.inputs.contract, '.bstack/project.json')
  assert.ok(result.problems.some(problem => problem.path === 'GUIDE.md' && problem.code ===
    (policy === 'document' ? 'broken-local-link' : 'stale-generated-section')), JSON.stringify(result))
  await assert.rejects(readFile(f.env.BSTACK_LEAF_LOG), { code: 'ENOENT' })
})

test('portable initialized submodule fingerprints survive cloning and retain content coverage', async t => {
  const f = await fixture(t, { submodule: true })
  const local = check(f)
  assert.equal(local.exit, 0, JSON.stringify(local))
  const source = f.repo
  const clone = join(f.directory, 'clone')
  git(f.directory, '-c', 'protocol.file.allow=always', 'clone', '-q', '--no-local', '--recurse-submodules', source, clone)
  f.repo = clone
  await chmod(join(clone, 'vendor/content.txt'), 0o600)
  const clean = check(f)
  assert.equal(clean.exit, 0, JSON.stringify(clean))
  assert.equal(clean.data.fingerprint, local.data.fingerprint)
  const options = { baseCommit: f.base, paths: ['vendor'], inputs: { repo: '.' } }
  const before = await fingerprint({ root: clone }, options)
  await writeFile(join(clone, 'vendor/content.txt'), 'changed module\n')
  const after = await fingerprint({ root: clone }, options)
  assert.notEqual(after.fingerprint, before.fingerprint)
})

test('final validation failure preserves fresh failed leaf diagnostics', async t => {
  const f = await fixture(t, { diagnostic: true })
  const result = check(f)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.ok(result.problems.some(problem => problem.code === 'portable-source-mismatch'))
  assert.equal(result.data.phase, 'result-validation')
  const saved = JSON.parse(await readFile(result.data.path, 'utf8'))
  assert.equal(saved.status, 'failed')
  assert.deepEqual(saved.problems, result.problems)
  assert.equal(saved.data.checks[0].execution.exitCode, 1)
  assert.equal(saved.data.checks[0].execution.stdout, 'leaf diagnostic\n')
})

test('portable executable files and directory scopes survive clone permissions', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t, { submodule: true, portableModes: true })
  const local = check(f)
  assert.equal(local.exit, 0, JSON.stringify(local))
  const clone = join(f.directory, 'clone')
  git(f.directory, '-c', 'protocol.file.allow=always', 'clone', '-q', '--no-local', '--recurse-submodules', f.repo, clone)
  f.repo = clone
  await chmod(join(clone, 'src'), 0o755)
  await chmod(join(clone, 'src/change.mjs'), 0o755)
  await chmod(join(clone, 'vendor'), 0o755)
  await chmod(join(clone, 'vendor/content.txt'), 0o755)
  const clean = check(f)
  assert.equal(clean.exit, 0, JSON.stringify(clean))
  assert.equal(clean.data.fingerprint, local.data.fingerprint)
  const options = { baseCommit: f.base, paths: ['vendor'], inputs: { repo: '.' } }
  const before = await fingerprint({ root: clone }, options)
  await chmod(join(clone, 'vendor/content.txt'), 0o644)
  assert.notEqual((await fingerprint({ root: clone }, options)).fingerprint, before.fingerprint)
})

test('execution exception preserves diagnostics from the preceding failed leaf', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t, { executionError: true })
  const result = check(f)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.ok(result.problems.some(problem => problem.code === 'unresolved-path'), JSON.stringify(result))
  const saved = JSON.parse(await readFile(result.data.path, 'utf8'))
  assert.equal(saved.status, 'failed')
  assert.deepEqual(saved.problems, result.problems)
  assert.equal(saved.data.checks.length, 1)
  assert.equal(saved.data.checks[0].execution.exitCode, 1)
  assert.equal(saved.data.checks[0].execution.stdout, 'first leaf diagnostic\n')
})

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

for (const change of ['scope widening', 'scope narrowing', 'command replacement']) test(`policy ${change} preserves coverage with one execution per command`, async t => {
  const f = await fixture(t)
  if (change === 'scope widening') f.contract.checks[0].inputScopes.push('extra/**')
  if (change === 'scope narrowing') f.contract.checks[0].inputScopes = ['src/change.mjs']
  if (change === 'command replacement') f.contract.checks[0].command.args.push('changed')
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
  assert.equal(result.data.previous.data.checks.length, 2)
  assert.equal(result.data.checks.length, 2)
  assert.deepEqual(result.data.checks.map(record => record.check.inputScopes), [f.contract.checks[0].inputScopes, ['src/**']])
  assert.ok(result.data.checks.every(record => record.execution.status === 'passed'))
  assert.equal(await readFile(f.env.BSTACK_LEAF_LOG, 'utf8'), change === 'command replacement' ? 'run\nrun\n' : 'run\n')
})

for (const phase of ['current', 'comparison']) test(`${phase} invocation rejects assessment byte changes and retains execution diagnostics`, async t => {
  const f = await fixture(t, { formatAssessment: true, policyChange: phase === 'comparison' })
  const before = await readFile(join(f.repo, assessmentPath), 'utf8')
  const result = check(f)
  assert.equal(result.exit, 2, JSON.stringify(result))
  assert.ok(result.problems.some(problem => problem.code === 'assessment-not-committed'), JSON.stringify(result))
  const after = await readFile(join(f.repo, assessmentPath), 'utf8')
  assert.notEqual(after, before)
  assert.deepEqual(JSON.parse(after), JSON.parse(before))
  const saved = JSON.parse(await readFile(result.data.path, 'utf8'))
  assert.equal(saved.status, 'blocked')
  assert.equal(saved.data.checks.length, 1)
  assert.equal(saved.data.checks[0].execution.exitCode, 0)
  assert.equal(saved.data.checks[0].execution.stdout, 'assessment formatted\n')
  assert.equal(result.data.phase, phase === 'comparison' ? 'previous-policy' : 'result-validation')
})

test('checker requires explicit inputs and accepts only its documented options', async t => {
  const f = await fixture(t)
  assert.equal(check(f, ['--workspace', f.repo]).exit, 3)
  const result = spawnSync(process.execPath, [join(f.repo, checkerPath), '--repo', f.repo, '--json'], { encoding: 'utf8' })
  assert.equal(result.status, 3)
})
