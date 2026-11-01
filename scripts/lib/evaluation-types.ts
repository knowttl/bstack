export type ProcessCapture = { status: 'passed' | 'failed' | 'blocked'; stdout: string; stderr: string;
  durationMs: number; exitCode: number | null; signal: string | null; timedOut: boolean;
  cancelled: boolean; outputTruncated: boolean; error: string | null }
export type Execution = ProcessCapture & { toolVersion: ProcessCapture }
export type MachineCheck =
  | { type: 'fixtureUnchanged' }
  | { type: 'installerPassed' }
  | { type: 'opened'; patterns: string[] }
  | { type: 'notOpened'; patterns: string[] }
  | { type: 'command'; executable: string; args: string[] }
  | { type: 'citeCheck'; report: string }
  | { type: 'filesEqual'; paths: string[] }
  | { type: 'contains'; path: string; text: string }
export type Check = { id: string; caseId: string; skill: string; question: string; machine?: MachineCheck }
export type Scenario = {
  id: string; tier: string; fixture: string; skills: string[]; request: string; answers: string[];
  checkpoints: string[]; mode?: string; invocation: string; checks: Check[]
}
export type Adapter = {
  schemaVersion: number; tier?: string; executable: string; args: string[]; cwd: string;
  versionArgs: string[]; timeoutMs: number; outputLimitBytes: number;
  invocation: { agent: string; model: string; explicit: string; protocol: string; resumeArgs: string[] }
  isolation: { stateDirectory: string; discoveryPaths: string[]; systemDiscoveryPaths: string[];
    skillsPath: string; authentication: string }
}
export type Isolation = {
  home: string; state: string; discoveryPaths: string[]; skillsPath: string; skills: string[];
  skillHash: string | null; verified: boolean; method: string; discovered?: string[];
  checkedAt?: string; cleanedAt?: string
}
export type ScoreCheck = {
  id: string; passed: boolean; startLine: number; endLine: number; companionRunId?: string
}
export type Answers = { schemaVersion: number; runId: string; reviewer: string; checks: ScoreCheck[] }
export type Correction = Pick<Answers, 'schemaVersion' | 'runId' | 'checks'> & {
  correctedAt: string; corrector: string; reason: string; originalAnswers: string;
  originalAnswersSha256: string; conversationSha256: string; evidence: { startLine: number; endLine: number }
}
export type CaseResult = Check & ScoreCheck & { scoring: string; reviewer: string; transcript: string }
type ContainerMetadata = {
  mounts: { Type: string; Source: string; Destination: string; RW: boolean }[];
  user: string; network: string; privileged: boolean; publishedPorts: unknown[]; toolchain: Record<string, string>
}
export type ContainerTurn = { name: string; imageId: string; removedAt?: string } &
  ({ verified: true } & ContainerMetadata | { verified: false } & Partial<ContainerMetadata>)
export type EvaluationRecord = {
  schemaVersion: number; id: string; createdAt: string; sourceRevision: string;
  agent: string; model: string; os: string; tools: Record<string, string>;
  fixture: { name: string; path: string; kind: string; revision: string; reused?: boolean; head?: string; workingTree?: string };
  scenario: Scenario; criteriaHash: string; stage: string; mode: string; request: string;
  status: string; reason: string; isolation: Partial<Isolation> & Pick<Isolation, 'verified'>; transcript: string | null; answers: string | null;
  caseResults: CaseResult[]; batchId?: string; repeatIndex?: number; adapter?: Adapter;
  adapterHash?: string; turns?: { message: string; result: Execution; sessionId: string | null }[];
  nextAnswer?: number; sessionId?: string | null; conversation?: string; conversationHash?: string;
  hostFailure?: boolean; installer?: Execution; authenticatedVia?: string;
  execution?: { method: string; image: string; imageId: string; recipeHash: string;
    turns: ContainerTurn[]; toolchain?: Record<string, string> };
  fixtureRuntime?: { imageId: string; python: string; result: Execution };
  fixtureSnapshot?: unknown; machineResults?: Pick<ScoreCheck, 'id' | 'passed'>[];
  scoredAt?: string; scoreCorrection?: Correction
}

export type AdapterRecord = EvaluationRecord & Required<Pick<EvaluationRecord, 'adapter' | 'turns' | 'nextAnswer' | 'sessionId' | 'conversation'>>
export type HostedRecord = AdapterRecord & { isolation: Isolation }
