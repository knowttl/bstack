import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { root, text, object, array, readJSON, fail } from './evaluation.mjs'
import { scoreChecks, validateScore } from './evaluation-scoring.mjs'
import { createContainer, image } from './evaluation-container.mjs'
import { validateData } from '../../skills/repo-audit/scripts/lib/schema.mjs'
import { hashBytes, canonicalJSON } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { runCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

// Stdin avoids OS argument limits; the wrapper forwards no provider diagnostics.
const invoke = `const {readFileSync}=require('node:fs');const {spawnSync}=require('node:child_process');
const [input,configPath]=process.argv.slice(1);const config=JSON.parse(readFileSync(configPath));
const version=spawnSync(config.executable,config.versionArgs,{encoding:'utf8',timeout:config.timeoutMs,maxBuffer:config.outputLimitBytes});
if(version.status!==0||version.error)process.exit(1);
const result=spawnSync(config.executable,config.args,{input:readFileSync(input),encoding:'utf8',timeout:config.timeoutMs,maxBuffer:config.outputLimitBytes});
if(result.status!==0||result.error)process.exit(1);
process.stdout.write(JSON.stringify({output:result.stdout,toolVersion:version.stdout.trim()}));`

async function executeJudge(config, directory, input) {
  const home = join(directory, 'home')
  const work = join(directory, 'work')
  await mkdir(home, { mode: 0o700 })
  await mkdir(work)
  const inputPath = join(home, 'input.json')
  const configPath = join(home, 'command.json')
  await writeFile(inputPath, input, { mode: 0o600 })
  await writeFile(configPath, JSON.stringify({ ...config, args: config.args.map(arg => arg.replaceAll('{model}', config.model)) }), { mode: 0o600 })
  async function child(executable, args) {
    const result = await runCommand({ root: directory }, { executable, args, cwd: '.',
      versionArgs: ['--version'], timeoutMs: config.timeoutMs }, { outputLimitBytes: config.outputLimitBytes, exactOutput: true })
    if (result.status !== 'passed' || result.outputTruncated) fail('Judge execution failed or output was truncated. Inspect the private provider session before any retry.')
    return result
  }
  if (config.host === 'process') {
    const result = await child('node', ['-e', invoke, inputPath, configPath])
    return { ...JSON.parse(result.stdout), durationMs: result.durationMs }
  }
  const name = `bstack-judge-${randomUUID()}`
  const login = join(home, '.claude', '.credentials.json')
  await mkdir(join(home, '.claude'), { mode: 0o700 })
  try {
    await copyFile(join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), '.credentials.json'), login, constants.COPYFILE_EXCL)
    await chmod(login, 0o600)
    await writeFile(join(home, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true }), { mode: 0o600 })
    const inspected = JSON.parse((await child('docker', ['image', 'inspect', image])).stdout)[0]
    if (!/^sha256:[a-f0-9]{64}$/.test(inspected.Id)) fail('Judge container requires an immutable image ID.')
    await createContainer(name, inspected.Id, [home, work], work,
      { HOME: home, CLAUDE_CONFIG_DIR: join(home, '.claude'), DISABLE_AUTOUPDATER: '1' })
    await child('docker', ['start', name])
    const result = await child('docker', ['exec', name, 'node', '-e', invoke, inputPath, configPath])
    return { ...JSON.parse(result.stdout), durationMs: result.durationMs, imageId: inspected.Id,
      recipeHash: hashBytes(await readFile(join(root, 'tests/eval/container/Dockerfile'))) }
  } finally {
    try {
      const removal = await runCommand({ root: directory }, { executable: 'docker', args: ['rm', '--force', name],
        cwd: '.', versionArgs: ['--version'], timeoutMs: 120000 })
      if (removal.status !== 'passed' && !/No such container/.test(removal.stderr)) fail('Judge container cleanup failed.')
    } finally { await rm(login, { force: true }) }
  }
}

