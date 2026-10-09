import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, rm, symlink, writeFile, watch } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { emptyRepo, build, run, snapshot } from './discovery-fixture.mjs'

// Exercise the installed CLI from an unrelated directory with isolated cache evidence.
const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function hash(value) { return createHash('sha256').update(value).digest('hex') }

function check(id, code = 'console.log("passed")', extra = {}) {
  return { id, role: 'outcome', required: true, acceptanceCases: ['flow'], inputScopes: ['product.txt'],
    command: { executable: 'node', args: ['-e', code], cwd: '.', versionArgs: ['--version'] }, ...extra }
}

async function setup(t, checks = [check('journey')], changeKind = 'feature') {
  const { directory, repo } = await emptyRepo(t)
  const source = 'Approved acceptance: the checkout returns the agreed total.\n'
  await writeFile(join(repo, 'ACCEPTANCE.md'), source)
  await writeFile(join(repo, 'product.txt'), 'original')
  const plan = { schemaVersion: 1, changeKind,
    acceptanceSources: [{ id: 'requirements', path: 'ACCEPTANCE.md', contentHash: hash(source) }],
    acceptanceCases: [{ id: 'flow', sourceId: 'requirements', pointer: 'Approved acceptance:', outcome: 'Checkout returns the agreed total.', userJourney: true }], checks }
  const path = join(directory, 'plan.json')
  const env = { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  delete env.NODE_TEST_CONTEXT
  const invoke = async (extra = []) => {
    await writeFile(path, JSON.stringify(plan))
    return run('run-checks', repo, env, ['--plan', path, ...extra])
  }
  return { repo, directory, plan, path, env, invoke }
}

test('capture records literal arguments, output tails, versions, fingerprint and acceptance coverage without target writes', async t => {
  const args = ['日本語 spaces', '$HOME', '$(touch injected)', '; touch injected', '%PATH%', '&echo wrong']
  const f = await setup(t, [check('journey', 'console.log(JSON.stringify(process.argv.slice(1))); console.error("diagnostic")')])
  f.plan.checks[0].command.args.push(...args)
  const original = await snapshot(f.repo)
  const result = await f.invoke()
  assert.equal(result.exit, 0)
  assert.equal(result.data.coverage[0].status, 'passed')
  const captured = result.data.checks[0]
  assert.deepEqual(JSON.parse(captured.execution.stdout), args)
  assert.equal(captured.execution.stderr, 'diagnostic\n')
  assert.equal(captured.execution.exitCode, 0)
  assert.equal(captured.execution.toolVersion.stdout.trim(), process.version)
  assert.match(result.data.originalState.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(result.data.originalState.fingerprint, result.data.finalState.fingerprint)
  const saved = JSON.parse(await readFile(result.data.path, 'utf8'))
  assert.equal(saved.runId, result.data.runId)
  assert.equal(saved.checks[0].order, 1)
  assert.deepEqual(await snapshot(f.repo), original)
})

for (const phase of ['before', 'after']) {
  test(`${phase} capture rejects scratch inside the target before any command executes`, { skip: process.platform === 'darwin' }, async t => {
    const f = await setup(t, [check('journey', 'require("node:fs").writeFileSync("check-executed", "")', { role: 'protection' })])
    f.plan.checks[0].command.versionArgs = ['-e', 'require("node:fs").writeFileSync("version-executed", "")']
    await writeFile(f.path, JSON.stringify(f.plan))
    const original = await snapshot(f.repo)
    const result = run('run-checks', f.repo, { ...f.env, XDG_CACHE_HOME: f.repo, LOCALAPPDATA: f.repo }, ['--plan', f.path, '--phase', phase])
    assert.equal(result.exit, 2)
    assert.equal(result.problems[0].code, 'scratch-inside-target')
    assert.deepEqual(await snapshot(f.repo), original)
  })
}

test('ts-shop passing units cannot hide the failed checkout journey', async t => {
  const f = await setup(t)
  const repo = build(t, 'ts-shop')
  const source = await readFile(join(repo, 'DESIGN.md'))
  f.plan.acceptanceSources[0] = { id: 'requirements', path: 'DESIGN.md', contentHash: hash(source) }
  f.plan.acceptanceCases[0].pointer = source.toString().split('\n').find(line => line.trim())
  f.plan.checks = [check('units'), check('journey')]
  f.plan.checks[0].command.args = ['--test', 'unit.test.mjs']
  f.plan.checks[1].command.args = ['journey.mjs']
  f.plan.checks.forEach(item => { item.inputScopes = ['packages/**', 'unit.test.mjs', 'journey.mjs', 'package.json'] })
  await writeFile(f.path, JSON.stringify(f.plan))
  const result = run('run-checks', repo, f.env, ['--plan', f.path])
  assert.equal(result.exit, 1)
  assert.equal(result.data.checks[0].status, 'passed')
  assert.equal(result.data.checks[1].status, 'failed')
  assert.equal(result.data.coverage[0].status, 'failed')
  assert.match(result.data.journeyCoverage, /No user journey/)
})

for (const [name, modify, expected] of [
  ['failed', c => { c.command.args = ['-e', 'console.error("failure"); process.exit(7)'] }, 'failed'],
  ['skipped', c => { c.skipReason = 'Browser unavailable.' }, 'unverified'],
  ['unavailable', c => { c.command.executable = 'bstack-nonexistent-tool' }, 'blocked'],
  ['timed out', c => { c.command.args = ['-e', 'setInterval(() => {}, 1000)']; c.command.timeoutMs = 1000 }, 'failed'],
  ['failed version', c => { c.command.versionArgs = ['-e', 'process.exit(8)'] }, 'failed']
]) {
  test(`${name} required check cannot pass and does not verify the user flow`, async t => {
    const f = await setup(t)
    modify(f.plan.checks[0])
    const result = await f.invoke()
    assert.notEqual(result.status, 'passed')
    assert.equal(result.data.checks[0].status, expected)
    assert.notEqual(result.data.coverage[0].status, 'passed')
    if (name === 'timed out') {
      assert.equal(result.data.checks[0].execution.timedOut, true)
      assert.equal(result.data.coverage[0].status, 'unverified')
    }
    if (name === 'skipped') assert.equal(result.data.coverage[0].status, 'unverified')
  })
}

test('cancelled required check stays unverified even with other passing checks', { timeout: 10000 }, async t => {
  const f = await setup(t, [check('units'), check('journey')])
  const ready = join(f.directory, 'ready')
  f.plan.checks[1].command.args = ['-e', 'require("node:fs").writeFileSync(process.argv[1], ""); setInterval(() => {}, 1000)', ready]
  await writeFile(f.path, JSON.stringify(f.plan))
  const controller = new AbortController()
  const watcher = watch(f.directory, { signal: controller.signal })
  const child = spawn(process.execPath, [join(checkout, 'skills/repo-audit/scripts/repo-audit.mjs'), 'run-checks', '--repo', f.repo, '--plan', f.path, '--json'], { env: f.env, stdio: ['ignore', 'pipe', 'pipe'] })
  t.after(() => { controller.abort(); child.kill('SIGKILL') })
  let stdout = ''
  child.stdout.on('data', chunk => { stdout += chunk })
  const done = new Promise(resolve => child.on('close', resolve))
  for await (const event of watcher) {
    if (event.filename === 'ready') { child.kill('SIGINT'); controller.abort(); break }
  }
  assert.equal(await done, 2)
  const result = JSON.parse(stdout)
  assert.equal(result.data.checks[0].status, 'passed')
  assert.equal(result.data.checks[1].execution.cancelled, true)
  assert.equal(result.data.checks[1].satisfied, false)
  assert.equal(result.data.coverage[0].status, 'unverified')
})

test('a checker that changes its own unscoped file blocks capture', async t => {
  const f = await setup(t)
  await writeFile(join(f.repo, 'check.mjs'), 'import { writeFileSync } from "node:fs"; writeFileSync("check.mjs", "process.exit(0)\\n"); console.log("completed")\n')
  f.plan.checks[0].command.args = ['check.mjs']
  const result = await f.invoke()
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'inputs-changed-during-run')
  assert.equal(result.data.checks[0].execution.stdout, 'completed\n')
  assert.notEqual(result.data.originalState.fingerprint, result.data.finalState.fingerprint)
  assert.equal(result.data.coverage[0].status, 'unverified')
})

test('a result covering no user journey explicitly reports that limit', async t => {
  const f = await setup(t)
  f.plan.acceptanceCases[0].userJourney = false
  const result = await f.invoke()
  assert.equal(result.exit, 0)
  assert.match(result.data.journeyCoverage, /No user journey/)
})

test('an uncovered user flow remains unverified despite passing units', async t => {
  const f = await setup(t)
  f.plan.acceptanceCases.push({ ...f.plan.acceptanceCases[0], id: 'uncovered' })
  const result = await f.invoke()
  assert.equal(result.exit, 2)
  assert.equal(result.data.coverage[1].status, 'unverified')
})

for (const [name, mutation] of [
  ['own bytes', 'require("node:fs").writeFileSync("product.txt", "changed")'],
  ['new glob file', 'require("node:fs").writeFileSync("new.txt", "changed")'],
  ['deleted glob file', 'require("node:fs").unlinkSync("product.txt")']
]) {
  test(`changed ${name} block the capture`, async t => {
    const f = await setup(t, [check('journey', mutation, { inputScopes: ['*.txt'] })])
    const result = await f.invoke()
    assert.equal(result.exit, 2)
    assert.equal(result.data.checks[0].status, 'blocked')
    assert.notEqual(result.data.originalState.fingerprint, result.data.finalState.fingerprint)
    assert.equal(result.problems[0].code, 'inputs-changed-during-run')
  })
}

test('a later input change blocks all executed checks', async t => {
  const f = await setup(t, [check('journey'), check('later', 'require("node:fs").writeFileSync("product.txt", "changed")', { inputScopes: ['other.txt'] })])
  const result = await f.invoke()
  assert.equal(result.exit, 2)
  assert.deepEqual(result.data.checks.map(item => item.status), ['blocked', 'blocked'])
  assert.deepEqual(result.data.checks.map(item => item.execution.exitCode), [0, 0])
})

test('inputs restored before completion leave the boundary fingerprints equal', async t => {
  const f = await setup(t, [check('change', 'require("node:fs").writeFileSync("product.txt", "changed")'),
    check('restore', 'require("node:fs").writeFileSync("product.txt", "original")')])
  const result = await f.invoke()
  assert.equal(result.exit, 0)
  assert.equal(result.data.originalState.fingerprint, result.data.finalState.fingerprint)
  assert.deepEqual(result.data.checks.map(item => item.status), ['passed', 'passed'])
})

test('changed inputs block the capture even when a command also fails', async t => {
  const f = await setup(t, [check('journey', 'require("node:fs").writeFileSync("product.txt", "changed"); process.exit(7)')])
  const result = await f.invoke()
  assert.equal(result.exit, 2)
  assert.equal(result.status, 'blocked')
  assert.equal(result.problems[0].message, 'inputs changed during run')
  assert.equal(result.data.checks[0].execution.exitCode, 7)
  assert.equal(result.data.coverage[0].status, 'unverified')
})

for (const [input, pathFor, replacements] of [
  ['product file', f => join(f.repo, 'product.txt'), [
    ['directory', 'fs.mkdirSync(process.argv[1])', false],
    ['dangling link', 'fs.symlinkSync("missing.txt", process.argv[1])', process.platform === 'win32']
  ]],
  ['acceptance source', f => join(f.repo, 'ACCEPTANCE.md'), [
    ['directory', 'fs.mkdirSync(process.argv[1])', false],
    ['dangling link', 'fs.symlinkSync("missing.txt", process.argv[1])', process.platform === 'win32']
  ]],
  ['plan', f => f.path, [['directory', 'fs.mkdirSync(process.argv[1])', false]]]
]) {
  for (const [name, replacement, skip] of replacements) {
    test(`a ${input} replaced by a ${name} retains completed command evidence`, { skip }, async t => {
      const f = await setup(t, [check('first', 'console.log("completed")'), check('replace')])
      f.plan.checks[1].command.args = ['-e', `const fs = require("node:fs"); fs.unlinkSync(process.argv[1]); ${replacement}; console.log("replaced")`, pathFor(f)]
      const result = await f.invoke()
      assert.equal(result.exit, 2)
      assert.equal(result.status, 'blocked')
      assert.equal(result.problems[0].message, 'inputs changed during run')
      if (name === 'directory' && input !== 'plan') assert.notEqual(result.data.finalState.fingerprint, result.data.originalState.fingerprint)
      else assert.equal(result.data.finalState, null)
      assert.deepEqual(result.data.checks.map(item => item.execution.stdout), ['completed\n', 'replaced\n'])
      assert.deepEqual(result.data.checks.map(item => item.execution.exitCode), [0, 0])
      assert.equal(result.data.coverage[0].status, 'unverified')
      const saved = JSON.parse(await readFile(result.data.path, 'utf8'))
      assert.equal(saved.status, 'blocked')
      assert.deepEqual(saved.finalState, result.data.finalState)
      assert.deepEqual(saved.checks, result.data.checks)
    })
  }
}

for (const [name, mutation] of [
  ['edited', 'fs.writeFileSync(process.argv[1], fs.readFileSync(process.argv[1], "utf8") + "\\n")'],
  ['deleted', 'fs.unlinkSync(process.argv[1])']
]) {
  test(`an external plan ${name} during capture blocks results`, async t => {
    const f = await setup(t, [check('journey'), check('later')])
    f.plan.checks[1].command.args = ['-e', `const fs = require("node:fs"); ${mutation}`, f.path]
    const result = await f.invoke()
    assert.equal(result.exit, 2)
    assert.deepEqual(result.data.checks.map(item => item.status), ['blocked', 'blocked'])
    assert.equal(result.data.coverage[0].status, 'unverified')
  })
}

for (const [name, mutation] of [
  ['edited plan', 'fs.appendFileSync(process.argv[1], "\\n")'],
  ['deleted plan', 'fs.unlinkSync(process.argv[1])'],
  ['edited acceptance source', 'fs.writeFileSync("ACCEPTANCE.md", "changed")'],
  ['deleted acceptance source', 'fs.unlinkSync("ACCEPTANCE.md")']
]) {
  test(`an optional check's ${name} blocks the whole capture`, async t => {
    const f = await setup(t, [check('optional', undefined, { required: false, acceptanceCases: ['units'] }),
      check('journey', 'require("node:fs").writeFileSync("executed", "")')])
    f.plan.acceptanceCases.push({ ...f.plan.acceptanceCases[0], id: 'units', userJourney: false })
    f.plan.checks[0].command.args = ['-e', `const fs = require("node:fs"); ${mutation}`, f.path]
    const result = await f.invoke()
    assert.equal(result.exit, 2)
    assert.equal(result.data.checks[1].status, 'blocked')
    assert.equal(result.data.checks[1].execution.exitCode, 0)
    assert.equal(result.data.coverage[0].status, 'unverified')
  })
}

for (const [phase, otherChecks] of [['before', [check('after-only')]], ['after', []]]) {
  test(`${phase} capture with no active required check runs no commands`, async t => {
    const write = 'require("node:fs").writeFileSync("executed", "")'
    const f = await setup(t, [check('optional', write, { required: false, role: 'protection' }), ...otherChecks])
    f.plan.checks[0].command.versionArgs = ['-e', write]
    const original = await snapshot(f.repo)
    const result = await f.invoke(['--phase', phase])
    assert.notEqual(result.exit, 0)
    assert.ok(result.problems.some(item => item.code === 'no-required-checks'), JSON.stringify(result))
    assert.deepEqual(await snapshot(f.repo), original)
  })
}

for (const path of ['src/app/[id]/page.ts', 'src/{name}.ts', 'src/star*.ts', 'src/question?.ts']) {
  test(`glob capture fingerprints the literal file ${path}`, { skip: process.platform === 'win32' && /[*?]/.test(path) }, async t => {
    const f = await setup(t, [check('journey', undefined, { inputScopes: ['src/**'] })])
    await mkdir(dirname(join(f.repo, path)), { recursive: true })
    await writeFile(join(f.repo, path), 'original')
    const passed = await f.invoke()
    assert.equal(passed.exit, 0)
    assert.equal(passed.data.originalState.state.files.find(file => file.path === path).contentHash, hash('original'))
    f.plan.checks[0].command.args = ['-e', 'require("node:fs").writeFileSync(process.argv[1], "changed")', path]
    const changed = await f.invoke()
    assert.equal(changed.exit, 2)
    assert.equal(changed.data.checks[0].status, 'blocked')
  })
}

for (const [name, mutate, problem] of [
  ['file cwd', c => { c.cwd = 'product.txt' }, 'invalid-cwd'],
  ['missing cwd', c => { c.cwd = 'missing' }, 'invalid-cwd'],
  ['NUL executable', c => { c.executable += '\0' }, 'invalid-pattern'],
  ['NUL argument', c => { c.args.push('\0') }, 'invalid-pattern'],
  ['NUL version argument', c => { c.versionArgs.push('\0') }, 'invalid-pattern']
]) {
  test(`a later ${name} is rejected before any version probe or check runs`, async t => {
    const write = 'require("node:fs").writeFileSync("executed", "")'
    const f = await setup(t, [check('first', write), check('second')])
    f.plan.checks[0].command.versionArgs = ['-e', write]
    mutate(f.plan.checks[1].command)
    const original = await snapshot(f.repo)
    const result = await f.invoke()
    assert.notEqual(result.exit, 0)
    assert.ok(result.problems.some(item => item.code === problem), JSON.stringify(result))
    assert.deepEqual(await snapshot(f.repo), original)
  })
}

for (const [name, mutate, problem] of [
  ['unknown field', p => { p.unrecognised = true }, 'unknown-field'],
  ['duplicate check', p => { p.checks.push(p.checks[0]) }, 'duplicate-id'],
  ['missing case', p => { p.checks[0].acceptanceCases = ['missing'] }, 'missing-case-id'],
  ['missing source', p => { p.acceptanceCases[0].sourceId = 'missing' }, 'missing-source-id'],
  ['missing pointer', p => { p.acceptanceCases[0].pointer = 'nonexistent' }, 'missing-acceptance-pointer'],
  ['stale source', p => { p.acceptanceSources[0].contentHash = '0'.repeat(64) }, 'stale-acceptance-source'],
  ['unsafe scope', p => { p.checks[0].inputScopes = ['../outside'] }, 'invalid-glob'],
  ['unsafe cwd', p => { p.checks[0].command.cwd = '..' }, 'unsafe-path'],
  ['invalid timeout', p => { p.checks[0].command.timeoutMs = 0 }, 'invalid-timeout'],
  ['string command', p => { p.checks[0].command = 'npm test' }, 'invalid-type'],
  ['agent execution claim', p => { p.checks[0].execution = { status: 'passed' } }, 'unknown-field']
]) {
  test(`invalid ${name} is rejected before any command runs`, async t => {
    const f = await setup(t, [check('journey', 'require("node:fs").writeFileSync("executed", "")')])
    mutate(f.plan)
    const original = await snapshot(f.repo)
    const result = await f.invoke()
    assert.notEqual(result.exit, 0)
    assert.ok(result.problems.some(item => item.code === problem), JSON.stringify(result))
    assert.deepEqual(await snapshot(f.repo), original)
  })
}

function refactorChecks() {
  const behaviour = 'require("node:assert/strict").equal(require("./product.cjs").total(2), 20)'
  return [check('protect', behaviour, { role: 'protection', inputScopes: ['product.cjs'] }),
    check('compatibility', behaviour, { role: 'compatibility', inputScopes: ['product.cjs'] })]
}

async function refactor(t) {
  const fixture = await setup(t, refactorChecks(), 'refactor')
  await writeFile(join(fixture.repo, 'product.cjs'), 'exports.total = count => count * 10\n')
  return fixture
}

test('a refactor without prior protective capture is rejected before compatibility runs', async t => {
  const f = await refactor(t)
  const result = await f.invoke()
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'missing-prior-evidence')
  assert.ok(result.data.checks.every(item => item.execution === null))
})

