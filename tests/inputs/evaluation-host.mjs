import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { userInfo } from 'node:os'
import { execFileSync } from 'node:child_process'

// Modes emulate only the external host's conversation and failure boundary.
const args = process.argv.slice(2)
if (args.includes('--version')) {
  console.log('fake-codex 1')
} else {
  const mode = args[0]
  const message = args.at(-1)
  const sandboxPolicy = args.includes('--sandbox') ? args[args.indexOf('--sandbox') + 1] :
    args.find(arg => arg.startsWith('sandbox_mode='))?.split('=')[1].replaceAll('"', '') ?? 'read-only'
  const state = join(process.env.CODEX_HOME, 'fake-session.json')
  if (mode === 'require-auth') {
    const login = await stat(join(process.env.CODEX_HOME, 'auth.json'))
    const home = await stat(process.env.CODEX_HOME)
    if (process.platform !== 'win32' && ((login.mode & 0o777) !== 0o600 || (home.mode & 0o777) !== 0o700)) throw new Error('Wrong throwaway permissions')
  }
  let sessionId
  if (args.includes('resume')) {
    sessionId = JSON.parse(await readFile(state, 'utf8')).id
    if (args.at(-2) !== sessionId) throw new Error('Wrong resumed thread')
  } else {
    sessionId = randomUUID()
    await writeFile(state, JSON.stringify({ id: sessionId }))
  }
  if (mode === 'hang') await new Promise(() => { setInterval(() => {}, 1000) })
  if (mode === 'fail') process.exit(7)
  if (mode === 'malformed') console.log('not JSONL')
  else {
    console.log(JSON.stringify({ type: 'thread.started', thread_id: mode === 'wrong-session' && args.includes('resume') ? randomUUID() : sessionId }))
    if (mode === 'listing') {
      const username = userInfo().username
      const group = process.platform === 'win32' ? username : execFileSync('id', ['-gn'], { encoding: 'utf8' }).trim()
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'ls -la',
        aggregated_output: `total 8\ndrwx------ 2 ${username} ${group} 4096 Oct 8 12:00 .\n-rw-r--r-- 1 ${username} ${group} 123 Oct 8 12:00 brief.md\nOwner: ${username}; group: ${group}\n${username}\n${group}\n` } }))
    }
    console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: args.includes('resume') ?
      'Offline access remains unresolved. I will stop without choosing a stack.' : 'Which offline access option should we use?' + (mode === 'large' ? 'x'.repeat(70000) : ''),
    observed: { message, home: process.env.HOME, state: process.env.CODEX_HOME, cache: process.env.XDG_CACHE_HOME, cwd: process.cwd(), sandboxPolicy } } }))
    if (mode === 'truncate') process.stdout.write('x'.repeat(70000))
    if (mode !== 'incomplete') console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }))
  }
  if (mode === 'contaminate') {
    const directory = join(process.env.HOME, '.agents', 'skills', 'intruder')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'SKILL.md'), '---\nname: repo-audit\n---\n')
  }
}
