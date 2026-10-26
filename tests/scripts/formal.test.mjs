import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, git, runFormal, runMaintenance, snapshot } from './discovery-fixture.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = join(root, 'skills/formal-verification/scripts/formal-verification.mjs')
const fixtures = join(root, 'tests/fixtures')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const suite = '.agents/skills/formal-charge-once'
// The pinned jar the fixtures document, so a different file can never stand in for the model checker.
const pinnedJar = '15d103b7e5617780bcc904c0af12f1ad242e2b345c0301136c5be4588f17edac'
const violation = 'Invariant NoDoubleCharge is violated'

// The real model checker is the project's own tool, so these tests use it only where the environment supplies the pinned file and Java.
async function modelChecker() {
  const path = process.env.BSTACK_TLA2TOOLS_JAR
  if (!path) return { skip: 'Set BSTACK_TLA2TOOLS_JAR to the pinned tla2tools.jar to run the model checker.' }
  const java = spawnSync('java', ['-version'], { encoding: 'utf8' })
  if (java.error || java.status !== 0) return { skip: 'No Java runtime on PATH.' }
  const bytes = await readFile(path).catch(() => null)
  if (bytes === null || sha256(bytes) !== pinnedJar) return { skip: `${path} is not the pinned tla2tools.jar.` }
  return { path }
}

// The violation fixture overlays only the model, so both models share the clean fixture's configuration.
async function modelFiles(tla) {
  return Promise.all([['ChargeOnce.tla', tla], ['ChargeOnce.cfg', 'formal-charge-once/formal/ChargeOnce.cfg']].map(async ([name, path]) => ({ name, content: await readFile(join(fixtures, path), 'utf8') })))
}

// The plan is what a create run writes after interviewing the fixture repo, with the model the fixture documents.
// A create run records the commit it proved the property against, so the plan carries HEAD unless a test sets another.
async function plan(repo, { model, steps, tool, syncCommit = git(repo, 'rev-parse', 'HEAD') } = {}) {
  return {
    schemaVersion: 1, target: 'charge-once', description: 'Prove that an order is charged at most once however two workers interleave.',
    tool: { name: 'TLC', path: 'tools/tla2tools.jar', sha256: tool, version: '2026.10.15.145915 (rev: 932d35e)' },
    evidenceDirectory: '.formal-evidence/charge-once',
    properties: [{
      id: 'charge-once', title: 'Charge once', statement: 'However two workers interleave, an order is charged at most once.', harm: 'A customer is charged twice for one order.',
      design: { location: 'PROPERTY.md:5', state: { kind: 'sha256', value: sha256(await readFile(join(repo, 'PROPERTY.md'))) } },
      sourcePaths: ['src/charge.mjs'], ...(syncCommit && { syncCommit }), bounds: ['Two workers and one order.'], assumptions: ['store.compareAndSet is atomic, trusted from the store documentation.'],
      check: { command: ['java', '-cp', 'tools/tla2tools.jar', 'tlc2.TLC', '-noGenerateSpecTE', '-config', `${suite}/model/ChargeOnce.cfg`, '-workers', '1',
        '-metadir', '.formal-evidence/charge-once/states', `${suite}/model/ChargeOnce.tla`], violation },
      modelFiles: model ?? await modelFiles('formal-charge-once/formal/ChargeOnce.tla'),
      steps: steps ?? [
        { action: 'Claim(w)', code: 'src/charge.mjs:2', atomicBecause: 'compareAndSet reads and writes the status in one atomic store call' },
        { action: 'Charge(w)', code: 'src/charge.mjs:3', atomicBecause: 'one call to the payment gateway' },
        { action: 'Finish(w)', code: 'src/charge.mjs:4', atomicBecause: 'one write of the final status' }
      ]
    }]
  }
}