test('before protection with a retyped input cannot serve as prior evidence', async t => {
  const f = await refactor(t)
  f.plan.checks[0].command.args = ['-e', 'const fs = require("node:fs"); fs.unlinkSync("product.cjs"); fs.mkdirSync("product.cjs"); console.log("completed")']
  const before = await f.invoke(['--phase', 'before'])
  assert.equal(before.exit, 2)
  assert.notEqual(before.data.finalState.fingerprint, before.data.originalState.fingerprint)
  assert.equal(before.data.checks[0].execution.stdout, 'completed\n')
  await rm(join(f.repo, 'product.cjs'), { recursive: true })
  await writeFile(join(f.repo, 'product.cjs'), 'exports.total = count => 10 * count\n')
  const after = await f.invoke(['--prior-run', before.data.runId])
  assert.equal(after.exit, 2)
  assert.equal(after.problems[0].code, 'missing-prior-evidence')
  assert.ok(after.data.checks.every(item => item.execution === null))
})

for (const [kind, role, code, additionalChecks] of [
  ['refactor', 'protection', 'console.log("protected")', [check('compatibility', undefined, { role: 'compatibility' })]],
  ['bug-fix', 'reproduction', 'process.exit(1)', []]
]) {
  for (const [name, mutation, inputScopes, skip] of [
    ['changed bytes', 'fs.writeFileSync("product.txt", "changed")', ['product.txt'], false],
    ['changed mode', 'fs.chmodSync("product.txt", 0o755)', ['product.txt'], process.platform === 'win32'],
    ['new glob file', 'fs.writeFileSync("product-new.txt", "new")', ['product*.txt'], false],
    ['deleted glob file', 'fs.unlinkSync("product.txt")', ['product*.txt'], false],
    ['created absent literal', 'fs.writeFileSync("product-new.txt", "new")', ['product.txt', 'product-new.txt'], false]
  ]) {
    test(`before ${role} capture is blocked by ${name} from an optional check`, { skip }, async t => {
      const f = await setup(t, [check('optional', `const fs = require("node:fs"); ${mutation}`,
        { role: 'protection', required: false, inputScopes: ['other.txt'], acceptanceCases: ['units'] }),
      check('required', code, { role, inputScopes }), ...additionalChecks], kind)
      f.plan.acceptanceCases.push({ ...f.plan.acceptanceCases[0], id: 'units', userJourney: false })
      const before = await f.invoke(['--phase', 'before'])
      assert.equal(before.exit, 2)
      assert.equal(before.data.checks[0].status, 'blocked')
      assert.equal(before.data.checks[1].status, 'blocked')
      assert.equal(before.data.checks[1].satisfied, false)
      assert.ok(before.data.checks[1].execution)
      assert.equal(before.problems[0].code, 'inputs-changed-during-run')
      const after = await f.invoke(['--prior-run', before.data.runId])
      assert.equal(after.exit, 2)
      assert.equal(after.problems[0].code, 'missing-prior-evidence')
      assert.ok(after.data.checks.every(item => item.execution === null))
    })
  }
}