export async function readJudge(path) {
  const config = await readJSON(path)
  validateData(object({ schemaVersion: { const: 1 }, model: text, host: { enum: ['process', 'claude-container'] }, executable: text, args: array({ type: 'string' }),
    versionArgs: array(text), timeoutMs: { type: 'integer' }, outputLimitBytes: { type: 'integer' } }), config)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(config.model) ||
      !config.args.includes('{model}') || !config.versionArgs.length || config.timeoutMs < 1 || config.timeoutMs > 1800000 ||
      config.outputLimitBytes < 1 || config.outputLimitBytes > 16777216) fail('Judge requires a model, a {model} argument, timeoutMs 1..1800000 and outputLimitBytes 1..16777216.')
  if (config.host === 'claude-container' && (config.executable !== 'claude' ||
      canonicalJSON(config.versionArgs) !== canonicalJSON(['--version']) ||
      new Set(config.args.filter(arg => arg.startsWith('--'))).size !== config.args.filter(arg => arg.startsWith('--')).length ||
      !['--print', '--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands', '--safe-mode'].every(arg => config.args.includes(arg)) ||
      config.args[config.args.indexOf('--tools') + 1] !== '' ||
      config.args[config.args.indexOf('--mcp-config') + 1] !== '{}' ||
      config.args[config.args.indexOf('--setting-sources') + 1] !== '' ||
      config.args[config.args.indexOf('--output-format') + 1] !== 'json' ||
      config.args[config.args.indexOf('--model') + 1] !== '{model}')) fail('Claude judge requires print JSON, the configured model, disabled tools, safe mode and no session persistence.')
  return config
}

export async function judgeInput(record, transcript) {
  if (!transcript.trim()) fail('Judge requires a nonempty captured transcript.')
  const rubric = await readFile(join(root, 'tests/eval/judge/rubric.md'), 'utf8')
  const checks = record.scenario.checks.filter(check => !check.machine)
  if (!checks.length) fail('This run has no conversation judgements. Use captured machine results.')
  const input = { schemaVersion: 1, runId: record.id, rubric, checks,
    transcript: transcript.trimEnd().split(/\r?\n/).map((text, index) => ({ line: index + 1, text })) }
  return { input, rubricHash: hashBytes(rubric), inputHash: hashBytes(canonicalJSON(input)),
    transcriptHash: hashBytes(transcript), criteriaHash: hashBytes(canonicalJSON(checks)) }
}

export async function judgeAnswers(config, record, transcript, prepared) {
  prepared ??= await judgeInput(record, transcript)
  const directory = await mkdtemp(join(tmpdir(), 'bstack-judge-'))
  try {
    const result = await executeJudge(config, directory, JSON.stringify({ ...prepared.input, reviewer: `judge:${config.model}` }) + '\n')
    let answers
    try {
      const response = JSON.parse(result.output)
      if (config.host === 'claude-container') {
        if (response.type !== 'result' || response.subtype !== 'success' || response.is_error) fail('Claude judge did not complete successfully.')
        answers = JSON.parse(response.result)
      } else answers = response
    } catch { fail('Judge did not return one JSON answers object.') }
    validateData(object({ schemaVersion: { const: 1 }, runId: text, reviewer: text, checks: scoreChecks }), answers)
    if (answers.reviewer !== `judge:${config.model}`) fail('Judge output names a different model.')
    // The judge cannot replace machine results, even in otherwise valid output.
    const semantic = { ...record, scenario: { ...record.scenario, checks: prepared.input.checks } }
    validateScore(semantic, answers, transcript)
    return { answers, evidence: { model: config.model, configHash: hashBytes(canonicalJSON(config)),
      rubricHash: prepared.rubricHash, inputHash: prepared.inputHash, transcriptHash: prepared.transcriptHash,
      criteriaHash: prepared.criteriaHash, toolVersion: result.toolVersion, durationMs: result.durationMs,
      ...(result.imageId ? { imageId: result.imageId, recipeHash: result.recipeHash } : {}) } }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