const brokenSteps = [
  { action: 'Read(w)', code: 'src/charge.mjs:2', atomicBecause: 'get only reads, so another worker can claim before this one writes' },
  { action: 'Claim(w)', code: 'src/charge.mjs:3', atomicBecause: 'one write of the claimed status' },
  { action: 'Charge(w)', code: 'src/charge.mjs:4', atomicBecause: 'one call to the payment gateway' },
  { action: 'Finish(w)', code: 'src/charge.mjs:5', atomicBecause: 'one write of the final status' }
]

async function setup(t, { jar } = {}) {
  const repo = build(t, 'formal-charge-once')
  const cache = await mkdtemp(join(tmpdir(), 'bstack formal cache '))
  t.after(() => rm(cache, { recursive: true, force: true }))
  const stub = Buffer.from('a stand-in for the pinned tool\n')
  await mkdir(join(repo, 'tools'))
  if (jar) await cp(jar, join(repo, 'tools/tla2tools.jar'))
  else await writeFile(join(repo, 'tools/tla2tools.jar'), stub)
  const env = { ...process.env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }
  const f = { repo, cache, env, tool: jar ? pinnedJar : sha256(stub), call: (command, extra = []) => runFormal(command, repo, env, extra) }
  f.plan = options => plan(repo, { tool: f.tool, ...options })
  f.write = async value => {
    const file = join(cache, 'suite-plan.json')
    await writeFile(file, JSON.stringify(value))
    return file
  }
  f.apply = async (value, extra = []) => {
    const scaffold = f.call('formal scaffold', ['--plan', await f.write(value), ...extra])
    assert.equal(scaffold.exit, 0, JSON.stringify(scaffold))
    if (scaffold.data.path) {
      const applied = f.call('apply', ['--plan', scaffold.data.path])
      assert.equal(applied.exit, 0, JSON.stringify(applied))
    }
    return scaffold
  }
  f.commit = message => {
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', message)
  }
  f.check = () => f.call('formal check', ['--suite', 'charge-once'])
  return f
}

const codes = result => result.problems.map(problem => problem.code)

for (const sourcePath of ['src', 's*', 'src/charge.mjs', 'src/*.mjs', 'src/**']) {
  test(`formal commands and the coverage gate agree that ${sourcePath} covers the charge code`, async t => {
    const f = await setup(t)
    const value = await f.plan()
    value.properties[0].sourcePaths = [sourcePath]
    await f.apply(value)
    assert.equal(f.check().exit, 0)
    const swept = runMaintenance('sweep', f.repo, f.env)
    assert.deepEqual(swept.problems.filter(problem => problem.fix === 'Run /formal-verification maintain.'), [])
    f.commit('Add the suite')
    git(f.repo, 'checkout', '-q', '-b', 'change')
    await changeSource(f)
    f.commit('Change charge')
    const gate = spawnSync(process.execPath, [join(f.repo, suite, 'scripts/map-coverage.mjs'), '--base', 'main'], { cwd: f.repo, encoding: 'utf8' })
    assert.equal(gate.status, 1, gate.stdout + gate.stderr)
    assert.match(gate.stdout, /formal-proof-coverage: src\/charge\.mjs changed without updating a model file/)
  })
}

test('sweep excludes the installed authoring skill and still detects an incomplete formal suite', async t => {
  const f = await setup(t)
  await f.apply(await f.plan())
  await cp(join(root, 'skills/formal-verification'), join(f.repo, '.agents/skills/formal-verification'), { recursive: true })
  const swept = runMaintenance('sweep', f.repo, f.env)
  assert.deepEqual(swept.problems.filter(problem => problem.fix === 'Run /formal-verification maintain.'), [])
  await mkdir(join(f.repo, '.agents/skills/formal-incomplete'))
  const broken = runMaintenance('sweep', f.repo, f.env)
  assert.deepEqual(broken.problems.filter(problem => problem.fix === 'Run /formal-verification maintain.').map(problem => problem.code), ['suite-unavailable'])
})