test('before capture includes glob inputs and another check’s absent literal', async t => {
  const f = await setup(t, [check('optional', undefined, { role: 'protection', required: false, inputScopes: ['other.txt'] }),
    check('protect', undefined, { role: 'protection', inputScopes: ['*.txt'] }),
    check('compatibility', undefined, { role: 'compatibility' })], 'refactor')
  const before = await f.invoke(['--phase', 'before'])
  assert.equal(before.exit, 0)
  assert.equal(before.data.checks[1].status, 'passed')
  assert.equal(before.data.checks[1].satisfied, true)
})

for (const [name, path, prepare, expected, skip] of [
  ['excluded build output', 'dist/app.js', async repo => {
    await mkdir(join(repo, 'dist'))
    await writeFile(join(repo, 'dist/app.js'), 'built')
  }, 'built', false],
  ['explicit symlink', 'linked.txt', async repo => {
    await symlink('product.txt', join(repo, 'linked.txt'))
  }, 'original', process.platform === 'win32']
]) {
  test(`capture combines glob discovery with ${name} from a literal scope`, { skip }, async t => {
    const f = await refactor(t)
    await prepare(f.repo)
    f.plan.checks[0].inputScopes = ['**']
    f.plan.checks[1].inputScopes = [path]
    const before = await f.invoke(['--phase', 'before'])
    assert.equal(before.exit, 0)
    assert.equal(before.data.originalState.state.files.find(file => file.path === path).contentHash, hash(expected))
    assert.equal(before.data.originalState.fingerprint, before.data.finalState.fingerprint)
    await writeFile(join(f.repo, 'product.cjs'), 'exports.total = count => 10 * count\n')
    const after = await f.invoke(['--prior-run', before.data.runId])
    assert.equal(after.exit, 0)
  })
}

