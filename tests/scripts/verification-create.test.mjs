import test from 'node:test'
import assert from 'node:assert/strict'
import { connect } from 'node:net'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, git, runVerification } from './discovery-fixture.mjs'

// The kit's helpers run inside the target, so they obey the target's own lint and format constraints.
const doctorHelper = `import sys
from urllib.request import urlopen

url = sys.argv[1]
with urlopen(f"{url}/health", timeout=5) as response:
    body = response.read().decode()
if body != "ok":
    sys.exit(f"unexpected health body: {body}")
print(f"healthy at {url}")
`
const greetHelper = `import sys
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

url, name, out = sys.argv[1:4]
with urlopen(f"{url}/greet?name={quote(name)}", timeout=5) as response:
    body = response.read().decode()
Path(out).write_text(body + "\\n")
print(body)
`
// The plan is what a create run writes after interviewing the fixture repo.
const kit = '.agents/skills/verify-greeter'
const plan = () => ({
  schemaVersion: 1,
  app: 'greeter',
  description: 'Verify the greeter HTTP service by launching it and requesting greetings the way a client does.',
  surface: 'an HTTP API on localhost',
  isolation: 'Each run binds a free port and its own run directory, so instances run side by side.',
  baseline: ['Python 3 is on PATH.'],
  launch: {
    command: ['python3', '-m', 'greeter.server', '{port}'], ready: { url: 'http://127.0.0.1:{port}/health' },
    readiness: 'The health endpoint answers ok.', teardown: 'Stop the process the run started and never kill by name.'
  },
  doctor: { command: ['python3', `${kit}/scripts/doctor.py`, 'http://127.0.0.1:{port}'], asserts: 'The health endpoint answers ok on the port this run owns.' },
  drive: { harness: 'a Python HTTP client', conventions: ['Run every command from the repo root.', 'Treat commands as literal.'] },
  evidence: { directory: '.verification/greeter', standards: ['Capture the request and the response body, not only the exit code.'] },
  cleanup: { notes: ['Remove the run directory and keep the evidence directory.'] },
  helpers: [
    { path: 'scripts/doctor.py', purpose: 'Check the health endpoint.', invocation: `python3 ${kit}/scripts/doctor.py <url>`, content: doctorHelper },
    { path: 'scripts/greet.py', purpose: 'Request a greeting and save the response.', invocation: `python3 ${kit}/scripts/greet.py <url> <name> <output>`, content: greetHelper }
  ],
  features: [{
    id: 'greeting', title: 'Greeting', summary: 'A client requests a personal greeting by name.', sourcePaths: ['greeter/**'],
    subFeatures: [{ id: 'greeting-named', description: 'Returns a greeting for a given name.' }],
    entryPoints: ['Request GET /greet?name=<name> on the service port.'], preconditions: ['The service is healthy.'],
    steps: [{
      label: 'Request a named greeting', command: ['python3', `${kit}/scripts/greet.py`, 'http://127.0.0.1:{port}', 'Ada', '{evidenceDir}/greeting.txt'],
      expect: 'The body reads Hello, Ada!', match: 'Hello, Ada!', artifacts: ['{evidenceDir}/greeting.txt']
    }],
    gotchas: ['The service answers 404 for any other path.']
  }]
})

async function setup(t, adjust = () => {}) {
  const repo = build(t, 'py-greeter')
  const cache = await mkdtemp(join(tmpdir(), 'bstack verification cache '))
  t.after(() => rm(cache, { recursive: true, force: true }))
  const value = plan()
  adjust(value)
  const file = join(cache, 'kit-plan.json')
  await writeFile(file, JSON.stringify(value))
  const env = { ...process.env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }
  const call = (command, extra = []) => runVerification(command, repo, env, extra)
  return { repo, file, call }
}

async function createKit(f) {
  const scaffold = f.call('kit scaffold', ['--plan', f.file])
  assert.equal(scaffold.exit, 0, JSON.stringify(scaffold))
  const applied = f.call('apply', ['--plan', scaffold.data.path])
  assert.equal(applied.exit, 0, JSON.stringify(applied))
  return scaffold
}

