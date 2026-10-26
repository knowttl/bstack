import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { build, git, runVerification, snapshot } from './discovery-fixture.mjs'

// The prototype skill is driven through its installed folder against a fixture target whose kit the verification skill created.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/prototype')
const entry = join(skill, 'scripts/prototype.mjs')

const kit = '.agents/skills/verify-greeter'
const probe = 'import sys, urllib.request as u; print(u.urlopen(sys.argv[1], timeout=5).read().decode())'
const plan = {
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
  doctor: { command: ['python3', '-c', probe, 'http://127.0.0.1:{port}/health'], asserts: 'The health endpoint answers ok on the port this run owns.' },
  drive: { harness: 'a Python HTTP client', conventions: ['Run every command from the repo root.'] },
  evidence: { directory: '.verification/greeter', standards: ['Capture the response body, not only the exit code.'] },
  cleanup: { notes: ['Remove the run directory and keep the evidence directory.'] },
  helpers: [],
  features: [{
    id: 'greeting', title: 'Greeting', summary: 'A client requests a personal greeting by name.', sourcePaths: ['greeter/**'],
    subFeatures: [{ id: 'greeting-named', description: 'Returns a greeting for a given name.' }],
    entryPoints: ['Request GET /greet?name=<name> on the service port.'], preconditions: ['The service is healthy.'],
    steps: [{
      label: 'Request a named greeting', command: ['python3', '-c', probe, 'http://127.0.0.1:{port}/greet?name=Ada'],
      expect: 'The body reads Hello, Ada!', match: 'Hello, Ada!'
    }],
    gotchas: ['The service answers 404 for any other path.']
  }]
}

async function fixture(t) {
  const target = build(t, 'py-greeter')
  const directory = await mkdtemp(join(tmpdir(), 'bstack prototype '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const env = { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  const file = join(directory, 'kit-plan.json')
  await writeFile(file, JSON.stringify(plan))
  const scaffold = runVerification('kit scaffold', target, env, ['--plan', file])
  assert.equal(scaffold.exit, 0, JSON.stringify(scaffold))
  assert.equal(runVerification('apply', target, env, ['--plan', scaffold.data.path]).exit, 0)
  git(target, 'add', '--all')
  git(target, 'commit', '-q', '-m', 'chore: add the verification kit')
  const clone = name => {
    const path = join(directory, name)
    assert.equal(spawnSync('git', ['clone', '--no-hardlinks', '-q', target, path]).status, 0)
    git(path, 'remote', 'remove', 'origin')
    return path
  }
  const prototype = (command, repo) => {
    const result = spawnSync(process.execPath, [entry, ...command.split(' '), '--repo', repo, '--app', 'greeter', ...(command === 'kit prove' ? ['--feature', 'greeting'] : []), '--json'],
      { cwd: directory, env, encoding: 'utf8' })
    assert.equal(result.stderr, '')
    return { exit: result.status, ...JSON.parse(result.stdout) }
  }
  return { target, directory, clone, prototype }
}

test('prototype declares explicit-only invocation metadata and ships only the kit check and kit prove commands', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  assert.equal(parse(document.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1])['disable-model-invocation'], true)
  assert.equal(parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8')).policy.allow_implicit_invocation, false)
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.deepEqual(help.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()), ['kit check', 'kit prove'])
})

test('two variants are driven and measured with the kit while the target stays byte-identical', async t => {
  const f = await fixture(t)
  const before = { files: await snapshot(f.target), head: git(f.target, 'rev-parse', 'HEAD'), status: git(f.target, 'status', '--porcelain', '--ignored') }
  assert.equal(f.prototype('kit check', f.target).exit, 0)

  const baseline = f.clone('baseline')
  const kept = f.clone('kept')
  const broken = f.clone('broken')
  await writeFile(join(broken, 'greeter/greeting.py'), 'def greeting(name: str) -> str:\n    return f"Hi, {name}!"\n')

  const results = Object.fromEntries(['baseline', 'kept', 'broken'].map((name, index) => [name, f.prototype('kit prove', [baseline, kept, broken][index])]))
  assert.equal(results.baseline.exit, 0, JSON.stringify(results.baseline))
  assert.equal(results.kept.exit, 0, JSON.stringify(results.kept))
  assert.equal(results.broken.exit, 1)
  assert.equal(results.broken.problems[0].code, 'step-mismatch')

  const record = JSON.parse(await readFile(join(kept, results.kept.data.evidenceDirectory, 'greeting.json'), 'utf8'))
  assert.equal(record.steps[0].stdout.trim(), 'Hello, Ada!')
  const failed = JSON.parse(await readFile(join(broken, results.broken.data.evidenceDirectory, 'greeting.json'), 'utf8'))
  assert.equal(failed.runId, results.broken.data.runId)
  assert.equal(failed.steps[0].stdout.trim(), 'Hi, Ada!')

  assert.deepEqual({ files: await snapshot(f.target), head: git(f.target, 'rev-parse', 'HEAD'), status: git(f.target, 'status', '--porcelain', '--ignored') }, before)
})
