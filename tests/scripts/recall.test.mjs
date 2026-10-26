import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'

// The skill is driven through its installed folder against synthetic host folders, never a real transcript.
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/recall')
const entry = join(skill, 'scripts/recall.mjs')

const jsonl = records => records.map(record => typeof record === 'string' ? record : JSON.stringify(record)).join('\n') + '\n'
const claudeFolder = path => path.replaceAll(/[^a-zA-Z0-9]/g, '-')

function claudeSession(cwd, turns) {
  return jsonl([
    { type: 'last-prompt', sessionId: 's' },
    ...turns.map(([type, content, extra], index) => ({ type, message: { role: type, content }, cwd, sessionId: 's', timestamp: `2026-10-01T10:00:0${index}.000Z`, ...extra }))
  ])
}

function codexSession(cwd, turns, source = 'cli') {
  return jsonl([
    { type: 'session_meta', timestamp: '2026-10-02T10:00:00.000Z', payload: { id: 'c', cwd, source } },
    ...turns.map(([role, type, text], index) => ({ type: 'response_item', timestamp: `2026-10-02T10:00:0${index + 1}.000Z`, payload: { type: 'message', role, content: [{ type, text }] } })),
    { type: 'response_item', timestamp: '2026-10-02T10:00:09.000Z', payload: { type: 'function_call', name: 'shell', arguments: 'CODEX-TOOL-CALL' } }
  ])
}

async function fixture(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'bstack recall ')))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repo = join(directory, 'project')
  const other = join(directory, 'project-two')
  await mkdir(join(repo, 'sub'), { recursive: true })
  await mkdir(other)
  await writeFile(join(repo, 'README.md'), '# Demo\n')
  assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0)
  const claude = join(directory, 'claude')
  const codex = join(directory, 'codex')
  const write = async (path, content) => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }
  await write(join(claude, 'projects', claudeFolder(repo), 'mine.jsonl'), claudeSession(repo, [
    ['user', 'CLAUDE-USER use the queue for retries', {}],
    ['assistant', [{ type: 'text', text: 'CLAUDE-ASSISTANT queue chosen' }, { type: 'tool_use', name: 'Bash', input: { command: 'CLAUDE-TOOL-USE' } }], {}],
    ['user', [{ type: 'tool_result', content: 'CLAUDE-TOOL-RESULT' }], {}],
    ['assistant', [{ type: 'text', text: 'CLAUDE-SIDECHAIN' }], { isSidechain: true }],
    ['user', 'CLAUDE-META', { isMeta: true }],
    ['user', 'CLAUDE-LONG ' + 'x'.repeat(2500), {}]
  ]) + '{"type":"user","message":{"role":"user","content":"CLAUDE-PARTIAL')
  await write(join(claude, 'projects', claudeFolder(join(repo, 'sub')), 'sub.jsonl'), claudeSession(join(repo, 'sub'), [['user', 'CLAUDE-SUB started in a subfolder', {}]]))
  await write(join(claude, 'projects', claudeFolder(other), 'other.jsonl'), claudeSession(other, [['user', 'CLAUDE-OTHER-PROJECT', {}]]))
  await write(join(codex, 'sessions/2026/10/02/rollout-mine.jsonl'), codexSession(repo, [
    ['developer', 'input_text', 'CODEX-DEVELOPER'], ['user', 'input_text', 'CODEX-USER keep the schema'], ['assistant', 'output_text', 'CODEX-ASSISTANT schema kept']
  ]))
  await write(join(codex, 'sessions/2026/10/03/rollout-other.jsonl'), codexSession(other, [['user', 'input_text', 'CODEX-OTHER-PROJECT']]))
  const env = { ...process.env, CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  return { directory, repo, claude, codex, env }
}

function transcripts(context, repo = context.repo) {
  const result = spawnSync(process.execPath, [entry, 'transcripts', '--repo', repo, '--json'], { cwd: context.directory, env: context.env, encoding: 'utf8' })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

async function snapshot(...roots) {
  const hashes = {}
  for (const root of roots) {
    for (const name of await readdir(root, { recursive: true })) {
      const path = join(root, name)
      if ((await stat(path)).isFile()) hashes[path] = createHash('sha256').update(await readFile(path)).digest('hex')
    }
  }
  return hashes
}

async function digests(result) {
  return Object.fromEntries(await Promise.all(result.data.sessions.map(async session => [session.digest, await readFile(session.digest, 'utf8')])))
}

test('recall declares explicit-only invocation metadata and ships only the transcripts command', async () => {
  const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
  assert.equal(parse(document.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1])['disable-model-invocation'], true)
  assert.equal(parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8')).policy.allow_implicit_invocation, false)
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.deepEqual(help.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()), ['transcripts'])
})

