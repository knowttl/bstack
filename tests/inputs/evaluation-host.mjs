import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { userInfo } from 'node:os'
import { execFileSync } from 'node:child_process'
import { maintenanceSession } from './maintenance-session.mjs'

// Modes emulate only the external host's conversation and failure boundary.
const args = process.argv.slice(2)
if (args.includes('--version')) {
  console.log('fake-codex 1')
} else {
  const mode = args[0]
  const message = args.at(-1)
  const subagentsDisabled = ['multi_agent', 'multi_agent_v2', 'multi_agent_v2_dynamic_tools']
    .every(feature => args.some((arg, index) => arg === '--disable' && args[index + 1] === feature)) &&
    args.some((arg, index) => arg === '-c' && args[index + 1] === 'agents.enabled=false')
  if (mode === 'require-no-subagents' && !subagentsDisabled) throw new Error('Subagents remain available')
  if (mode === 'require-subagents' && subagentsDisabled) throw new Error('Unexpected subagent restriction')
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
    if (mode === 'reviewer' || mode === 'reviewer-quoted') console.log(JSON.stringify({ type: 'item.completed', item: {
      type: 'agent_message', text: mode === 'reviewer' ? 'Reviewer: Alice Chen' : 'Reviewer: Alice "Ali" Chen' } }))
    if (mode === 'listing') {
      const username = userInfo().username
      const group = process.platform === 'win32' ? username : execFileSync('id', ['-gn'], { encoding: 'utf8' }).trim()
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'ls -la',
        aggregated_output: `total 8\ndrwx------ 2 ${username} ${group} 4096 Oct 8 12:00 .\n-rw-r--r-- 1 ${username} ${group} 123 Oct 8 12:00 brief.md\nOwner: ${username}; group: ${group}\n${username}\n${group}\n` } }))
    }
    if (mode.startsWith('scope-') && (mode !== 'scope-resume' || args.includes('resume'))) {
      const outside = join(dirname(process.env.HOME), 'outside-project', 'SKILL.md')
      const paths = {
        'scope-host-home': userInfo().homedir,
        'scope-relative': '../outside-project/SKILL.md',
        'scope-normalized-escape': process.env.HOME + '/../outside-project/SKILL.md',
        'scope-prefix': process.env.HOME + '-other/SKILL.md',
        'scope-tool-sibling': process.execPath + '/../private-config',
        'scope-native-read': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-native-output': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-native-relative': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-runtime-skill': '/usr/share/skills/repo-audit/SKILL.md',
        'scope-valid': join(process.env.HOME, 'tmp', 'report.json')
      }
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution',
        command: mode === 'scope-output' ? 'find .' : `cat ${paths[mode] ?? outside}`,
        aggregated_output: mode === 'scope-output' ? JSON.stringify({ target: outside }) : mode === 'scope-valid' ?
          `${process.execPath}\n${process.cwd()}/brief.md\n/api/items\nhttp://localhost:3000/home/profile\n... 2 more lines\nimport { price } from '../core/index.ts'\nrange <base>..<head>\n` : '' } }))
      if (mode.startsWith('scope-native-')) {
        const directory = join(process.env.CODEX_HOME, 'sessions')
        await mkdir(directory, { recursive: true })
        const payload = mode === 'scope-native-relative' ? { type: 'custom_tool_call', name: 'exec',
          input: 'await tools.exec_command({cmd: "cat ../outside-project/SKILL.md"})' } :
          mode === 'scope-native-read' ? { type: 'custom_tool_call', name: 'exec', input: `cat ${outside}` } :
          { type: 'custom_tool_call_output', output: JSON.stringify({ output: outside }) }
        await writeFile(join(directory, 'worker.jsonl'), JSON.stringify({ type: 'response_item', payload }) + '\n')
      }
    }
    if (mode === 'maintenance') {
      for (const event of await maintenanceSession()) console.log(JSON.stringify(event))
    } else console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: args.includes('resume') ?
      'Offline access remains unresolved. I will stop without choosing a stack.' : 'Which offline access option should we use?' + (mode === 'large' ? 'x'.repeat(70000) : ''),
    observed: { message, home: process.env.HOME, state: process.env.CODEX_HOME, cache: process.env.XDG_CACHE_HOME, cwd: process.cwd(), sandboxPolicy,
      task_name: '/root/documents' } } }))
    if (mode === 'truncate') process.stdout.write('x'.repeat(70000))
    if (mode !== 'incomplete') console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }))
  }
  if (mode === 'contaminate') {
    const directory = join(process.env.HOME, '.agents', 'skills', 'intruder')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'SKILL.md'), '---\nname: repo-audit\n---\n')
  }
}