test('before capture blocks changes to an inactive check’s declared inputs', async t => {
  const f = await refactor(t)
  await mkdir(join(f.repo, 'dist'))
  await writeFile(join(f.repo, 'dist/app.js'), 'built')
  f.plan.checks[1].inputScopes = ['dist/app.js']
  f.plan.checks.unshift(check('optional', 'require("node:fs").writeFileSync("dist/app.js", "changed")',
    { role: 'protection', required: false, inputScopes: ['other.txt'] }))
  const before = await f.invoke(['--phase', 'before'])
  assert.equal(before.exit, 2)
  assert.equal(before.problems[0].code, 'inputs-changed-during-run')
  assert.equal(before.data.checks[1].execution.exitCode, 0)
  assert.equal(before.data.checks[1].satisfied, false)
  assert.equal(before.data.checks[2].execution, null)
})

test('prior protection requires matching original and final snapshots', async t => {
  const f = await refactor(t)
  const original = await f.invoke(['--phase', 'before'])
  await writeFile(join(f.repo, 'product.cjs'), 'exports.total = count => 10 * count\n')
  const changed = await f.invoke(['--phase', 'before'])
  assert.equal(changed.exit, 0)
  const saved = JSON.parse(await readFile(changed.data.path, 'utf8'))
  saved.originalState = original.data.originalState
  await writeFile(changed.data.path, JSON.stringify(saved))
  const after = await f.invoke(['--prior-run', changed.data.runId])
  assert.equal(after.exit, 2)
  assert.equal(after.problems[0].code, 'missing-prior-evidence')
  assert.ok(after.data.checks.every(item => item.execution === null))
})