const prove = f => f.call('kit prove', ['--app', 'greeter', '--feature', 'greeting'])

function closed(port) {
  return new Promise(resolve => {
    const socket = connect(port, '127.0.0.1')
    socket.once('connect', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => resolve(true))
  })
}

async function evidenceRecord(repo) {
  const root = join(repo, '.verification', 'greeter')
  const [run] = await readdir(root)
  return { directory: join(root, run), record: JSON.parse(await readFile(join(root, run, 'greeting.json'), 'utf8')) }
}

test('create produces a kit that launches, passes doctor, drives one feature and keeps its evidence after cleanup', async t => {
  const f = await setup(t)
  const scaffold = await createKit(f)
  assert.deepEqual(scaffold.data.files.toSorted(), [`${kit}/SKILL.md`, `${kit}/features/README.md`, `${kit}/features/greeting.md`, `${kit}/kit.json`,
    `${kit}/scripts/doctor.py`, `${kit}/scripts/greet.py`, '.claude/skills/verify-greeter/SKILL.md', 'AGENTS.md'].toSorted())
  const result = prove(f)
  assert.equal(result.exit, 0, JSON.stringify(result))
  const { directory, record } = await evidenceRecord(f.repo)
  assert.equal(await readFile(join(directory, 'greeting.txt'), 'utf8'), 'Hello, Ada!\n')
  assert.deepEqual(result.data.evidence.map(item => item.path).toSorted(), ['greeting.json', 'greeting.txt'])
  assert.equal(record.doctor.exit, 0)
  assert.match(record.doctor.stdout, /healthy at http:\/\/127\.0\.0\.1:\d+/)
  assert.equal(await closed(Number(/:(\d+)$/.exec(record.doctor.command.at(-1))[1])), true)
})

