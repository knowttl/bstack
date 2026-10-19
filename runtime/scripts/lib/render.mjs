// Generated skills and kits share one way to show a command and link a file, so their documents read alike.
export function link(text, destination) {
  return ['[', text, ']', '(', destination, ')'].join('')
}

export function shown(command) {
  return command.map(word => `'${word.replaceAll("'", "'\"'\"'")}'`).join(' ')
}

export function bullets(items) {
  return items.map(item => `- ${item}`)
}

export function commandLines(label, spec) {
  const command = shown(spec.command)
  const fence = '~'.repeat(Math.max(3, ...(command.match(/~+/g) ?? []).map(run => run.length + 1)))
  return [`${label}${spec.cwd ? ` from \`${spec.cwd}\`` : ''}:`, '', `${fence}sh`, ...command.split('\n'), fence,
    ...(spec.env ? [`Environment: ${Object.entries(spec.env).map(([key, value]) => `\`${key}=${value}\``).join(', ')}.`] : [])]
}