test('the formal-verification skill ships only the commands its procedure runs', () => {
  const result = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()).sort(), ['apply', 'cite-check', 'formal check', 'formal scaffold', 'rule-proof', 'state show'])
})

test('scaffold renders the suite, property files, transition table and model files from the plan and rejects a model step that cites no atomic code step', async t => {
  const f = await setup(t)
  const before = await snapshot(f.repo)
  const unatomic = await f.plan()
  unatomic.properties[0].steps[0].code = ''
  const rejected = f.call('formal scaffold', ['--plan', await f.write(unatomic)])
  assert.equal(rejected.exit, 1, JSON.stringify(rejected))
  assert.deepEqual(await snapshot(f.repo), before)
  const scaffold = f.call('formal scaffold', ['--plan', await f.write(await f.plan())])
  assert.equal(scaffold.exit, 0, JSON.stringify(scaffold))
  assert.deepEqual(scaffold.data.files.toSorted(), [`${suite}/SKILL.md`, `${suite}/model/ChargeOnce.cfg`, `${suite}/model/ChargeOnce.tla`, `${suite}/properties/charge-once.md`,
    `${suite}/scripts/map-coverage.mjs`, `${suite}/suite.json`, '.claude/skills/formal-charge-once/SKILL.md', 'AGENTS.md'].toSorted())
  assert.deepEqual(await snapshot(f.repo), before)
  const applied = f.call('apply', ['--plan', scaffold.data.path])
  assert.equal(applied.exit, 0, JSON.stringify(applied))
  const property = await readFile(join(f.repo, suite, 'properties/charge-once.md'), 'utf8')
  assert.match(property, /^Source paths: `src\/charge\.mjs`$/m)
  assert.match(property, new RegExp(`^Source paths: \`src/charge\\.mjs\`\\nSynced at: ${git(f.repo, 'rev-parse', 'HEAD')}$`, 'm'))
  assert.match(property, /^Model files: `model\/ChargeOnce\.tla`, `model\/ChargeOnce\.cfg`$/m)
  assert.match(property, /^\| `Claim\(w\)` \| `src\/charge\.mjs:2` \| compareAndSet reads and writes the status in one atomic store call \|$/m)
  assert.equal(await readFile(join(f.repo, suite, 'model/ChargeOnce.tla'), 'utf8'), await readFile(join(fixtures, 'formal-charge-once/formal/ChargeOnce.tla'), 'utf8'))
  const skill = await readFile(join(f.repo, suite, 'SKILL.md'), 'utf8')
  assert.match(skill, /^---\nname: formal-charge-once\ndescription: /)
  assert.match(skill, new RegExp(`sha256 \`${f.tool}\``))
  assert.match(skill, /Any other nonzero exit is a modeling error or a harness problem/)
  assert.match(skill, /find the action in the transition table of the property file, and write one line per state as "the actor does the code step \(`path:line`\)"\.\nTake the actor from the action's arguments .*\nEnd with the state that breaks the property.*\nFor Kani, give the concrete failing inputs and the failing assertion\./)
  assert.match(await readFile(join(f.repo, '.claude/skills/formal-charge-once/SKILL.md'), 'utf8'), /\.\.\/\.\.\/\.\.\/\.agents\/skills\/formal-charge-once\/SKILL\.md/)
  assert.match(await readFile(join(f.repo, 'AGENTS.md'), 'utf8'), /\.agents\/skills\/formal-charge-once\/SKILL\.md/)
  assert.deepEqual(git(f.repo, 'status', '--porcelain', '--', 'src', 'formal', 'PROPERTY.md'), '')
  assert.equal(f.check().exit, 0)
})

test('an unchanged plan updates to nothing and a changed model replaces only its file', async t => {
  const f = await setup(t)
  await f.apply(await f.plan())
  const again = f.call('formal scaffold', ['--plan', await f.write(await f.plan()), '--update'])
  assert.equal(again.exit, 0, JSON.stringify(again))
  assert.deepEqual(again.data, { path: null, planDigest: null, files: [], diff: '' })
  const changed = await f.plan()
  changed.properties[0].modelFiles[1].content += '\\* reviewed\n'
  const update = f.call('formal scaffold', ['--plan', await f.write(changed), '--update'])
  assert.deepEqual(update.data.files.toSorted(), [`${suite}/model/ChargeOnce.cfg`, `${suite}/suite.json`])
})

const rejections = [
  ['a model step that cites code outside the property source paths', plan => { plan.properties[0].steps[0].code = 'PROPERTY.md:1' }, 'step-outside-source-paths'],
  ['a model step in a sibling directory with the same prefix', plan => { plan.properties[0].sourcePaths = ['src']; plan.properties[0].steps[0].code = 'src-other/charge.mjs:2' }, 'step-outside-source-paths'],
  ['a model step that cites a line the file does not have', plan => { plan.properties[0].steps[0].code = 'src/charge.mjs:99' }, 'step-code-missing'],
  ['a module header that does not name its file', plan => { plan.properties[0].modelFiles[0].content = plan.properties[0].modelFiles[0].content.replace('MODULE ChargeOnce', 'MODULE Other') }, 'module-name-mismatch'],
  ['evidence inside the suite', plan => { plan.evidenceDirectory = `${suite}/states` }, 'evidence-inside-suite'],
  ['a model file used by two entries', plan => { plan.properties.push({ ...structuredClone(plan.properties[0]), id: 'second' }) }, 'duplicate-model-file']
]
for (const [name, change, code] of rejections) {
  test(`scaffold rejects ${name} and writes nothing`, async t => {
    const f = await setup(t)
    const value = await f.plan()
    change(value)
    const before = await snapshot(f.repo)
    const result = f.call('formal scaffold', ['--plan', await f.write(value)])
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.ok(codes(result).includes(code), JSON.stringify(result.problems))
    assert.deepEqual(await snapshot(f.repo), before)
  })
}

test('scaffold refuses to overwrite an applied suite without --update', async t => {
  const f = await setup(t)
  await f.apply(await f.plan())
  const result = f.call('formal scaffold', ['--plan', await f.write(await f.plan())])
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'suite-exists')
})