test('the generated kit names launch, doctor, drive, evidence, cleanup and helpers, and the pointers reach it', async t => {
  const f = await setup(t)
  await createKit(f)
  const skill = await readFile(join(f.repo, kit, 'SKILL.md'), 'utf8')
  assert.match(skill, /^---\nname: verify-greeter\ndescription: /)
  for (const heading of ['Launch', 'Doctor', 'Drive', 'Evidence', 'Cleanup', 'Helpers']) assert.match(skill, new RegExp(`^## ${heading}$`, 'm'))
  const feature = await readFile(join(f.repo, kit, 'features', 'greeting.md'), 'utf8')
  assert.deepEqual([...feature.matchAll(/^## (.+)$/gm)].map(match => match[1]), ['Sub-features', 'How to get to it (user POV)', 'Driving it with a Python HTTP client', 'Gotchas'])
  assert.match(feature, /^Source paths: `greeter\/\*\*`$/m)
  assert.match(await readFile(join(f.repo, '.claude/skills/verify-greeter/SKILL.md'), 'utf8'), /\.\.\/\.\.\/\.\.\/\.agents\/skills\/verify-greeter\/SKILL\.md/)
  assert.match(await readFile(join(f.repo, 'AGENTS.md'), 'utf8'), /\.agents\/skills\/verify-greeter\/SKILL\.md/)
})

test('an existing AGENTS.md keeps its content and gains the pointer once', async t => {
  const f = await setup(t)
  await writeFile(join(f.repo, 'AGENTS.md'), '# Rules\n\nBe kind.\n')
  git(f.repo, 'add', 'AGENTS.md')
  git(f.repo, 'commit', '-q', '-m', 'docs: add agent rules')
  await createKit(f)
  const text = await readFile(join(f.repo, 'AGENTS.md'), 'utf8')
  assert.ok(text.startsWith('# Rules\n\nBe kind.\n'))
  assert.equal(text.split('verify-greeter').length - 1, 2)
})

test('scaffold previews the exact diff without writing and refuses to overwrite an existing kit', async t => {
  const f = await setup(t)
  const scaffold = f.call('kit scaffold', ['--plan', f.file])
  assert.match(scaffold.data.diff, new RegExp(`\\+\\+\\+ b/${kit}/kit\\.json`))
  assert.equal(git(f.repo, 'status', '--porcelain'), '')
  await createKit(f)
  const again = f.call('kit scaffold', ['--plan', f.file])
  assert.equal(again.status, 'blocked')
  assert.equal(again.problems[0].code, 'kit-exists')
})

for (const [name, mutate, code] of [
  ['both ready conditions', value => { value.launch.ready.output = 'listening' }, 'invalid-ready'],
  ['evidence inside the committed kit', value => { value.evidence.directory = `${kit}/evidence` }, 'evidence-inside-kit'],
  ['parent traversal in a helper path', value => { value.helpers[0].path = '../escape.py' }, 'unsafe-path'],
  ['a helper replacing the machine form', value => { value.helpers[0].path = 'kit.json' }, 'helper-collision'],
  ['duplicate feature IDs', value => { value.features.push(structuredClone(value.features[0])) }, 'duplicate-feature'],
  ['a step without an observable match', value => { delete value.features[0].steps[0].match }, 'missing-field']
]) {
  test(`scaffold rejects ${name} before any change set exists`, async t => {
    const f = await setup(t, mutate)
    const result = f.call('kit scaffold', ['--plan', f.file])
    assert.equal(result.status, 'failed')
    assert.equal(result.problems[0].code, code)
    assert.equal(result.data.path, undefined)
  })
}

for (const [name, mutate, code] of [
  ['output that differs from the feature file', value => { value.features[0].steps[0].match = 'Goodbye' }, 'step-mismatch'],
  ['a doctor that reports an unhealthy instance', value => { value.doctor.command = ['python3', '-c', 'import sys; sys.exit(3)'] }, 'doctor-failed'],
  ['a launch command that exits before it is ready', value => { value.launch.command = ['python3', '-c', 'import sys; sys.exit(1)'] }, 'launch-exited'],
  ['a launch executable that does not exist', value => { value.launch.command = ['bstack-missing-executable'] }, 'launch-exited'],
  ['a launch command that never becomes ready', value => { value.launch.command = ['python3', '-c', 'import time; time.sleep(30)']; value.launch.timeoutSeconds = 1 }, 'launch-not-ready'],
  ['a declared artifact the step never writes', value => { value.features[0].steps[0].artifacts = ['{evidenceDir}/missing.txt'] }, 'artifact-missing'],
  ['a cleanup that deletes the evidence', value => { value.cleanup.command = ['python3', '-c', 'import shutil; shutil.rmtree(".verification")'] }, 'evidence-lost']
]) {
  test(`proof fails on ${name}`, async t => {
    const f = await setup(t, mutate)
    await createKit(f)
    const result = prove(f)
    assert.equal(result.status, 'failed')
    assert.equal(result.exit, 1)
    assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result.problems))
  })
}

test('a failed proof stops the service it started and keeps the evidence it captured', async t => {
  const f = await setup(t, value => { value.features[0].steps[0].match = 'Goodbye' })
  await createKit(f)
  assert.equal(prove(f).status, 'failed')
  const { directory, record } = await evidenceRecord(f.repo)
  assert.equal(record.steps[0].matched, false)
  assert.equal(await readFile(join(directory, 'greeting.txt'), 'utf8'), 'Hello, Ada!\n')
  assert.equal(await closed(Number(/:(\d+)$/.exec(record.doctor.command.at(-1))[1])), true)
})

test('proving an unknown feature names the features the kit has', async t => {
  const f = await setup(t)
  await createKit(f)
  const result = f.call('kit prove', ['--app', 'greeter', '--feature', 'checkout'])
  assert.equal(result.exit, 3)
  assert.equal(result.problems[0].code, 'unknown-feature')
  assert.match(result.problems[0].fix, /greeting/)
})