test('a protected refactor passes only after compatibility runs against changed state', async t => {
  const f = await refactor(t)
  const before = await f.invoke(['--phase', 'before'])
  assert.equal(before.exit, 0)
  assert.equal(before.data.checks[1].status, 'unverified')
  const unchanged = await f.invoke(['--prior-run', before.data.runId])
  assert.equal(unchanged.exit, 2)
  assert.equal(unchanged.problems[0].code, 'unchanged-original-state')
  await writeFile(join(f.repo, 'product.cjs'), 'const unitPrice = 10\nexports.total = count => unitPrice * count\n')
  const after = await f.invoke(['--prior-run', before.data.runId])
  assert.equal(after.exit, 0)
  assert.equal(after.data.checks[1].execution.exitCode, 0)
  assert.equal(after.data.checks[1].status, 'passed')
  assert.deepEqual(after.data.executionOrder, [before.data.runId, after.data.runId])
  assert.ok(before.data.completedAt <= after.data.startedAt)
  assert.equal(before.data.originalState.state.files.find(file => file.path === 'product.cjs').contentHash, hash('exports.total = count => count * 10\n'))
  assert.notEqual(after.data.originalState.fingerprint, before.data.originalState.fingerprint)
})

for (const [name, mutate] of [
  ['failed protection', p => { p.checks[0].command.args = ['-e', 'process.exit(1)'] }],
  ['skipped protection', p => { p.checks[0].skipReason = 'Unavailable.' }]
]) {
  test(`${name} cannot establish prior refactor evidence`, async t => {
    const f = await refactor(t)
    mutate(f.plan)
    const before = await f.invoke(['--phase', 'before'])
    assert.notEqual(before.exit, 0)
    await writeFile(join(f.repo, 'product.txt'), 'changed')
    const after = await f.invoke(['--prior-run', before.data.runId])
    assert.equal(after.exit, 2)
    assert.equal(after.problems[0].code, 'missing-prior-evidence')
  })
}

