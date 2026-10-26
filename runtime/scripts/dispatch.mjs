import { parseArgs } from './lib/args.mjs'
import { CommandError, emitResult } from './lib/result.mjs'

// Each skill's generated entry file passes only the commands that skill ships.
export async function dispatch(argv, skill, commands) {
  // Multiword commands register their full public name.
  const command = Object.keys(commands).find(name => name.split(' ').every((word, index) => argv[index] === word))
  if (!argv.length || (argv.length === 1 && argv[0] === '--help')) {
    console.log(`Usage: node skills/${skill}/scripts/${skill}.mjs <command> [options]\n\nAvailable commands:\n${Object.keys(commands).map(name => `  ${name}`).join('\n')}\n\nUse --help to show this help (exit 0).\nMissing or unsupported arguments are a usage error (exit 3).`)
    process.exitCode = argv.length ? 0 : 3
  } else if (command && argv.slice(command.split(' ').length).length === 1 && argv.at(-1) === '--help') {
    console.log(commands[command].help)
  } else {
    try {
      if (!command) throw new CommandError('usage-error', [{ code: 'unknown-command', message: `Unknown or not implemented yet: ${argv[0]}`, fix: 'Use --help to select an available command.' }])
      const options = parseArgs(argv.slice(command.split(' ').length), commands[command].options)
      emitResult({ command, status: 'passed', ...await commands[command].run(options, command) }, options.json)
    } catch (error) {
      emitResult({ command: command ?? argv[0], status: error instanceof CommandError ? error.status : 'blocked',
        data: error instanceof CommandError ? error.data : {},
        problems: error instanceof CommandError ? error.problems : [{ code: 'command-unavailable', message: error.message, fix: 'Restore command resources and filesystem access.' }] }, argv.includes('--json'))
    }
  }
}
