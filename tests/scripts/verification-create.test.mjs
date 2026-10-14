import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { connect } from 'node:net'
import { appendFile, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
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
  return { repo, file, call, env, cache }
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
  assert.equal(record.launch.command[0], 'python3')
  assert.equal(typeof record.launch.exit, 'number')
  assert.equal(typeof record.launch.stdout, 'string')
  assert.equal(record.cleanup, null)
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
  ['an artifact occupying the proof record', value => { value.features[0].steps[0].artifacts = ['{evidenceDir}/greeting.json'] }, 'evidence-collision'],
  ['a normalized artifact occupying the proof record', value => { value.features[0].steps[0].artifacts = ['{evidenceDir}/./greeting.json'] }, 'evidence-collision'],
  ['a captured artifact in the run directory', value => { value.features[0].steps[0].artifacts = ['{runDir}/response.txt'] }, 'artifact-outside-evidence'],
  ['a captured artifact in the repo root', value => { value.features[0].steps[0].artifacts = ['response.txt'] }, 'artifact-outside-evidence'],
  ['a captured artifact in another evidence run', value => { value.features[0].steps[0].artifacts = ['.verification/greeter/another/response.txt'] }, 'artifact-outside-evidence'],
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

for (const [exit, status] of [[0, 'passed'], [3, 'failed']]) {
  test(`a finite launch emitting readiness and exiting ${exit} produces ${status} with launch evidence`, async t => {
    const f = await setup(t, value => {
      value.launch.command = ['python3', '-c', `import sys; print("ready"); sys.exit(${exit})`]
      value.launch.ready = { output: 'ready' }
      value.doctor.command = ['python3', '-c', 'print("healthy")']
      value.features[0].steps = [{ label: 'Drive', command: ['python3', '-c', 'print("Hello, Ada!")'], expect: 'Hello, Ada!', match: 'Hello, Ada!' }]
      value.cleanup.command = ['python3', '-c', 'print("cleaned")']
    })
    await createKit(f)
    assert.equal(prove(f).status, status)
    const { record } = await evidenceRecord(f.repo)
    assert.equal(record.launch.exit, exit)
    assert.equal(record.launch.stdout, 'ready\n')
    assert.equal(record.cleanup.exit, 0)
    assert.equal(record.cleanup.stdout, 'cleaned\n')
    assert.equal(record.doctor?.exit ?? null, exit === 0 ? 0 : null)
  })
}

test('a launch whose readiness output arrives more than a second after the launcher exited successfully still reaches doctor', async t => {
  const f = await setup(t, value => {
    const late = 'import time; time.sleep(2); print("ready", flush=True)'
    value.launch.command = ['python3', '-c', `import subprocess, sys; subprocess.Popen([sys.executable, "-c", '${late}'])`]
    value.launch.ready = { output: 'ready' }
    value.doctor.command = ['python3', '-c', 'print("healthy")']
    value.features[0].steps = [{ label: 'Drive', command: ['python3', '-c', 'print("Hello, Ada!")'], expect: 'Hello, Ada!', match: 'Hello, Ada!' }]
    value.cleanup.command = ['python3', '-c', 'print("cleaned")']
  })
  await createKit(f)
  assert.equal(prove(f).status, 'passed')
  const { record } = await evidenceRecord(f.repo)
  assert.equal(record.launch.exit, 0)
  assert.equal(record.launch.stdout, 'ready\n')
  assert.equal(record.doctor.exit, 0)
})

test('a successful launcher with closed pipes still waits for URL readiness', async t => {
  const f = await setup(t, value => {
    value.launch.command = ['python3', '-c', 'import subprocess, sys; subprocess.Popen([sys.executable, "-m", "greeter.server", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)', '{port}']
  })
  await createKit(f)
  const result = prove(f)
  assert.equal(result.status, 'passed', JSON.stringify(result))
  const { record } = await evidenceRecord(f.repo)
  assert.equal(record.launch.exit, 0)
  assert.equal(record.doctor.exit, 0)
  assert.equal(await closed(Number(record.doctor.command.at(-1).split(':').at(-1))), true)
})

test('proof rejects a failed launcher whose descendant holds its pipes open', async t => {
  const f = await setup(t, value => {
    value.launch.command = ['python3', '-c', 'import subprocess, sys; subprocess.Popen([sys.executable, "-c", "import signal; signal.pause()"]); print("ready", flush=True); sys.exit(3)']
    value.launch.ready = { output: 'ready' }
    value.doctor.command = ['python3', '-c', 'print("healthy")']
    value.features[0].steps = [{ label: 'Drive', command: ['python3', '-c', 'print("Hello, Ada!")'], expect: 'Hello, Ada!', match: 'Hello, Ada!' }]
  })
  await createKit(f)
  const result = prove(f)
  assert.equal(result.status, 'failed', JSON.stringify(result))
  assert.ok(result.problems.some(problem => problem.code === 'launch-exited'))
  const { record } = await evidenceRecord(f.repo)
  assert.equal(record.launch.exit, 3)
})

test('the generated feature recipe retains cwd, environment and required artifacts used by proof', async t => {
  const f = await setup(t, value => {
    value.features[0].steps = [{ label: 'Drive', cwd: 'greeter', env: { GREETING: 'Hello, Ada!' },
      command: ['python3', '-c', 'import os, sys; from pathlib import Path; assert Path("greeting.py").is_file(); Path(sys.argv[1]).write_text(os.environ["GREETING"]); print(os.environ["GREETING"])', '{evidenceDir}/greeting.txt'],
      expect: 'Hello, Ada!', match: 'Hello, Ada!', artifacts: ['{evidenceDir}/greeting.txt'] }]
  })
  await createKit(f)
  const recipe = await readFile(join(f.repo, kit, 'features/greeting.md'), 'utf8')
  assert.match(recipe, /from `greeter`/)
  assert.match(recipe, /Environment: `GREETING=Hello, Ada!`/)
  assert.match(recipe, /Required artifacts: `\{evidenceDir\}\/greeting.txt`/)
  assert.equal(prove(f).status, 'passed')
  const { directory } = await evidenceRecord(f.repo)
  assert.equal(await readFile(join(directory, 'greeting.txt'), 'utf8'), 'Hello, Ada!')
})

for (const artifact of ['{runDir}/response.txt', 'response.txt', '.verification/greeter/another/response.txt']) {
  test(`proof rejects captured artifact ${artifact} before starting commands`, async t => {
    const f = await setup(t)
    await createKit(f)
    const path = join(f.repo, kit, 'kit.json')
    const value = JSON.parse(await readFile(path, 'utf8'))
    value.features[0].steps[0].artifacts = [artifact]
    value.features[0].steps[0].command = ['python3', '-c', 'from pathlib import Path; Path("drive-attempted").write_text("yes")']
    await writeFile(path, JSON.stringify(value))
    const result = prove(f)
    assert.equal(result.status, 'failed', JSON.stringify(result))
    assert.equal(result.problems[0].code, 'artifact-outside-evidence')
    assert.equal(await stat(join(f.repo, 'drive-attempted')).then(() => true, () => false), false)
    assert.equal(await stat(join(f.repo, '.verification')).then(() => true, () => false), false)
  })
}

test('proof retains a declared artifact at a normalized nested evidence path', async t => {
  const f = await setup(t, value => {
    value.features[0].steps = [{ label: 'Capture',
      command: ['python3', '-c', 'import sys; from pathlib import Path; p = Path(sys.argv[1]); p.parent.mkdir(); p.write_text("Hello, Ada!"); print("Hello, Ada!")', '{evidenceDir}/nested/response.txt'],
      expect: 'Hello, Ada!', match: 'Hello, Ada!', artifacts: ['{evidenceDir}//nested/./response.txt'] }]
  })
  await createKit(f)
  const result = prove(f)
  assert.equal(result.status, 'passed', JSON.stringify(result))
  const { directory } = await evidenceRecord(f.repo)
  assert.equal(await readFile(join(directory, 'nested/response.txt'), 'utf8'), 'Hello, Ada!')
  assert.ok(result.data.evidence.some(item => item.path === 'nested/response.txt'))
})

for (const stage of ['doctor', 'step']) {
  test(`proof rejects a launch that fails after readiness during ${stage}`, async t => {
    const drive = ['python3', '-c', 'import socket, sys; s = socket.create_connection(("127.0.0.1", int(sys.argv[1]))); s.sendall(b"x"); assert s.recv(1) == b""; print("Hello, Ada!")', '{port}']
    const f = await setup(t, value => {
      value.launch.command = ['python3', '-c', 'import os, socket, sys; s = socket.socket(); s.bind(("127.0.0.1", int(sys.argv[1]))); s.listen(); print("ready", flush=True); c, _ = s.accept(); c.recv(1); os._exit(3)', '{port}']
      value.launch.ready = { output: 'ready' }
      value.doctor.command = stage === 'doctor' ? drive : ['python3', '-c', 'print("healthy")']
      value.features[0].steps = [{ label: 'Drive', command: stage === 'step' ? drive : ['python3', '-c', 'print("Hello, Ada!")'], expect: 'Hello, Ada!', match: 'Hello, Ada!' }]
    })
    await createKit(f)
    const result = prove(f)
    assert.equal(result.status, 'failed')
    assert.ok(result.problems.some(problem => problem.code === 'launch-exited'), JSON.stringify(result))
    const { record } = await evidenceRecord(f.repo)
    assert.equal(record.launch.exit, 3)
    assert.equal(record.doctor.exit, 0)
    assert.equal(record.steps[0].exit, 0)
  })
}

test('proof preserves an undeclared artifact that replaces the reserved record and still cleans up', async t => {
  const f = await setup(t, value => {
    value.features[0].steps[0].command = ['python3', '-c', 'import sys; from pathlib import Path; Path(sys.argv[1]).write_text("captured response"); print("Hello, Ada!")', '{evidenceDir}/greeting.json']
    delete value.features[0].steps[0].artifacts
    value.cleanup.command = ['python3', '-c', 'from pathlib import Path; Path("cleanup-attempted").write_text("yes")']
  })
  await createKit(f)
  const result = prove(f)
  assert.equal(result.status, 'failed')
  assert.ok(result.problems.some(problem => problem.code === 'evidence-collision'), JSON.stringify(result))
  const root = join(f.repo, '.verification/greeter')
  const [run] = await readdir(root)
  assert.equal(await readFile(join(root, run, 'greeting.json'), 'utf8'), 'captured response')
  assert.equal(await readFile(join(f.repo, 'cleanup-attempted'), 'utf8'), 'yes')
})

test('emitted launch, doctor, cleanup and feature commands preserve literal argv in a shell', async t => {
  const literal = ['$HOME', '$(printf expanded)', '`printf expanded`', "a'b", '"quoted"', 'one\ntwo', 'semi;colon', '*', '{a,b}', '\\path']
  const command = [process.execPath, '-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...literal]
  const f = await setup(t, value => {
    value.launch.command = command
    value.doctor.command = command
    value.cleanup.command = command
    value.features[0].steps[0].command = command
  })
  await createKit(f)
  const skill = await readFile(join(f.repo, kit, 'SKILL.md'), 'utf8')
  const feature = await readFile(join(f.repo, kit, 'features/greeting.md'), 'utf8')
  const recipes = [...skill.matchAll(/^( *)~{3,}sh\n([\s\S]*?)\n\1~{3,}$/gm), ...feature.matchAll(/^( *)~{3,}sh\n([\s\S]*?)\n\1~{3,}$/gm)]
  assert.equal(recipes.length, 4)
  for (const [, indent, body] of recipes) {
    const recipe = body.split('\n').map(line => line.slice(indent.length)).join('\n')
    const executed = spawnSync('sh', ['-c', recipe], { cwd: f.repo, encoding: 'utf8' })
    assert.equal(executed.status, 0, executed.stderr)
    assert.deepEqual(JSON.parse(executed.stdout), literal)
  }
})

for (const [kind, retained, status] of [['file', true, 'passed'], ['file', false, 'failed'], ['directory', true, 'passed'], ['directory', false, 'failed']]) {
  test(`proof inventories ${kind} symlink evidence and ${retained ? 'keeps' : 'detects losing'} its bytes`, async t => {
    const artifact = kind === 'file' ? 'response.txt' : 'linked/response.txt'
    const f = await setup(t, value => {
      value.features[0].steps = [{ label: 'Capture a linked response',
        command: ['python3', '-c', 'import sys; from pathlib import Path; run, evidence, kind, retained = sys.argv[1:]; e = Path(evidence); target = e / "data" if retained == "yes" else Path(run) / "data"; target.mkdir(); response = target / "response.txt"; response.write_text("Hello, Ada!"); link = e / "response.txt" if kind == "file" else e / "linked"; link.symlink_to(response if kind == "file" else target, target_is_directory=kind == "directory"); print("Hello, Ada!")', '{runDir}', '{evidenceDir}', kind, retained ? 'yes' : 'no'],
        expect: 'Hello, Ada!', match: 'Hello, Ada!', artifacts: [`{evidenceDir}/${artifact}`] }]
    })
    await createKit(f)
    const result = prove(f)
    assert.equal(result.status, status, JSON.stringify(result))
    const { directory, record } = await evidenceRecord(f.repo)
    assert.equal(record.steps[0].exit, 0)
    assert.equal(await closed(Number(/:(\d+)$/.exec(record.doctor.command.at(-1))[1])), true)
    if (retained) {
      assert.equal(await readFile(join(directory, artifact), 'utf8'), 'Hello, Ada!')
      assert.equal(result.data.evidence.find(item => item.path === artifact)?.sha256, createHash('sha256').update('Hello, Ada!').digest('hex'))
    } else {
      assert.ok(result.problems.some(problem => problem.code === 'evidence-lost'), JSON.stringify(result))
      assert.equal(await stat(join(directory, artifact)).then(() => true, () => false), false)
    }
  })
}

for (const [cleanup, status] of [['keep', 'passed'], ['remove', 'failed'], ['change', 'failed']]) {
  test(`proof inventories undeclared nested evidence through directory aliases when cleanup will ${cleanup} it`, async t => {
    const f = await setup(t, value => {
      value.features[0].steps = [{ label: 'Capture a linked session',
        command: ['python3', '-c', 'import sys; from pathlib import Path; target = Path("captures").resolve(); target.mkdir(); nested = target / "nested"; nested.mkdir(); (target / "response.txt").write_text("Hello, Ada!"); (nested / "screenshot.png").write_bytes(b"screen bytes"); (target / "extra").symlink_to(nested, target_is_directory=True); (target / "cycle").symlink_to(target, target_is_directory=True); evidence = Path(sys.argv[1]); (evidence / "session").symlink_to(target, target_is_directory=True); (evidence / "mirror").symlink_to(target, target_is_directory=True); print("Hello, Ada!")', '{evidenceDir}'],
        expect: 'Hello, Ada!', match: 'Hello, Ada!', artifacts: ['{evidenceDir}/session/response.txt'] }]
      if (cleanup === 'remove') value.cleanup.command = ['python3', '-c', 'from pathlib import Path; Path("captures/nested/screenshot.png").unlink()']
      if (cleanup === 'change') value.cleanup.command = ['python3', '-c', 'from pathlib import Path; Path("captures/nested/screenshot.png").write_bytes(b"different bytes")']
    })
    await createKit(f)
    const result = prove(f)
    assert.equal(result.status, status, JSON.stringify(result))
    const { directory, record } = await evidenceRecord(f.repo)
    assert.equal(record.steps[0].exit, 0)
    assert.equal(await readFile(join(directory, 'session/response.txt'), 'utf8'), 'Hello, Ada!')
    if (cleanup === 'keep') {
      const hash = createHash('sha256').update('screen bytes').digest('hex')
      assert.deepEqual(result.data.evidence.filter(item => item.path.endsWith('screenshot.png')), [
        { path: 'mirror/extra/screenshot.png', sha256: hash },
        { path: 'mirror/nested/screenshot.png', sha256: hash },
        { path: 'session/extra/screenshot.png', sha256: hash },
        { path: 'session/nested/screenshot.png', sha256: hash }
      ])
    } else {
      assert.ok(result.problems.some(problem => problem.code === 'evidence-lost'), JSON.stringify(result))
    }
  })
}

for (const [text, status] of [['café', 'passed'], ['cafè', 'failed']]) {
  test(`proof preserves split UTF-8 on both streams and ${status === 'passed' ? 'matches' : 'rejects'} ${text}`, async t => {
    const command = text => ['python3', '-c', `import sys; print(${JSON.stringify(text)}); print(${JSON.stringify(text)}, file=sys.stderr)`]
    const f = await setup(t, value => {
      value.launch.command = command('café')
      value.launch.ready = { output: 'café' }
      value.doctor.command = command('café')
      value.features[0].steps = [{ label: 'Read Unicode output', command: command(text), expect: 'café', match: '^café\\n$' }]
      value.cleanup.command = command('café')
    })
    await createKit(f)
    const hook = join(f.cache, 'split-output.mjs')
    await writeFile(hook, `import childProcess from 'node:child_process'\nimport { syncBuiltinESMExports } from 'node:module'\nimport { PassThrough } from 'node:stream'\nconst spawn = childProcess.spawn\nchildProcess.spawn = (...args) => {\n  const child = spawn(...args)\n  for (const name of ['stdout', 'stderr']) {\n    const original = child[name]\n    const split = new PassThrough()\n    original.on('data', chunk => { for (const byte of chunk) split.write(Buffer.from([byte])) })\n    original.on('end', () => split.end())\n    child[name] = split\n  }\n  return child\n}\nsyncBuiltinESMExports()\n`)
    const result = runVerification('kit prove', f.repo, { ...f.env, NODE_OPTIONS: `--import=${JSON.stringify(hook)}` }, ['--app', 'greeter', '--feature', 'greeting'])
    assert.equal(result.status, status, JSON.stringify(result))
    const { record } = await evidenceRecord(f.repo)
    assert.equal(record.launch.exit, 0)
    assert.equal(record.launch.stdout, 'café\n')
    assert.equal(record.launch.stderr, 'café\n')
    assert.equal(record.doctor.stdout, 'café\n')
    assert.equal(record.doctor.stderr, 'café\n')
    assert.equal(record.steps[0].stdout, `${text}\n`)
    assert.equal(record.steps[0].stderr, `${text}\n`)
    assert.equal(record.cleanup.stdout, 'café\n')
    assert.equal(record.cleanup.stderr, 'café\n')
    if (status === 'failed') assert.ok(result.problems.some(problem => problem.code === 'step-mismatch'), JSON.stringify(result))
  })
}

test('proof matches a feature result preceding logs beyond the recorded preview limit', async t => {
  const f = await setup(t, value => {
    value.features[0].steps = [{ label: 'Read the result before logs', command: ['python3', '-c', 'print("Hello, Ada!"); print("x" * 70000)'], expect: 'Hello, Ada!', match: 'Hello, Ada!' }]
  })
  await createKit(f)
  const result = prove(f)
  assert.equal(result.status, 'passed', JSON.stringify(result))
  const { record } = await evidenceRecord(f.repo)
  assert.equal(record.steps[0].matched, true)
  assert.equal(record.steps[0].stdout, `${'x'.repeat(65535)}\n`)
})

for (const [readyStream, stepText, status] of [['stdout', 'Hello, Ada!', 'passed'], ['stderr', 'Hello, Ada!', 'passed'], ['stdout', 'Goodbye', 'failed']]) {
  test(`proof matches full output with readiness on ${readyStream} and ${status === 'passed' ? 'accepts' : 'rejects'} ${stepText} while bounding evidence previews`, async t => {
    const noisy = (stdout, stderr) => ['python3', '-c', `import sys; sys.stdout.write(${JSON.stringify(stdout)} + "\\n" + "x" * 70000 + "\\n"); sys.stderr.write(${JSON.stringify(stderr)} + "\\n" + "y" * 70000 + "\\n")`]
    const f = await setup(t, value => {
      value.launch.command = noisy(readyStream === 'stdout' ? 'READY' : 'launch logs', readyStream === 'stderr' ? 'READY' : 'launch logs')
      value.launch.ready = { output: 'READY' }
      value.doctor.command = noisy('healthy', 'doctor logs')
      value.features[0].steps = [{ label: 'Read noisy output', command: noisy(stepText, 'step logs'), expect: 'Hello, Ada! followed by logs.', match: '^Hello, Ada!\\nx{70000}\\n$' }]
      value.cleanup.command = noisy('cleaned', 'cleanup logs')
    })
    await createKit(f)
    const result = prove(f)
    assert.equal(result.status, status, JSON.stringify(result))
    const { record } = await evidenceRecord(f.repo)
    assert.equal(record.launch.exit, 0)
    assert.equal(record.steps[0].matched, status === 'passed')
    for (const captured of [record.launch, record.doctor, record.steps[0], record.cleanup]) {
      assert.equal(captured.stdout, `${'x'.repeat(65535)}\n`)
      assert.equal(captured.stderr, `${'y'.repeat(65535)}\n`)
    }
    if (status === 'failed') assert.ok(result.problems.some(problem => problem.code === 'step-mismatch'), JSON.stringify(result))
  })
}

for (const stage of ['doctor', 'step', 'cleanup']) {
  test(`proof bounds a ${stage} command that ignores SIGTERM`, async t => {
    const command = ['python3', '-c', 'import os, signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); print(os.getpid(), flush=True); time.sleep(60)']
    const f = await setup(t, value => {
      if (stage === 'step') value.features[0].steps[0].command = command
      else value[stage].command = command
    })
    await createKit(f)
    const hook = join(f.cache, 'clock.mjs')
    await writeFile(hook, `const original = globalThis.setTimeout\nglobalThis.setTimeout = (fn, delay, ...args) => original(fn, delay === 120000 ? 1000 : delay === 5000 ? 100 : delay, ...args)\n`)
    const result = runVerification('kit prove', f.repo, { ...f.env, NODE_OPTIONS: `--import=${JSON.stringify(hook)}` }, ['--app', 'greeter', '--feature', 'greeting'])
    assert.equal(result.status, 'failed')
    assert.ok(result.problems.some(item => item.code === `${stage}-failed`), JSON.stringify(result))
    const { record } = await evidenceRecord(f.repo)
    const captured = stage === 'step' ? record.steps[0] : record[stage]
    assert.equal(captured.timedOut, true)
    assert.equal(captured.exit, null)
    assert.throws(() => process.kill(Number(captured.stdout.trim()), 0), { code: 'ESRCH' })
    if (stage !== 'doctor') assert.equal(await closed(Number(/:(\d+)$/.exec(record.doctor.command.at(-1))[1])), true)
  })
}

for (const fault of ['write', 'hash', 'cleanup']) {
  test(`a ${fault} failure still stops the service, attempts cleanup and removes the run directory`, async t => {
    const f = await setup(t, value => {
      value.doctor.command.push('{runDir}')
      value.cleanup.command = ['python3', '-c', 'from pathlib import Path; Path("cleanup-attempted").write_text("yes")']
    })
    await createKit(f)
    const hook = join(f.cache, 'filesystem.mjs')
    await writeFile(hook, `import fs from 'node:fs/promises'\nimport { syncBuiltinESMExports } from 'node:module'\nconst write = fs.writeFile\nconst read = fs.readFile\nlet captured = false\nfs.writeFile = async (path, data, ...args) => {\n  if (String(path).endsWith('/greeting.json')) {\n    const record = JSON.parse(data)\n    if (!record.doctor) return write(path, data, ...args)\n    captured = true\n    await write(${JSON.stringify(join(f.repo, 'lifecycle.json'))}, JSON.stringify({ port: Number(record.doctor.command.at(-2).split(':').at(-1)), runDir: record.doctor.command.at(-1) }))\n    if (${JSON.stringify(fault)} === 'write') throw new Error('seeded evidence write failure')\n  }\n  return write(path, data, ...args)\n}\nfs.readFile = async (path, ...args) => {\n  if (captured && ${JSON.stringify(fault)} === 'hash' && String(path).endsWith('/greeting.json')) throw new Error('seeded evidence hash failure')\n  return read(path, ...args)\n}\nif (${JSON.stringify(fault)} === 'cleanup') {\n  const timers = globalThis.setTimeout\n  globalThis.setTimeout = (fn, delay, ...args) => {\n    if (delay === 120000 && process.env.FAIL_CLEANUP === 'yes') throw new Error('seeded cleanup failure')\n    return timers(fn, delay, ...args)\n  }\n  const spawn = (await import('node:child_process')).default\n  const start = spawn.spawn\n  spawn.spawn = (...args) => {\n    if (args[1]?.includes('from pathlib import Path; Path("cleanup-attempted").write_text("yes")')) process.env.FAIL_CLEANUP = 'yes'\n    return start(...args)\n  }\n}\nsyncBuiltinESMExports()\n`)
    const result = runVerification('kit prove', f.repo, { ...f.env, NODE_OPTIONS: `--import=${JSON.stringify(hook)}` }, ['--app', 'greeter', '--feature', 'greeting'])
    assert.equal(result.status, 'blocked')
    const lifecycle = JSON.parse(await readFile(join(f.repo, 'lifecycle.json'), 'utf8'))
    assert.equal(await closed(lifecycle.port), true)
    assert.equal(await stat(lifecycle.runDir).then(() => true, () => false), false)
    if (fault !== 'cleanup') assert.equal(await readFile(join(f.repo, 'cleanup-attempted'), 'utf8'), 'yes')
  })
}

test('maintain finds an unchanged kit clean and every mapped feature still passes', async t => {
  const f = await setup(t)
  await createKit(f)
  const checked = f.call('kit check', ['--app', 'greeter'])
  assert.equal(checked.exit, 0, JSON.stringify(checked))
  assert.deepEqual(checked.data.features, ['greeting'])
  assert.equal(prove(f).status, 'passed')
})

for (const [name, drift, code, path] of [
  ['a hand-edited feature file', f => writeFile(join(f.repo, kit, 'features/greeting.md'), 'Source paths: `elsewhere/**`\n'), 'file-drift', `${kit}/features/greeting.md`],
  ['a deleted feature file', f => rm(join(f.repo, kit, 'features/greeting.md')), 'file-missing', `${kit}/features/greeting.md`],
  ['a feature file the kit does not list', f => writeFile(join(f.repo, kit, 'features/stale.md'), '# Stale\n'), 'orphan-feature-file', `${kit}/features/stale.md`],
  ['a helper changed by hand', f => writeFile(join(f.repo, kit, 'scripts/greet.py'), 'print("changed")\n'), 'file-drift', `${kit}/scripts/greet.py`],
  ['a removed AGENTS.md pointer', f => writeFile(join(f.repo, 'AGENTS.md'), '# Agent instructions\n'), 'pointer-missing', 'AGENTS.md'],
  ['a feature whose source moved', f => rename(join(f.repo, 'greeter'), join(f.repo, 'app')), 'source-path-missing', `${kit}/features/greeting.md`]
]) {
  test(`maintain flags ${name} as ${code}`, async t => {
    const f = await setup(t)
    await createKit(f)
    await drift(f)
    const checked = f.call('kit check', ['--app', 'greeter'])
    assert.equal(checked.exit, 1, JSON.stringify(checked))
    assert.deepEqual(checked.problems.map(({ code, path }) => ({ code, path })), [{ code, path }])
  })
}

test('maintain locates the first differing line of a drifted feature file', async t => {
  const f = await setup(t)
  await createKit(f)
  const path = join(f.repo, kit, 'features/greeting.md')
  await writeFile(path, (await readFile(path, 'utf8')).replace('A client requests', 'A client demands'))
  assert.match(f.call('kit check', ['--app', 'greeter']).problems[0].message, /first at line 3\./)
})

test('a corrected plan updates the kit, removes the feature file it dropped and leaves maintain clean', async t => {
  const f = await setup(t)
  await createKit(f)
  const value = plan()
  Object.assign(value.features[0], { id: 'hello', title: 'Hello', summary: 'A client requests a personal hello by name.' })
  await writeFile(f.file, JSON.stringify(value))
  const update = f.call('kit scaffold', ['--plan', f.file, '--update'])
  assert.equal(update.exit, 0, JSON.stringify(update))
  assert.deepEqual(update.data.files.toSorted(), [`${kit}/SKILL.md`, `${kit}/features/README.md`, `${kit}/features/greeting.md`, `${kit}/features/hello.md`, `${kit}/kit.json`].toSorted())
  assert.equal(f.call('apply', ['--plan', update.data.path]).exit, 0)
  assert.equal(await stat(join(f.repo, kit, 'features/greeting.md')).then(() => true, () => false), false)
  assert.equal(f.call('kit check', ['--app', 'greeter']).exit, 0)
  assert.equal(f.call('kit prove', ['--app', 'greeter', '--feature', 'hello']).status, 'passed')
})

test('an update restores only the drifted file and proposes nothing once the kit is clean', async t => {
  const f = await setup(t)
  await createKit(f)
  await rm(join(f.repo, kit, 'features/greeting.md'))
  const update = f.call('kit scaffold', ['--plan', f.file, '--update'])
  assert.deepEqual(update.data.files, [`${kit}/features/greeting.md`])
  const applied = f.call('apply', ['--plan', update.data.path])
  assert.equal(applied.exit, 0, JSON.stringify(applied))
  const clean = f.call('kit scaffold', ['--plan', f.file, '--update'])
  assert.deepEqual({ exit: clean.exit, path: clean.data.path, files: clean.data.files }, { exit: 0, path: null, files: [] })
})

test('an update deletes dropped helpers and the disabled coverage gate', async t => {
  const f = await setup(t, value => { value.coverageGate = true })
  await createKit(f)
  const value = plan()
  value.helpers[0].path = 'scripts/health.py'
  value.helpers.pop()
  await writeFile(f.file, JSON.stringify(value))
  const update = f.call('kit scaffold', ['--plan', f.file, '--update'])
  assert.equal(update.exit, 0, JSON.stringify(update))
  const changes = JSON.parse(await readFile(update.data.path, 'utf8'))
  assert.deepEqual(changes.edits.filter(edit => edit.operation === 'delete').map(edit => edit.path), [
    `${kit}/scripts/doctor.py`, `${kit}/scripts/greet.py`, `${kit}/scripts/map-coverage.mjs`
  ])
  assert.equal(f.call('apply', ['--plan', update.data.path]).exit, 0)
  for (const name of ['doctor.py', 'greet.py', 'map-coverage.mjs']) {
    assert.equal(await stat(join(f.repo, kit, 'scripts', name)).then(() => true, () => false), false)
  }
  assert.equal(await readFile(join(f.repo, kit, 'scripts/health.py'), 'utf8'), doctorHelper)
  assert.equal(f.call('kit check', ['--app', 'greeter']).exit, 0)
})

for (const sourcePath of ['./greeter', 'greeter/']) {
  test(`an update repairs a previously accepted source declaration ${sourcePath}`, async t => {
    const f = await setup(t)
    await createKit(f)
    const old = plan()
    old.features[0].sourcePaths = [sourcePath]
    await writeFile(join(f.repo, kit, 'kit.json'), JSON.stringify(old))
    const value = plan()
    value.features[0].sourcePaths = ['greeter']
    value.helpers[0].path = 'scripts/health.py'
    value.helpers[0].invocation = `python3 ${kit}/scripts/health.py <url>`
    value.doctor.command[1] = `${kit}/scripts/health.py`
    await writeFile(f.file, JSON.stringify(value))
    const update = f.call('kit scaffold', ['--plan', f.file, '--update'])
    assert.equal(update.exit, 0, JSON.stringify(update))
    assert.equal(f.call('apply', ['--plan', update.data.path]).exit, 0)
    assert.equal(await stat(join(f.repo, kit, 'scripts/doctor.py')).then(() => true, () => false), false)
    assert.equal(f.call('kit check', ['--app', 'greeter']).exit, 0)
    assert.equal(prove(f).status, 'passed')
  })
}

test('an update rejects unsafe managed paths in the previous plan', async t => {
  const f = await setup(t)
  await createKit(f)
  const old = plan()
  old.helpers[0].path = '../escape.py'
  await writeFile(join(f.repo, kit, 'kit.json'), JSON.stringify(old))
  const result = f.call('kit scaffold', ['--plan', f.file, '--update'])
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.equal(result.problems[0].code, 'unsafe-path')
  assert.equal(result.data.path, undefined)
})

const author = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com']

function commit(f, message) {
  git(f.repo, 'add', '-A')
  git(f.repo, ...author, 'commit', '-q', '-m', message)
}

function coverage(f, base = 'main') {
  const result = spawnSync(process.execPath, [join(f.repo, kit, 'scripts/map-coverage.mjs'), '--base', base], { cwd: f.repo, encoding: 'utf8' })
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr }
}

async function gatedBranch(t) {
  const f = await setup(t, value => { value.coverageGate = true })
  await createKit(f)
  commit(f, 'add kit')
  git(f.repo, 'checkout', '-q', '-b', 'change')
  return f
}

const changeSource = f => appendFile(join(f.repo, 'greeter/greeting.py'), '\n')
const changeFeatureFile = f => appendFile(join(f.repo, kit, 'features/greeting.md'), '\n')

for (const [name, change, message, exit] of [
  ['a mapped source change with no map update', changeSource, 'Change greeting', 1],
  ['a mapped source change with its feature file updated', async f => { await changeSource(f); await changeFeatureFile(f) }, 'Change greeting', 0],
  ['a mapped source change with a no-impact reason for that feature', changeSource, 'Change greeting\n\nNo-map-impact: greeting: internal rename only', 0],
  ['a mapped source change with a no-impact reason for another feature', changeSource, 'Change greeting\n\nNo-map-impact: checkout: not this one', 1],
  ['a mapped source change with an empty no-impact reason', changeSource, 'Change greeting\n\nNo-map-impact: greeting:', 1],
  ['a deleted mapped source file', f => rm(join(f.repo, 'greeter/greeting.py')), 'Remove greeting', 1],
  ['a change outside every feature', f => appendFile(join(f.repo, 'pyproject.toml'), '\n'), 'Tidy project metadata', 0]
]) {
  test(`the coverage gate exits ${exit} for ${name}`, async t => {
    const f = await gatedBranch(t)
    await change(f)
    commit(f, message)
    const result = coverage(f)
    assert.equal(result.exit, exit, JSON.stringify(result))
    if (exit === 1) assert.match(result.stdout, new RegExp(`^${kit}/features/greeting\\.md: feature-map-coverage: greeter/greeting\\.py changed without updating this feature file`))
  })
}

test('the coverage gate counts a mapped source change that is not committed yet', async t => {
  const f = await gatedBranch(t)
  await changeSource(f)
  assert.equal(coverage(f).exit, 1)
})

for (const sourcePath of ['greeter/?.py', 'greeter/🧪.py', 'greeter/*/?.py', 'greeter/**/?.py']) {
  test(`kit check and coverage agree on Unicode source path ${sourcePath}`, async t => {
    const f = await setup(t, value => {
      value.coverageGate = true
      value.features[0].sourcePaths = [sourcePath]
    })
    const directory = join(f.repo, 'greeter', '🧪')
    await mkdir(directory)
    await writeFile(join(f.repo, 'greeter/🧪.py'), 'value = 1\n')
    await writeFile(join(directory, '🧪.py'), 'value = 1\n')
    await createKit(f)
    assert.equal(f.call('kit check', ['--app', 'greeter']).exit, 0)
    commit(f, 'Add Unicode source and kit')
    git(f.repo, 'checkout', '-q', '-b', 'change')
    await appendFile(join(f.repo, 'greeter/🧪.py'), 'value = 2\n')
    await appendFile(join(directory, '🧪.py'), 'value = 2\n')
    const result = coverage(f)
    assert.equal(result.exit, 1, JSON.stringify(result))
  })
}

test('coverage matches Unicode line separators within recursive source globs', async t => {
  const f = await gatedBranch(t)
  const path = join(f.repo, 'greeter', '\u2028.py')
  await writeFile(path, 'value = 1\n')
  const result = coverage(f)
  assert.equal(result.exit, 1, JSON.stringify(result))
})

for (const layer of ['committed', 'staged']) {
  test(`the coverage gate retains ${layer} changes reversed in another layer`, async t => {
    const f = await gatedBranch(t)
    await changeSource(f)
    git(f.repo, 'add', 'greeter/greeting.py')
    if (layer === 'committed') commit(f, 'Change greeting')
    git(f.repo, 'restore', '--source=main', '--worktree', 'greeter/greeting.py')
    if (layer === 'committed') git(f.repo, 'add', 'greeter/greeting.py')
    assert.equal(coverage(f).exit, 1)
  })
}

test('the coverage gate retains a staged feature update reversed in the worktree', async t => {
  const f = await gatedBranch(t)
  await changeSource(f)
  await changeFeatureFile(f)
  git(f.repo, 'add', `${kit}/features/greeting.md`)
  git(f.repo, 'restore', '--source=HEAD', '--worktree', `${kit}/features/greeting.md`)
  assert.equal(coverage(f).exit, 0)
})

for (const sourcePath of ['./greeter', 'greeter/', '/greeter', 'greeter\\greeting.py', 'greeter/**x', 'greeter/[ab]']) {
  test(`scaffold and coverage reject the noncanonical source path ${sourcePath}`, async t => {
    const f = await gatedBranch(t)
    const value = plan()
    value.features[0].sourcePaths = [sourcePath]
    await writeFile(f.file, JSON.stringify(value))
    const result = f.call('kit scaffold', ['--plan', f.file, '--update'])
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'invalid-glob')
    await writeFile(join(f.repo, kit, 'features/greeting.md'), `Source paths: \`${sourcePath}\`\n`)
    const gate = coverage(f)
    assert.equal(gate.exit, 2, JSON.stringify(gate))
    assert.match(gate.stderr, /Invalid source path:/)
  })
}

test('the gate command in the proposed wiring runs the generated script and fails an uncovered change', async t => {
  const reference = await readFile(new URL('../../skills/verification/references/no-mistakes.md', import.meta.url), 'utf8')
  const [gate] = parse(/```yaml\n([\s\S]*?)```/.exec(reference)[1]).gates
  assert.equal(gate.after, 'document')
  const f = await gatedBranch(t)
  const command = gate.command.replaceAll('verify-shop', 'verify-greeter').replaceAll('origin/main', 'main')
  const run = () => spawnSync('sh', ['-c', command], { cwd: f.repo, encoding: 'utf8' }).status
  assert.equal(run(), 0)
  await changeSource(f)
  assert.equal(run(), 1)
})

test('the coverage gate reports an unresolvable base as an error, not a pass', async t => {
  const f = await gatedBranch(t)
  const result = coverage(f, 'origin/missing')
  assert.equal(result.exit, 2)
  assert.match(result.stderr, /^feature-map-coverage: /)
})