test('changing the check plan cannot reuse prior protection', async t => {
  const f = await refactor(t)
  const before = await f.invoke(['--phase', 'before'])
  await writeFile(join(f.repo, 'product.txt'), 'changed')
  f.plan.checks[0].command.args = ['-e', 'console.log("different protection")']
  const after = await f.invoke(['--prior-run', before.data.runId])
  assert.equal(after.exit, 2)
  assert.equal(after.problems[0].code, 'missing-prior-evidence')
})

test('after capture cannot pretend to be prior refactor protection', async t => {
  const f = await refactor(t)
  const before = await f.invoke(['--phase', 'before'])
  await writeFile(join(f.repo, 'product.cjs'), 'exports.total = count => 10 * count\n')
  const after = await f.invoke(['--prior-run', before.data.runId])
  await writeFile(join(f.repo, 'product.txt'), 'changed again')
  const reused = await f.invoke(['--prior-run', after.data.runId])
  assert.equal(reused.exit, 2)
  assert.equal(reused.problems[0].code, 'missing-prior-evidence')
})

test('compatibility failure prevents a protected refactor from passing', async t => {
  const f = await setup(t, [check('protect', undefined, { role: 'protection' }), check('compat', 'process.exit(3)', { role: 'compatibility' })], 'refactor')
  const before = await f.invoke(['--phase', 'before'])
  await writeFile(join(f.repo, 'product.txt'), 'changed')
  const after = await f.invoke(['--prior-run', before.data.runId])
  assert.equal(after.exit, 1)
  assert.equal(after.data.checks[1].status, 'failed')
})

