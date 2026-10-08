// Status and exit code are one contract across every command.
const exitCodes = { passed: 0, failed: 1, blocked: 2, 'usage-error': 3 }

export class CommandError extends Error {
  constructor(status, problems) {
    super(problems.map(problem => problem.message).join('\n'))
    this.status = status
    this.problems = problems
  }
}

export function emitResult({ command, status, problems = [], data = {}, inputs = {} }, json) {
  if (!Object.hasOwn(exitCodes, status)) throw new Error(`Unknown result status: ${status}`)
  const result = { schemaVersion: 1, command, status, problems, data, inputs }
  console.log(json ? JSON.stringify(result) : [
    `${command}: ${status}`,
    ...(data.path ? [data.path] : []),
    ...problems.map(problem => `${problem.code}: ${problem.message} Fix: ${problem.fix}`)
  ].join('\n'))
  process.exitCode = exitCodes[status]
}
