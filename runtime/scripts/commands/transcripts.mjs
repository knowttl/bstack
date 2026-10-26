import { createReadStream } from 'node:fs'
import { chmod, readdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { resolveTarget } from '../lib/repo.mjs'
import { createScratch } from '../lib/scratch.mjs'

// A transcript line can hold a pasted file or log, so a digest keeps each turn short and the summary quotes only a few words.
const turnLimit = 2000
const promptLimit = 120

async function* records(file) {
  const lines = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      try {
        yield JSON.parse(line)
      } catch {
        // A session still being written can end in a partial line.
        yield null
      }
    }
  } finally {
    lines.close()
  }
}

// Claude Code stamps cwd on most records and Codex puts it in the first session_meta record.
const cwdOf = record => record?.cwd ?? (record?.type === 'session_meta' ? record.payload?.cwd : undefined)

async function launchDirectory(file) {
  for await (const record of records(file)) {
    const cwd = cwdOf(record)
    if (cwd) return cwd
  }
  return undefined
}

const textOf = content => typeof content === 'string' ? content
  : (Array.isArray(content) ? content : []).filter(block => ['text', 'input_text', 'output_text'].includes(block.type)).map(block => block.text).join('\n')

// Tool calls, tool results and reasoning are left out: they carry the bulk of a transcript and little of its intent.
const hosts = {
  'claude-code': {
    // Claude Code keeps one folder per launch directory under projects/, named by replacing every non-alphanumeric character with a hyphen.
    async files(root) {
      const projects = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects')
      const name = root.replaceAll(/[^a-zA-Z0-9]/g, '-')
      const found = []
      for (const folder of await readdir(projects).catch(() => [])) {
        if (folder !== name && !folder.startsWith(`${name}-`)) continue
        for (const file of await readdir(join(projects, folder))) if (file.endsWith('.jsonl')) found.push(join(projects, folder, file))
      }
      return found
    },
    turn: record => ['user', 'assistant'].includes(record.type) && !record.isSidechain && !record.isMeta
      ? { role: record.type, text: textOf(record.message?.content) } : null
  },
  codex: {
    // Codex keeps rollout files under sessions/YYYY/MM/DD/ and records the launch directory inside each.
    async files() {
      const sessions = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions')
      const names = await readdir(sessions, { recursive: true }).catch(() => [])
      return names.filter(name => /(?:^|[\\/])rollout-[^\\/]*\.jsonl$/.test(name)).map(name => join(sessions, name))
    },
    turn: record => record.type === 'response_item' && record.payload?.type === 'message' && ['user', 'assistant'].includes(record.payload.role)
      ? { role: record.payload.role, text: textOf(record.payload.content) } : null
  }
}

const inside = (root, path) => path === root || path.startsWith(root + sep)

export async function run(options) {
  const target = await resolveTarget(options)
  const matched = []
  for (const [host, { files }] of Object.entries(hosts)) {
    for (const file of await files(target.root)) {
      const cwd = await launchDirectory(file)
      if (cwd && inside(target.root, cwd)) matched.push({ host, file, cwd, modified: (await stat(file)).mtimeMs })
    }
  }
  matched.sort((a, b) => b.modified - a.modified)

  const scratch = await createScratch(target)
  await chmod(scratch, 0o700)
  const sessions = []
  let skippedLines = 0
  for (const { host, file, cwd } of matched) {
    const turns = []
    let started
    for await (const record of records(file)) {
      if (record === null) {
        skippedLines++
        continue
      }
      started ??= record.timestamp
      const turn = hosts[host].turn(record)
      if (!turn?.text.trim()) continue
      const cut = turn.text.length > turnLimit ? `${turn.text.slice(0, turnLimit)} [${turn.text.length - turnLimit} more characters]` : turn.text
      turns.push({ ...turn, at: record.timestamp, text: cut })
    }
    const digest = join(scratch, `${host}-${basename(file, '.jsonl')}.txt`)
    // The digest repeats transcript text, so only its owner can read it.
    await writeFile(digest, turns.map(turn => `[${turn.at ?? 'unknown time'}] ${turn.role}: ${turn.text}`).join('\n\n') + '\n', { mode: 0o600 })
    const firstPrompt = turns.find(turn => turn.role === 'user')?.text.replaceAll(/\s+/g, ' ').slice(0, promptLimit) ?? ''
    sessions.push({ host, cwd, started: started ?? null, turns: turns.length, firstPrompt, digest })
  }
  return {
    data: { root: target.root, path: scratch, sessions, skippedLines,
      limitations: sessions.length ? [] : ['No Claude Code or Codex transcript for this project was found. Do not infer prior context.'] },
    inputs: { repo: target.root }
  }
}