test('bug fix requires normally failing reproduction before and passing reproduction after', async t => {
  const f = await setup(t, [check('reproduce', 'process.exit(require("node:fs").readFileSync("product.txt", "utf8") === "fixed" ? 0 : 1)', { role: 'reproduction' })], 'bug-fix')
  const missing = await f.invoke()
  assert.equal(missing.exit, 2)
  const before = await f.invoke(['--phase', 'before'])
  assert.equal(before.exit, 0)
  assert.equal(before.data.checks[0].execution.exitCode, 1)
  assert.equal(before.data.checks[0].satisfied, true)
  assert.equal(before.data.coverage[0].status, 'failed')
  assert.match(before.data.journeyCoverage, /No user journey/)
  await writeFile(join(f.repo, 'product.txt'), 'fixed')
  const after = await f.invoke(['--prior-run', before.data.runId])
  assert.equal(after.exit, 0)
  assert.equal(after.data.checks[0].execution.exitCode, 0)
  assert.equal(after.data.coverage[0].status, 'passed')
})

test('passing reproduction before change cannot satisfy the bug prerequisite', async t => {
  const f = await setup(t, [check('reproduce', undefined, { role: 'reproduction' })], 'bug-fix')
  const before = await f.invoke(['--phase', 'before'])
  assert.notEqual(before.exit, 0)
  assert.equal(before.data.checks[0].satisfied, false)
})