const drift = [
  ['a hand-edited suite file', f => edit(f, 'SKILL.md', text => `${text}Extra.\n`), 'file-drift'],
  ['a deleted model file', f => rm(join(f.repo, suite, 'model/ChargeOnce.cfg')), 'file-missing'],
  ['a property file the plan does not list', f => writeFile(join(f.repo, suite, 'properties/extra.md'), '# Extra\n'), 'orphan-property-file'],
  ['a model file the plan does not list', f => writeFile(join(f.repo, suite, 'model/Extra.tla'), 'extra\n'), 'orphan-model-file'],
  ['a missing AGENTS.md pointer', f => writeFile(join(f.repo, 'AGENTS.md'), '# Agent instructions\n'), 'pointer-missing'],
  ['a source path that matches no file', f => rm(join(f.repo, 'src/charge.mjs')), 'source-path-missing'],
  ['a cited code line that no longer exists', f => writeFile(join(f.repo, 'src/charge.mjs'), 'export function charge() {}\n'), 'step-code-missing'],
  ['a design section whose bytes changed', f => writeFile(join(f.repo, 'PROPERTY.md'), '# Charge once\n\n## charge-once\n\nChanged.\n\nMore.\n'), 'design-stale-citation']
]
async function edit(f, path, change) {
  const file = join(f.repo, suite, path)
  await writeFile(file, change(await readFile(file, 'utf8')))
}
for (const [name, seed, code] of drift) {
  test(`check fails on ${name}`, async t => {
    const f = await setup(t)
    await f.apply(await f.plan())
    assert.equal(f.check().exit, 0)
    await seed(f)
    const before = await snapshot(f.repo)
    const result = f.check()
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.status, 'failed')
    assert.ok(codes(result).includes(code), JSON.stringify(result.problems))
    assert.deepEqual(await snapshot(f.repo), before)
  })
}

