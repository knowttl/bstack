const exitCodes = { passed: 0, failed: 1, blocked: 2, 'usage-error': 3 }

export type Status = keyof typeof exitCodes

export type Problem = { code: string; message: string; fix: string; path?: string }

export type ResultData = Record<string, any>

export type Result = { command: string; status: Status; problems?: Problem[]; data?: ResultData; inputs?: Record<string, unknown> }

export type CommandReturn = Partial<Omit<Result, 'command'>>

type Debt ={ rule: string; path: string; key: string; reason: string; removalCondition: string }

type CheckOutcome = { id: string; status: string; reason?: string }

type PrincipleRow = { title: string; rung?: string; proven?: boolean }

type CoverageLimit = { path: string; reason: string }

export class CommandError extends Error {
  declare status: Status
  declare problems: Problem[]
  declare data: ResultData
  constructor(status: Status, problems: Problem[], data: ResultData = {}) {
    super(problems.map(problem => problem.message).join('\n'))
    this.status = status
    this.problems = problems
    this.data = data
  }
}

export function emitResult({ command, status, problems = [], data = {}, inputs = {} }: Result, json?: boolean) {
  if (!Object.hasOwn(exitCodes, status)) throw new Error(`Unknown result status: ${status}`)
  const result = { schemaVersion: 1, command, status, problems, data, inputs }
  console.log(json ? JSON.stringify(result) : [
    `${command}: ${status}`,
    ...(command === 'baseline check' ? [
      ...data.debt?.map((entry: Debt) => `debt: ${entry.rule} ${entry.path} ${entry.key}. Reason: ${entry.reason} Removal: ${entry.removalCondition}`) ?? [],
      ...(data.refreshed ? ['baseline refreshed'] : [])
    ] : []),
    ...(command === 'run-checks' && data.runId ? [`capture: ${data.runId}`, data.journeyCoverage,
      ...data.checks.map((check: CheckOutcome) => `${check.id}: ${check.status}${check.reason ? ` (${check.reason})` : ''}`)] : []),
    ...(data.runId && command !== 'run-checks' ? [`run: ${data.runId}`, ...(data.outcome ? [data.outcome] : []),
      ...['applied', 'pending', 'conflicting'].map(state => `${state}: ${(data[state] ?? []).join(', ') || 'none'}`),
      ...(data.affectedChecks?.length ? [`checks to rerun: ${data.affectedChecks.join(', ')}`] : []), ...(data.limitations ?? [])] : []),
    ...(command === 'scorecard' ? [
      ...data.principles?.map((row: PrincipleRow) => `${row.title}: ${row.rung ? `${row.rung}, ${row.proven ? 'proven' : 'not proven'}` : 'none'}`) ?? [],
      ...(data.limitations ?? [])
    ] : []),
    ...(data.path ? [data.path] : []),
    ...(command === 'evidence validate' ? [
      ...(data.fingerprint ? [`review fingerprint: ${data.fingerprint}`] : []), ...(data.limitations ?? [])
    ] : []),
    ...(data.diff ? [data.diff] : []),
    ...(data.coverageLimits ?? []).map((limit: CoverageLimit) => `coverage limit: ${limit.path}: ${limit.reason}`),
    ...problems.map(problem => `${problem.code}: ${problem.message} Fix: ${problem.fix}`),
    ...(data.approvalRequired ? [data.approvalRequired] : [])
  ].join('\n'))
  process.exitCode = exitCodes[status]
}
