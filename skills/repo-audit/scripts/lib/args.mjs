import { CommandError } from './result.mjs'

export function parseArgs(argv, valueOptions = []) {
  const options = {}
  const problems = []
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '--' && valueOptions.includes('command')) {
      options.command = argv.slice(index + 1)
      break
    }
    const name = token.startsWith('--') ? token.slice(2) : ''
    if (name === 'command' || !['repo', 'workspace', 'json', ...valueOptions].includes(name)) {
      problems.push({ code: 'unknown-option', message: `Unknown argument: ${token}`, fix: 'Use only documented --options and separate values.' })
      continue
    }
    if (Object.hasOwn(options, name)) {
      problems.push({ code: 'duplicate-option', message: `Repeated option: ${token}`, fix: 'Supply each option once.' })
    }
    if (name === 'json' || name === 'dry-run' || name === 'approved-by-user' || name === 'refresh') options[name] = true
    else if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
      problems.push({ code: 'missing-value', message: `Missing value for ${token}`, fix: 'Supply a nonempty value after the option.' })
    } else if (name === 'plans') {
      options[name] = [argv[++index]]
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) problems.push({ code: 'missing-value', message: '--plans requires two files.', fix: 'Supply --plans <file> <file>.' })
      else options[name].push(argv[++index])
    } else options[name] = argv[++index]
  }
  if (options.repo && options.workspace) {
    problems.push({ code: 'conflicting-targets', message: '--repo and --workspace are mutually exclusive.', fix: 'Select one target mode.' })
  }
  if (!options.repo && !options.workspace) {
    problems.push({ code: 'missing-target', message: 'An explicit target is required.', fix: 'Supply --repo or, for draft-only commands, --workspace.' })
  }
  if (problems.length) throw new CommandError('usage-error', problems)
  return options
}