test('check fails on a property file with no Source paths line, a drifted transition table and a tool file that differs from its pin, and reports a missing tool as unproven', async t => {
  const f = await setup(t)
  await f.apply(await f.plan())
  assert.equal(f.check().exit, 0)
  const property = join(f.repo, suite, 'properties/charge-once.md')
  const tool = join(f.repo, 'tools/tla2tools.jar')
  const [applied, pinned] = await Promise.all([readFile(property, 'utf8'), readFile(tool)])
  for (const [seed, restore, code] of [
    [() => writeFile(property, applied.replace(/^Source paths:.*\n/m, '')), () => writeFile(property, applied), 'source-paths-missing'],
    [() => writeFile(property, applied.replace('src/charge.mjs:3', 'src/charge.mjs:4')), () => writeFile(property, applied), 'table-drift'],
    [() => writeFile(tool, 'a different tool\n'), () => writeFile(tool, pinned), 'tool-hash-mismatch']
  ]) {
    await seed()
    const failed = f.check()
    assert.equal(failed.exit, 1, JSON.stringify(failed))
    assert.deepEqual(codes(failed), [code])
    await restore()
    assert.equal(f.check().exit, 0)
  }
  await rm(tool)
  const missing = f.check()
  assert.equal(missing.exit, 2, JSON.stringify(missing))
  assert.equal(missing.status, 'blocked')
  assert.deepEqual(codes(missing), ['tool-missing'])
  assert.match(missing.problems[0].message, /unproven, not passing/)
})

test('check blocks on a suite that was never applied', async t => {
  const f = await setup(t)
  const result = f.check()
  assert.equal(result.exit, 2)
  assert.equal(result.problems[0].code, 'suite-unavailable')
})

// The cited line keeps its number while its meaning changes, as after a direct push or a wrong No-proof-impact claim.
async function splitClaimInPlace(f) {
  const file = join(f.repo, 'src/charge.mjs')
  await writeFile(file, (await readFile(file, 'utf8')).replace("!store.compareAndSet(orderId, 'pending', 'charging')", "!(store.get(orderId) === 'pending' && store.set(orderId, 'charging'))"))
}

test('check reports a change to a cited line that reached main, and moving the sync commit after the re-proof clears it', async t => {
  const f = await setup(t)
  const synced = git(f.repo, 'rev-parse', 'HEAD')
  await f.apply(await f.plan())
  f.commit('feat: add the charge-once suite')
  assert.equal(f.check().exit, 0)
  await splitClaimInPlace(f)
  f.commit('refactor: read the status before claiming')
  const head = git(f.repo, 'rev-parse', 'HEAD')

  const gate = spawnSync(process.execPath, [join(f.repo, suite, 'scripts/map-coverage.mjs'), '--base', 'main'], { cwd: f.repo, encoding: 'utf8' })
  assert.equal(gate.status, 0, gate.stdout + gate.stderr)
  const drifted = f.check()
  assert.equal(drifted.exit, 1, JSON.stringify(drifted))
  assert.deepEqual(codes(drifted), ['source-changed-since-sync'])
  assert.equal(drifted.problems[0].path, `${suite}/properties/charge-once.md`)
  assert.match(drifted.problems[0].message, new RegExp(`changed between ${synced} and HEAD: src/charge\\.mjs`))
  const swept = runMaintenance('sweep', f.repo, f.env)
  assert.deepEqual(swept.problems.filter(problem => problem.fix === 'Run /formal-verification maintain.').map(problem => problem.code), ['source-changed-since-sync'])

  // Maintain proves a commit passes before it records it, and a commit from before the change proves nothing.
  assert.equal(f.call('formal check', ['--suite', 'charge-once', '--sync-commit', synced]).exit, 1)
  assert.equal(f.call('formal check', ['--suite', 'charge-once', '--sync-commit', head]).exit, 0)
  await f.apply(await f.plan({ syncCommit: head }), ['--update'])
  assert.match(await readFile(join(f.repo, suite, 'properties/charge-once.md'), 'utf8'), new RegExp(`^Synced at: ${head}$`, 'm'))
  f.commit('chore: record the new sync commit')
  assert.equal(f.check().exit, 0)
  assert.deepEqual(runMaintenance('sweep', f.repo, f.env).problems.filter(problem => problem.fix === 'Run /formal-verification maintain.'), [])
})

