import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { snapshot } from './discovery-fixture.mjs'

// Commands exercise the installed entry point with only disposable targets.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Independent canonical encoding verifies the published digest contract.
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value)
// Exact byte hashes bind the payload reviewed through the command.
const hash = value => createHash('sha256').update(value).digest('hex')

async function save(context) {
  const { plan, changeSet, findings } = context
  changeSet.findingsDigest = hash(canonical(findings))
  const { planDigest: oldChangeDigest, ...change } = changeSet
  changeSet.planDigest = hash(canonical(change))
  plan.changeSetDigest = changeSet.planDigest
  const { planDigest: oldPlanDigest, ...creation } = plan
  plan.planDigest = hash(canonical(creation))
  await writeFile(join(context.directory, 'findings.json'), JSON.stringify(findings))
  await writeFile(join(context.directory, 'changes.json'), JSON.stringify(changeSet))
  await writeFile(context.file, JSON.stringify(plan))
}

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack-create ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const workspace = join(directory, 'idea')
  const destination = join(workspace, 'pantry ü &')
  await mkdir(workspace)
  await writeFile(join(workspace, 'brief.md'), 'Approved local pantry list.\n')
  const contents = {
    'VISION.md': '# Pantry\nA household marks supplies to buy.\n',
    'GLOSSARY.md': '# Terms\nAn item is a named pantry supply.\n',
    'docs/design.md': '# Foundation\nThe list owns marks. The CLI prints the list.\n',
    'journey.mjs': "import assert from 'node:assert/strict'\nconst needed = new Set()\nneeded.add('Rice')\nassert.deepEqual([...needed], ['Rice'])\nconsole.log('shopping list: Rice')\n"
  }
  const findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-foundation.json'), 'utf8'))
  findings.target = { mode: 'workspace', root: destination, revision: null }
  findings.reviewedScope = Object.keys(contents)
  Object.assign(findings.findings[0], { files: Object.keys(contents), scope: Object.keys(contents), category: 'missing-protection', resolved: true })
  const changeSet = { schemaVersion: 1, target: findings.target, findings: 'findings.json', findingsDigest: '', selectedFindingIds: ['F-001'],
    reviewedScope: Object.keys(contents).map(path => ({ path, resolvedPath: join(destination, path) })),
    edits: Object.entries(contents).map(([path, content], index) => ({ id: `E-${index}`, findingId: 'F-001', path, originalHash: null, proposedHash: hash(content), operation: 'create', payload: { content }, proposedContent: content })), planDigest: '' }
  const command = { id: 'journey', executable: 'node', args: ['journey.mjs'], versionArgs: ['--version'], cwd: '.', timeoutMs: 10000 }
  const plan = { schemaVersion: 1, workspace, destination: { path: 'pantry ü &', resolvedPath: destination, allowEmpty: false }, stack: 'Node built-in CLI', firstJourney: 'Mark Rice and print the shopping list',
    visionPath: 'VISION.md', glossaryPath: 'GLOSSARY.md', changeSet: 'changes.json', changeSetDigest: '', prerequisites: [], setupCommands: [], journeyCommand: command, planDigest: '' }
  const context = { directory, workspace, destination, findings, changeSet, plan, file: join(directory, 'create.json'),
    env: { ...process.env, HOME: directory, USERPROFILE: directory, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') } }
  await save(context)
  return context
}

function execute(context, { dryRun = false, fault } = {}) {
  const result = spawnSync(process.execPath, [...(fault ? ['--import', join(root, 'tests/inputs/create-fault.mjs')] : []), join(root, 'skills/repo-audit/scripts/repo-audit.mjs'),
    'project', 'create', '--workspace', context.workspace, '--plan', context.file, '--json', ...(dryRun ? ['--dry-run'] : [])],
  { encoding: 'utf8', env: { ...context.env, BSTACK_TEST_FAULT: fault, BSTACK_TEST_DESTINATION: context.destination } })
  return { exit: result.status, ...(result.stdout ? JSON.parse(result.stdout) : {}), stderr: result.stderr }
}

test('reviewed scratch scaffold creates a minimal Git project and passes its native journey', async t => {
  const context = await setup(t)
  const config = join(context.directory, '.gitconfig')
  await writeFile(config, '[user]\n\tname = Fixture owner\n\temail = fixture@example.invalid\n')
  const configBefore = await readFile(config)
  const before = await snapshot(context.workspace)
  const preview = execute(context, { dryRun: true })
  assert.equal(preview.exit, 0, JSON.stringify(preview))
  assert.deepEqual(await snapshot(context.workspace), before)
  assert.match(preview.data.diff, /\+A household marks supplies to buy/)
  assert.equal(await readFile(join(preview.data.scratch, 'VISION.md'), 'utf8'), context.changeSet.edits[0].proposedContent)
  const created = execute(context)
  assert.equal(created.exit, 0, JSON.stringify(created))
  assert.equal(created.data.commands[0].stdout, 'shopping list: Rice\n')
  assert.equal(created.data.gitComplete, true)
  assert.deepEqual(await readFile(config), configBefore)
  assert.equal(created.data.pending.length, 2)
  assert.equal(spawnSync('git', ['-C', context.destination, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim(), context.destination)
  assert.equal(await readFile(join(context.workspace, 'brief.md'), 'utf8'), 'Approved local pantry list.\n')
  assert.equal(execute(context).exit, 0)
  assert.equal(await readFile(join(context.destination, 'GLOSSARY.md'), 'utf8'), context.changeSet.edits[1].proposedContent)
})

for (const [name, code, mutate] of [
  ['unknown input', 'unknown-field', context => { context.plan.extra = true }],
  ['changed payload', 'payload-mismatch', context => { context.changeSet.edits[1].proposedContent = 'changed' }],
  ['unresolved decision', 'unresolved-decision', context => { Object.assign(context.findings.findings[0], { category: 'decision', resolved: false }) }],
  ['unselected edits', 'unselected-finding', context => { context.changeSet.edits[1].findingId = 'F-002' }],
  ['escaping path', 'scope-mismatch', context => { context.changeSet.edits[1].path = '../outside' }],
  ['missing vision', 'invalid-const', context => { context.plan.visionPath = 'other.md' }],
  ['missing glossary', 'missing-approved-document', context => { context.plan.glossaryPath = 'missing.md' }],
  ['Git payload', 'invalid-scaffold', context => { context.plan.glossaryPath = null; context.changeSet.edits[1].path = '.git/config'; context.changeSet.reviewedScope[1] = { path: '.git/config', resolvedPath: join(context.destination, '.git/config') }; context.findings.reviewedScope[1] = '.git/config'; context.findings.findings[0].scope[1] = '.git/config'; context.findings.findings[0].files[1] = '.git/config' }],
  ['missing prerequisite', 'missing-prerequisite', context => { context.plan.prerequisites.push({ ...context.plan.journeyCommand, id: 'prerequisite', executable: 'bstack-not-installed', args: ['--version'] }) }],
  ['invalid timeout', 'invalid-command', context => { context.plan.journeyCommand.timeoutMs = 0 }],
  ['missing command directory', 'invalid-command-directory', context => { context.plan.journeyCommand.cwd = 'missing' }]
]) {
  test(`${name} leaves the destination unchanged in preview and execution`, async t => {
    const context = await setup(t)
    mutate(context)
    await save(context)
    const before = await snapshot(context.workspace)
    const preview = execute(context, { dryRun: true })
    const applied = execute(context)
    assert.notEqual(preview.exit, 0)
    assert.notEqual(applied.exit, 0)
    assert.equal(preview.problems[0].code, code, JSON.stringify(preview))
    assert.equal(applied.problems[0].code, code, JSON.stringify(applied))
    assert.deepEqual(await snapshot(context.workspace), before)
  })
}

for (const [name, allowEmpty, content, expected] of [['unselected empty', false, false, 2], ['selected empty', true, false, 0], ['nonempty', true, true, 2]]) {
  test(`${name} destination is handled without adopting unrelated content`, async t => {
    const context = await setup(t)
    await mkdir(context.destination)
    if (content) await writeFile(join(context.destination, 'user.txt'), 'user\n')
    context.plan.destination.allowEmpty = allowEmpty
    await save(context)
    const before = await snapshot(context.workspace)
    const result = execute(context)
    assert.equal(result.exit, expected, JSON.stringify(result))
    if (expected !== 0) assert.deepEqual(await snapshot(context.workspace), before)
  })
}

test('destination symlink collision leaves both the link and its target unchanged', async t => {
  const context = await setup(t)
  const outside = join(context.directory, 'outside')
  await mkdir(outside)
  await symlink(outside, context.destination, process.platform === 'win32' ? 'junction' : 'dir')
  assert.notEqual(execute(context).exit, 0)
  assert.deepEqual(await readdir(outside), [])
})

for (const fault of ['directory', 'file', 'git', 'partial-git']) {
  test(`interruption after ${fault} creation resumes without duplicate setup effects`, async t => {
    const context = await setup(t)
    context.plan.setupCommands.push({ ...context.plan.journeyCommand, id: 'setup', args: ['-e', "require('node:fs').appendFileSync('setup-count.txt','once\\n')"] })
    await save(context)
    assert.equal(execute(context, { fault }).exit, 91)
    const resumed = execute(context)
    assert.equal(resumed.exit, 0, JSON.stringify(resumed))
    assert.equal(await readFile(join(context.destination, 'setup-count.txt'), 'utf8'), 'once\n')
    assert.equal(execute(context).exit, 0)
    assert.equal(await readFile(join(context.destination, 'setup-count.txt'), 'utf8'), 'once\n')
  })
}

for (const path of ['unrelated.txt', 'VISION.md']) {
  test(`user edit at ${path} after interruption blocks remaining creation`, async t => {
    const context = await setup(t)
    assert.equal(execute(context, { fault: 'file' }).exit, 91)
    await writeFile(join(context.destination, path), 'user bytes\n')
    const before = await snapshot(context.workspace)
    assert.equal(execute(context).exit, 2)
    assert.deepEqual(await snapshot(context.workspace), before)
  })
}

for (const phase of ['setup', 'journey']) {
  test(`${phase} failure retains the created project as unverified`, async t => {
    const context = await setup(t)
    const failing = { ...context.plan.journeyCommand, id: phase, args: ['-e', 'process.exit(1)'] }
    if (phase === 'setup') context.plan.setupCommands.push(failing)
    else context.plan.journeyCommand = failing
    await save(context)
    const result = execute(context)
    assert.equal(result.exit, 2, JSON.stringify(result))
    assert.equal(result.data.verified, false)
    assert.equal(result.data.commands[0].exitCode, 1)
    assert.equal(await readFile(join(context.destination, 'VISION.md'), 'utf8'), context.changeSet.edits[0].proposedContent)
    assert.equal(execute(context).exit, 2)
  })
}

test('interrupted setup is retained as unverified and never rerun automatically', async t => {
  const context = await setup(t)
  context.plan.setupCommands.push({ ...context.plan.journeyCommand, id: 'setup', args: ['-e', "require('node:fs').appendFileSync('setup-count.txt','once\\n')"] })
  await save(context)
  assert.equal(execute(context, { fault: 'setup' }).exit, 91)
  const resumed = execute(context)
  assert.equal(resumed.exit, 2)
  assert.equal(resumed.data.commands[0].status, 'unverified')
  assert.equal(await readFile(join(context.destination, 'setup-count.txt'), 'utf8'), 'once\n')
})

test('malformed JSON plan leaves the workspace unchanged', async t => {
  const context = await setup(t)
  await writeFile(context.file, '{"schemaVersion":1,')
  const before = await snapshot(context.workspace)
  assert.notEqual(execute(context).exit, 0)
  assert.deepEqual(await snapshot(context.workspace), before)
})