test('transcripts digests only this project\'s sessions into scratch and leaves transcripts and repo unchanged', async t => {
  const context = await fixture(t)
  const before = await snapshot(context.repo, context.claude, context.codex)
  const result = transcripts(context)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(await snapshot(context.repo, context.claude, context.codex), before)
  assert.equal(spawnSync('git', ['-C', context.repo, 'status', '--porcelain'], { encoding: 'utf8' }).stdout, '?? README.md\n')
  assert.equal(result.data.path.startsWith(context.repo), false)
  assert.equal((await stat(result.data.path)).mode & 0o077, 0)
  for (const { digest } of result.data.sessions) {
    assert.equal(digest.startsWith(`${result.data.path}/`), true)
    assert.equal((await stat(digest)).mode & 0o077, 0)
  }
  assert.deepEqual(result.data.sessions.map(session => `${session.host} ${session.cwd.replace(context.directory, '')}`).sort(),
    ['claude-code /project', 'claude-code /project/sub', 'codex /project'])
  const text = Object.values(await digests(result)).join('\n')
  for (const kept of ['CLAUDE-USER', 'CLAUDE-ASSISTANT', 'CLAUDE-SUB', 'CODEX-USER', 'CODEX-ASSISTANT']) assert.match(text, new RegExp(kept), kept)
  for (const left of ['CLAUDE-OTHER-PROJECT', 'CODEX-OTHER-PROJECT', 'CLAUDE-TOOL-USE', 'CLAUDE-TOOL-RESULT', 'CLAUDE-SIDECHAIN', 'CLAUDE-META', 'CODEX-DEVELOPER', 'CODEX-TOOL-CALL']) {
    assert.doesNotMatch(text, new RegExp(left), left)
  }
})

test('transcripts cuts a long turn, counts a partial last line and reports the opening prompt', async t => {
  const context = await fixture(t)
  const result = transcripts(context)
  const mine = result.data.sessions.find(session => session.host === 'claude-code' && session.cwd === context.repo)
  assert.equal(result.data.skippedLines, 1)
  assert.equal(mine.firstPrompt, 'CLAUDE-USER use the queue for retries')
  const digest = (await digests(result))[mine.digest]
  assert.match(digest, /CLAUDE-LONG x+ \[\d+ more characters\]/)
  assert.doesNotMatch(digest, /x{2100}/)
  assert.doesNotMatch(digest, /CLAUDE-PARTIAL/)
})

test('transcripts passes with a limitation when no session started in the project', async t => {
  const context = await fixture(t)
  const empty = join(context.directory, 'empty')
  await mkdir(empty)
  assert.equal(spawnSync('git', ['init', '-q', empty]).status, 0)
  const result = transcripts(context, empty)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.sessions, [])
  assert.match(result.data.limitations[0], /No Claude Code or Codex transcript/)
})

test('transcripts passes when neither host has a transcript folder', async t => {
  const context = await fixture(t)
  context.env.CLAUDE_CONFIG_DIR = join(context.directory, 'missing-claude')
  context.env.CODEX_HOME = join(context.directory, 'missing-codex')
  const result = transcripts(context)
  assert.equal(result.exit, 0)
  assert.deepEqual(result.data.sessions, [])
})

test('transcripts excludes Codex sub-agent sessions', async t => {
  const context = await fixture(t)
  const folder = join(context.codex, 'sessions/2026/10/02')
  for (const [name, source] of [
    ['spawn', { subagent: { thread_spawn: { parent_thread_id: 'parent', depth: 1 } } }],
    ['review', { subagent: 'review' }],
    ['compact', { subagent: 'compact' }]
  ]) {
    await writeFile(join(folder, `rollout-${name}.jsonl`), codexSession(context.repo, [['user', 'input_text', 'DELEGATED-PROMPT'], ['assistant', 'output_text', 'DELEGATED-RESPONSE']], source))
  }
  const result = transcripts(context)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.sessions.length, 3)
  assert.doesNotMatch(JSON.stringify(result), /DELEGATED/)
  assert.doesNotMatch(Object.values(await digests(result)).join('\n'), /DELEGATED/)
})

for (const host of ['claude', 'codex']) {
  test(`transcripts blocks when the ${host} history root is not a directory`, async t => {
    const context = await fixture(t)
    const folder = join(context[host], host === 'claude' ? 'projects' : 'sessions')
    await rm(folder, { recursive: true })
    await writeFile(folder, 'not a directory')
    const result = transcripts(context)
    assert.equal(result.exit, 2)
    assert.equal(result.status, 'blocked')
    assert.match(result.problems[0].message, /ENOTDIR/)
  })
}

test('transcripts releases early inspection streams across large host histories', { skip: process.platform === 'win32' }, async t => {
  const context = await fixture(t)
  for (const [folder, prefix, content] of [
    [join(context.claude, 'projects', claudeFolder(context.repo)), '', claudeSession(context.repo, [['user', 'HISTORY-PROMPT', {}]])],
    [join(context.codex, 'sessions/2026/10/02'), 'rollout-', codexSession(context.repo, [['user', 'input_text', 'HISTORY-PROMPT']])]
  ]) {
    for (let index = 0; index < 96; index++) await writeFile(join(folder, `${prefix}large-${index}.jsonl`), content + ' '.repeat(128 * 1024))
  }
  const result = spawnSync('sh', ['-c', 'ulimit -n 64; exec "$@"', 'sh', process.execPath, entry, 'transcripts', '--repo', context.repo, '--json'], { cwd: context.directory, env: context.env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(JSON.parse(result.stdout).data.sessions.length, 195)
})