for (const [name, syncCommit, message] of [
  ['records none', null, /records no sync commit/],
  ['names a commit the repo does not have', '1'.repeat(40), /Sync commit 1{40} of property charge-once is not in this repo/]
]) {
  test(`check reports sync-commit-missing when a property ${name}, falls back to the last commit that changed the suite and recovers through a proposed commit`, async t => {
    const f = await setup(t)
    await f.apply(await f.plan({ syncCommit }))
    const uncommitted = f.check()
    assert.deepEqual(codes(uncommitted), ['sync-commit-missing'])
    assert.match(uncommitted.problems[0].message, message)
    assert.match(uncommitted.problems[0].message, /No commit has changed \.agents\/skills\/formal-charge-once, so drift cannot be checked/)
    f.commit('feat: add the charge-once suite')
    const fallback = git(f.repo, 'rev-parse', 'HEAD')
    const missing = f.check()
    assert.deepEqual(codes(missing), ['sync-commit-missing'])
    assert.match(missing.problems[0].message, new RegExp(`Drift is checked from ${fallback}, the last commit that changed`))
    await splitClaimInPlace(f)
    f.commit('refactor: read the status before claiming')
    const drifted = f.check()
    assert.deepEqual(codes(drifted), ['sync-commit-missing', 'source-changed-since-sync'])
    assert.match(drifted.problems[1].message, new RegExp(`changed between ${fallback} and HEAD: src/charge\\.mjs\\. Drift is checked from ${fallback}`))
    const head = git(f.repo, 'rev-parse', 'HEAD')
    assert.equal(f.call('formal check', ['--suite', 'charge-once', '--sync-commit', head]).exit, 0)
    await f.apply(await f.plan({ syncCommit: head }), ['--update'])
    f.commit('chore: record the sync commit')
    assert.equal(f.check().exit, 0)
  })
}

for (const [name, value] of [['a short hash', 'abc1234'], ['a hash the repo does not have', '1'.repeat(40)]]) {
  test(`check refuses ${name} as the proposed sync commit`, async t => {
    const f = await setup(t)
    await f.apply(await f.plan())
    const result = f.call('formal check', ['--suite', 'charge-once', '--sync-commit', value])
    assert.equal(result.status, 'usage-error', JSON.stringify(result))
    assert.deepEqual(codes(result), ['invalid-sync-commit'])
  })
}

// A gated branch holds the applied suite on main and one change to the declared source path on top.
async function gatedBranch(t, options) {
  const f = await setup(t, options)
  await f.apply(await f.plan())
  f.commit('feat: add the charge-once suite')
  git(f.repo, 'checkout', '-q', '-b', 'change')
  f.gate = () => spawnSync(process.execPath, [join(f.repo, suite, 'scripts/map-coverage.mjs'), '--base', 'main'], { cwd: f.repo, encoding: 'utf8' })
  return f
}
const changeSource = f => writeFile(join(f.repo, 'src/charge.mjs'), 'export function charge(store, orderId, gateway) {\n  // retry once\n  if (!store.compareAndSet(orderId, \'pending\', \'charging\')) return false\n  gateway.charge(orderId)\n  store.set(orderId, \'charged\')\n  return true\n}\n')

