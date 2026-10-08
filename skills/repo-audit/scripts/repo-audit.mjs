import { commands, plannedCommands } from './commands.mjs'
import { parseArgs } from './lib/args.mjs'
import { CommandError, emitResult } from './lib/result.mjs'

// Resolve command resources from this entry point, independent of cwd.
const argv = process.argv.slice(2)
// Multiword commands register their full public name.
const command = Object.keys(commands).find(name => name.split(' ').every((word, index) => argv[index] === word))

function help() {
  console.log(`Usage: node skills/repo-audit/scripts/repo-audit.mjs <command> [options]\n\nAvailable commands:\n${Object.keys(commands).map(name => `  ${name}`).join('\n')}\n\nPlanned commands (not implemented yet):\n${plannedCommands.map(name => `  ${name}`).join('\n')}\n\nUse --help to show this help (exit 0).\nMissing or unsupported arguments are a usage error (exit 3).`)
}

if (!argv.length || (argv.length === 1 && argv[0] === '--help')) {
  help()
  process.exitCode = argv.length ? 0 : 3
} else if (command && argv.slice(command.split(' ').length).length === 1 && argv.at(-1) === '--help') {
  console.log(commands[command].help)
} else {
  try {
    if (!command) throw new CommandError('usage-error', [{ code: 'unknown-command', message: `Unknown or not implemented yet: ${argv[0]}`, fix: 'Use --help to select an available command.' }])
    const options = parseArgs(argv.slice(command.split(' ').length), commands[command].options)
    const { run } = await import(new URL(commands[command].module, import.meta.url))
    emitResult({ command, status: 'passed', ...await run(options) }, options.json)
  } catch (error) {
    emitResult({ command: command ?? argv[0], status: error instanceof CommandError ? error.status : 'blocked',
      problems: error instanceof CommandError ? error.problems : [{ code: 'command-unavailable', message: error.message, fix: 'Restore command resources and filesystem access.' }] }, argv.includes('--json'))
  }
}
