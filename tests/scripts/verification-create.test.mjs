import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { connect } from 'node:net'
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
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