for (const [name, message, exit] of [
  ['a source change with no model change', 'Change charge', 1],
  ['a source change with a no-impact reason for the property', 'Change charge\n\nNo-proof-impact: charge-once: comment only', 0],
  ['a source change with a no-impact reason for another property', 'Change charge\n\nNo-proof-impact: refund-once: not this one', 1],
  ['a source change with an empty no-impact reason', 'Change charge\n\nNo-proof-impact: charge-once:', 1],
  ['a source change with the kit trailer instead', 'Change charge\n\nNo-map-impact: charge-once: comment only', 1]
]) {
  test(`the generalised coverage gate exits ${exit} for ${name}`, async t => {
    const f = await gatedBranch(t)
    await changeSource(f)
    f.commit(message)
    const gate = f.gate()
    assert.equal(gate.status, exit, gate.stdout + gate.stderr)
    if (exit === 1) assert.match(gate.stdout, new RegExp(`^${suite}/properties/charge-once\\.md: formal-proof-coverage: src/charge\\.mjs changed without updating a model file of this property`))
    else assert.match(gate.stdout, /^formal-proof-coverage: ok \(1 properties checked\)$/m)
  })
}

test('the generalised coverage gate fails a source change when no model changed and accepts it with a No-proof-impact line', async t => {
  const f = await gatedBranch(t)
  await changeSource(f)
  f.commit('Change charge')
  assert.equal(f.gate().status, 1)
  git(f.repo, 'commit', '-q', '--amend', '-m', 'Change charge\n\nNo-proof-impact: charge-once: comment only')
  assert.equal(f.gate().status, 0)
})

test('the generalised coverage gate accepts a source change that comes with a model change', async t => {
  const f = await gatedBranch(t)
  await changeSource(f)
  await writeFile(join(f.repo, suite, 'model/ChargeOnce.cfg'), `${await readFile(join(f.repo, suite, 'model/ChargeOnce.cfg'), 'utf8')}\n`)
  f.commit('Change charge and its model')
  assert.equal(f.gate().status, 0)
})

test('the coverage gate rejects a property file without its Model files line', async t => {
  const f = await gatedBranch(t)
  await edit(f, 'properties/charge-once.md', text => text.replace(/^Model files:.*\n/m, ''))
  f.commit('Remove the model line')
  const gate = f.gate()
  assert.equal(gate.status, 2)
  assert.match(gate.stderr, /formal-proof-coverage: .* must contain exactly one complete "Model files:" line/)
})

test('sweep routes a drifted formal suite to its maintain mode, reports a missing tool as a limit and leaves a verify kit alone', async t => {
  const f = await setup(t)
  await f.apply(await f.plan())
  const sweep = () => runMaintenance('sweep', f.repo, f.env)
  const formal = swept => swept.problems.filter(problem => problem.fix === 'Run /formal-verification maintain.')
  assert.deepEqual(formal(sweep()), [])
  await rm(join(f.repo, 'tools/tla2tools.jar'))
  const unproven = sweep()
  assert.deepEqual(formal(unproven), [])
  assert.deepEqual(unproven.data.coverageLimits.map(limit => limit.path), ['tools/tla2tools.jar'])
  await writeFile(join(f.repo, 'tools/tla2tools.jar'), 'a different tool\n')
  // A kit named like a suite is still a kit, found by the verify- prefix.
  await mkdir(join(f.repo, '.agents/skills/verify-formal-charge-once'), { recursive: true })
  await writeFile(join(f.repo, '.agents/skills/verify-formal-charge-once/kit.json'), '{}')
  const before = await snapshot(f.repo)
  const swept = sweep()
  assert.deepEqual(await snapshot(f.repo), before)
  assert.deepEqual(formal(swept).map(problem => problem.code), ['tool-hash-mismatch'])
  assert.ok(swept.problems.filter(problem => problem.fix === 'Run /verification maintain.').length > 0)
})

