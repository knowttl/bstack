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
    ...(command === 'run-checks' && data.runId ? [`capture: ${data.runId}`, data.journeyCoverage,
      ...data.checks.map(check => `${check.id}: ${check.status}${check.reason ? ` (${check.reason})` : ''}`)] : []),
    ...(data.runId && command !== 'run-checks' ? [`run: ${data.runId}`, ...(data.outcome ? [data.outcome] : []),
      ...['applied', 'pending', 'conflicting'].map(state => `${state}: ${(data[state] ?? []).join(', ') || 'none'}`),
      ...(data.affectedChecks?.length ? [`checks to rerun: ${data.affectedChecks.join(', ')}`] : []), ...(data.limitations ?? [])] : []),
    ...(data.path ? [data.path] : []),
    ...(data.diff ? [data.diff] : []),
    ...problems.map(problem => `${problem.code}: ${problem.message} Fix: ${problem.fix}`)
  ].join('\n'))
  process.exitCode = exitCodes[status]
}
