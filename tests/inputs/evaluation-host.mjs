import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
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
    if (mode === 'host-preflight') {
      const output = execFileSync(process.execPath, [process.env.BSTACK_EVAL_PREFLIGHT], { encoding: 'utf8' })
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'node "$BSTACK_EVAL_PREFLIGHT"', aggregated_output: output, exit_code: 0 } }))
    }
    if (mode === 'reviewer' || mode === 'reviewer-quoted') console.log(JSON.stringify({ type: 'item.completed', item: {
      type: 'agent_message', text: mode === 'reviewer' ? 'Reviewer: Alice Chen' : 'Reviewer: Alice "Ali" Chen' } }))
    if (mode === 'listing') {
      const username = userInfo().username
      const group = process.platform === 'win32' ? username : execFileSync('id', ['-gn'], { encoding: 'utf8' }).trim()
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'ls -la',
        aggregated_output: `total 8\ndrwx------ 2 ${username} ${group} 4096 Oct 8 12:00 .\n-rw-r--r-- 1 ${username} ${group} 123 Oct 8 12:00 brief.md\nOwner: ${username}; group: ${group}\n${username}\n${group}\n` } }))
    }
    if (mode.startsWith('scope-') && (mode !== 'scope-resume' || args.includes('resume'))) {
      const outside = join(args[args.indexOf('--scope-fixture') + 1], 'outside-project', 'SKILL.md')
      if (mode === 'scope-prefix') {
        await mkdir(process.env.HOME + '-other')
        await writeFile(process.env.HOME + '-other/SKILL.md', 'Outside project guidance\n')
      }
      const paths = {
        'scope-host-home': userInfo().homedir,
        'scope-relative': relative(process.cwd(), outside),
        'scope-normalized-escape': process.env.HOME + '/../' + relative(dirname(process.env.HOME), outside),
        'scope-prefix': process.env.HOME + '-other/SKILL.md',
        'scope-tool-sibling': process.execPath + '/../private-config',
        'scope-native-read': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-native-output': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-native-relative': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-native-file-read': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-native-file-write': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-cd-host-home': join(process.env.HOME, 'tmp', 'report.json'),
        'scope-other-skill': join(dirname(fileURLToPath(import.meta.url)), '../../skills/repo-audit/SKILL.md'),
        'scope-valid': join(process.env.HOME, 'tmp', 'report.json')
      }
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution',
        command: mode === 'scope-output' || mode.startsWith('scope-range-') ? 'find .' : `cat '${paths[mode] ?? (mode.startsWith('scope-resource-') ? join(process.env.HOME, 'tmp', 'report.json') : outside)}'`,
        aggregated_output: mode === 'scope-output' ? JSON.stringify({ target: outside }) : mode === 'scope-valid' ?
          `${process.execPath}\n${process.cwd()}/brief.md\n/api/items\nhttp://localhost:3000/home/profile\n... 2 more lines\nimport { price } from '../core/index.ts'\nrange <base>..<head>\n` : '' } }))
      if (mode === 'scope-cd-host-home') console.log(JSON.stringify({ type: 'item.completed', item: {
        type: 'command_execution', command: `cd ${userInfo().homedir}`, aggregated_output: '', exit_code: 0 } }))
      if (mode.startsWith('scope-range-')) console.log(JSON.stringify({ type: 'item.completed', item: {
        type: 'command_execution', command: { 'scope-range-measure': 'measure --range HEAD^..HEAD',
          'scope-range-log': 'git log a..b', 'scope-range-diff': 'git diff HEAD~1' }[mode], aggregated_output: '', exit_code: 0 } }))
      if (mode.startsWith('scope-resource-')) {
        const commands = {
          'scope-resource-read': `cat /proc/meminfo /proc/loadavg /proc/self/stat; df -B1 "$TMPDIR"; ps -eo comm,args`,
          'scope-resource-processes': `python3 -c "from pathlib import Path; [p for p in Path('/proc').iterdir() if p.name.isdigit()]"`,
          'scope-resource-capacity': `python3 -c "import shutil, os; print(shutil.disk_usage(os.environ['TMPDIR']))"`,
          'scope-resource-temp': `touch ${join(process.env.HOME, 'tmp', 'own-report.json')}`,
          'scope-resource-write': 'echo changed > /proc/meminfo',
          'scope-resource-system-write': 'touch /usr/share/changed',
          'scope-resource-temp-read': `cat '${outside}'`,
          'scope-resource-shared-capacity': 'df -Pk /tmp',
          'scope-resource-shared-python-capacity': `python3 -c "import shutil; print(shutil.disk_usage('/tmp'))"`,
          'scope-resource-temp-write': 'touch /tmp/unrelated-project/notes.md',
          'scope-resource-relative-write': 'echo changed > ../not-created/notes.md',
          'scope-resource-mixed': 'df -B1 /tmp; cat /tmp/unrelated-project/notes.md',
          'scope-resource-python-write': `python3 -c "from pathlib import Path; Path('/proc/loadavg').write_text('changed')"`,
          'scope-resource-df-output': 'df -Pk . "$TMPDIR"',
          'scope-resource-free-output': 'free -b',
          'scope-resource-ps-output': 'ps -eo comm,args'
        }
        console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution',
          command: commands[mode], aggregated_output: mode === 'scope-resource-read' ? 'Filesystem 1B-blocks Available Mounted on\nvolume 100000 90000 /tmp\n' :
            mode === 'scope-resource-df-output' ? '/dev/mapper/system-volume 100000 90000 /\n' :
            mode === 'scope-resource-free-output' ? 'memory source /proc/meminfo\n' :
            mode === 'scope-resource-ps-output' ? `node ${outside}\n` : '', exit_code: 0 } }))
      }
      if (mode.startsWith('scope-native-')) {
        const directory = join(process.env.CODEX_HOME, 'sessions')
        await mkdir(directory, { recursive: true })
        const payload = mode === 'scope-native-relative' ? { type: 'custom_tool_call', name: 'exec',
          input: `await tools.exec_command({cmd: ${JSON.stringify(`cat '${relative(process.cwd(), outside)}'`)}})` } :
          mode === 'scope-native-read' ? { type: 'custom_tool_call', name: 'exec', input: `cat '${outside}'` } :
          mode === 'scope-native-file-read' ? { type: 'function_call', name: 'read_file', arguments: JSON.stringify({ path: outside }) } :
          mode === 'scope-native-file-write' ? { type: 'function_call', name: 'write_file', arguments: JSON.stringify({ path: '/usr/share/outside-write', content: 'changed' }) } :
          { type: 'custom_tool_call_output', output: JSON.stringify({ output: outside }) }
        await writeFile(join(directory, 'worker.jsonl'), JSON.stringify({ type: 'response_item', payload }) + '\n')
      }
    }
    if (mode === 'maintenance') {
      for (const event of await maintenanceSession()) console.log(JSON.stringify(event))
    } else console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: args.includes('resume') ?
      'Offline access remains unresolved. I will stop without choosing a stack.' : 'Which offline access option should we use?' + (mode === 'large' ? 'x'.repeat(70000) : ''),
    observed: { message, home: process.env.HOME, state: process.env.CODEX_HOME, cache: process.env.XDG_CACHE_HOME, cwd: process.cwd(), sandboxPolicy,
      temporaryDirectory: process.env.TMPDIR, temporaryAlias: process.env.TMP, temporaryWindowsAlias: process.env.TEMP,
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