// The remaining tests run the pinned model checker, so a missing tool skips them rather than passing them.
const checker = await modelChecker()

test('rule-proof passes unchanged on the charge-once pair with the pinned tool', checker, async t => {
  const clean = build(t, 'formal-charge-once')
  const broken = build(t, 'formal-charge-once-violation')
  for (const repo of [clean, broken]) {
    await mkdir(join(repo, 'tools'))
    await cp(checker.path, join(repo, 'tools/tla2tools.jar'))
  }
  const proof = (valid, invalid) => runFormal('rule-proof', clean, process.env, ['--check-plan', join(clean, 'check-plan.json'), '--check-id', 'tlc-charge-once',
    '--valid', valid, '--violation', invalid, '--expect', violation])
  const result = proof(clean, broken)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.data.cases.map(item => item.execution.exitCode), [0, 12])
  assert.match(result.data.cases[0].execution.stdout, /12 distinct states found/)
  assert.ok(result.data.cases[1].execution.stdout.includes(violation))

  // A model that leaves charges unassigned in one branch is a modeling error and not a property violation.
  const flawed = build(t, 'formal-charge-once')
  await mkdir(join(flawed, 'tools'))
  await cp(checker.path, join(flawed, 'tools/tla2tools.jar'))
  const model = join(flawed, 'formal/ChargeOnce.tla')
  await writeFile(model, (await readFile(model, 'utf8')).replace('    /\\ UNCHANGED charges\n', ''))
  const modeling = proof(clean, flawed)
  assert.equal(modeling.status, 'failed', JSON.stringify(modeling))
  assert.deepEqual(modeling.data.cases.map(item => item.execution.exitCode), [0, 75])
  assert.ok(!modeling.data.cases[1].execution.stdout.includes(violation))
})

test('the walkthrough on a scratch break in the real code is flagged, fails the updated model and returns to the original result', checker, async t => {
  const f = await gatedBranch(t, { jar: checker.path })
  const run = async () => {
    const [command, ...args] = (await f.plan()).properties[0].check.command
    const result = spawnSync(command, args, { cwd: f.repo, encoding: 'utf8' })
    return { exit: result.status, output: result.stdout + result.stderr }
  }
  const original = await run()
  assert.equal(original.exit, 0, original.output)
  assert.equal(f.check().exit, 0)

  // Break the real code: split the atomic claim into a read and a later write.
  await cp(join(fixtures, 'formal-charge-once-violation/overlay/src/charge.mjs'), join(f.repo, 'src/charge.mjs'))
  f.commit('Split the claim')
  const flagged = f.gate()
  assert.equal(flagged.status, 1, flagged.stdout)
  assert.match(flagged.stdout, /formal-proof-coverage: src\/charge\.mjs changed without updating a model file/)
  // The model checker alone cannot see the break: the unchanged model still passes on the broken code.
  assert.equal((await run()).exit, 0)

  await f.apply(await f.plan({ model: await modelFiles('formal-charge-once-violation/overlay/formal/ChargeOnce.tla'), steps: brokenSteps }), ['--update'])
  f.commit('Update the model to match')
  assert.equal(f.gate().status, 0)
  assert.equal(f.check().exit, 0)
  const failed = await run()
  assert.equal(failed.exit, 12)
  assert.ok(failed.output.includes(violation), failed.output)

  // Restore the code and the model, and the result is the original one.
  git(f.repo, 'checkout', '-q', 'main', '--', '.')
  git(f.repo, 'commit', '-q', '-m', 'Restore the code and the model')
  assert.equal(git(f.repo, 'diff', 'main', '--stat'), '')
  assert.equal(f.check().exit, 0)
  const restored = await run()
  assert.equal(restored.exit, original.exit)
  assert.match(restored.output, /12 distinct states found/)
})