for (const [name, modify] of [
  ['timeout', c => { c.command.args = ['-e', 'setInterval(() => {}, 1000)']; c.command.timeoutMs = 1000 }],
  ['version failure', c => { c.command.versionArgs = ['-e', 'process.exit(1)'] }],
  ['unavailable tool', c => { c.command.executable = 'bstack-nonexistent-tool' }]
]) {
  test(`a reproduction ${name} is not a recorded bug`, async t => {
    const f = await setup(t, [check('reproduce', undefined, { role: 'reproduction' })], 'bug-fix')
    modify(f.plan.checks[0])
    const before = await f.invoke(['--phase', 'before'])
    assert.notEqual(before.exit, 0)
    assert.equal(before.data.checks[0].satisfied, false)
  })
}

for (const [kind, role, code] of [
  ['bug-fix', 'reproduction', 'missing-reproduction'],
  ['refactor', 'protection', 'missing-protection'],
  ['refactor', 'compatibility', 'missing-compatibility']
]) {
  test(`${kind} requires a required ${role} check in its plan`, async t => {
    const f = await setup(t, kind === 'refactor' ? refactorChecks() : [check('reproduce', undefined, { role: 'reproduction' })], kind)
    f.plan.checks.find(item => item.role === role).required = false
    const result = await f.invoke()
    assert.equal(result.exit, 1)
    assert.ok(result.problems.some(item => item.code === code))
  })
}
