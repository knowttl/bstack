import { readFile, writeFile, rm, cp } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { root, fail } from './evaluation.mjs'
import { hashBytes, canonicalJSON } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { runCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'

const image = 'bstack-eval-toolchain:node24-codex0.162.1'

async function docker(args, timeoutMs = 120000, outputLimitBytes = 16777216) {
  return runCommand({ root }, { executable: 'docker', args, cwd: '.', versionArgs: ['--version'], timeoutMs }, { outputLimitBytes })
}

function completed(result, operation) {
  if (result.status !== 'passed' || result.outputTruncated) fail(`Evaluation container ${operation} failed: ${result.stderr || result.error || result.exitCode}`)
  return result.stdout.trim()
}

// Docker receives exactly two mounts and a fixed capability/network policy.
// Inspect the created container before starting the agent, and remove it even
// when the attached client times out or fails.
export async function containerTurn(record, args, env) {
  const imageData = JSON.parse(completed(await docker(['image', 'inspect', image]), 'image inspection'))[0]
  const recipeHash = hashBytes(await readFile(join(root, 'tests/eval/container/Dockerfile')))
  if (!/^sha256:[a-f0-9]{64}$/.test(imageData.Id)) fail('Evaluation image has no immutable image ID.')
  if (record.execution && (record.execution.imageId !== imageData.Id || record.execution.recipeHash !== recipeHash)) fail('Evaluation container image changed during this conversation.')
  record.execution ??= { method: 'docker', image, imageId: imageData.Id, recipeHash, turns: [] }
  const name = `bstack-eval-${randomUUID()}`
  const mounts = [record.fixture.path, record.isolation.home].map(path => ({ Type: 'bind', Source: path, Destination: path, RW: true }))
  const environment = Object.entries(env).filter(([key]) => key !== 'PATH').flatMap(([key, value]) => ['--env', `${key}=${value}`])
  const user = `${process.getuid()}:${process.getgid()}`
  const options = ['--name', name, '--user', user, '--network', 'bridge', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--cpus', '2', '--memory', '4g',
    '--workdir', record.fixture.path, ...mounts.flatMap(mount => ['--mount', `type=bind,source=${mount.Source},target=${mount.Destination}`]), ...environment]
  const turn = { name, imageId: imageData.Id, mounts, user, network: 'bridge', privileged: false, publishedPorts: [], verified: false }
  record.execution.turns.push(turn)
  try {
    completed(await docker(['create', ...options, imageData.Id, record.adapter.executable, ...args]), 'creation')
    const actual = JSON.parse(completed(await docker(['inspect', name]), 'inspection'))[0]
    const observed = actual.Mounts.map(({ Type, Source, Destination, RW }) => ({ Type, Source, Destination, RW }))
    // Docker orders mounts by destination independently of their argv order.
    const byDestination = (left, right) => left.Destination.localeCompare(right.Destination)
    if (canonicalJSON(observed.sort(byDestination)) !== canonicalJSON([...mounts].sort(byDestination)) || actual.Image !== imageData.Id || actual.Config.User !== user ||
        actual.HostConfig.Privileged || actual.HostConfig.NetworkMode !== 'bridge' ||
        actual.HostConfig.NanoCpus !== 2_000_000_000 || actual.HostConfig.Memory !== 4 * 1024 ** 3 ||
        Object.keys(actual.HostConfig.PortBindings ?? {}).length || actual.HostConfig.VolumesFrom?.length ||
        actual.HostConfig.CapAdd?.length || canonicalJSON(actual.HostConfig.CapDrop) !== canonicalJSON(['ALL']) ||
        !actual.HostConfig.SecurityOpt.includes('no-new-privileges')) fail('Evaluation container configuration does not match the isolated execution contract.')
    turn.verified = true
    if (record.fixture.name.startsWith('py-') && !record.fixtureRuntime) {
      const prepared = await docker(['run', '--rm', ...options.slice(2), '--name', `${name}-prepare`, imageData.Id,
        'sh', '-c', 'mkdir -p "$XDG_CACHE_HOME" && cp -R /opt/uv-cache "$XDG_CACHE_HOME/uv" && uv sync --locked --offline --python 3.12.15'])
      completed(prepared, 'locked Python fixture preparation')
      record.fixtureRuntime = { imageId: imageData.Id, python: '3.12.15', result: prepared }
    }
    // Query the same image, with the same two mounts and environment, rather
    // than reporting the host CLI version as the agent version.
    const query = 'const {execFileSync}=require("node:child_process");const [executable,...args]=JSON.parse(process.argv[1]);' +
      'console.log(JSON.stringify({node:process.version,git:execFileSync("git",["--version"],{encoding:"utf8"}).trim(),' +
      'npm:execFileSync("npm",["--version"],{encoding:"utf8"}).trim(),agent:execFileSync(executable,args,{encoding:"utf8"}).trim()}))'
    const version = await docker(['run', '--rm', ...options.slice(2), '--name', `${name}-version`, imageData.Id,
      'node', '-e', query, JSON.stringify([record.adapter.executable, ...record.adapter.versionArgs])])
    const toolchain = JSON.parse(completed(version, 'toolchain version query'))
    if (Object.entries(toolchain).some(([key, value]) => record.tools[key] && record.tools[key] !== value)) fail('Evaluation container tool versions differ from the recorded toolchain.')
    turn.toolchain = toolchain
    record.execution.toolchain = toolchain
    const checks = record.scenario.checks.filter(check => check.machine)
    const program = checks.length ? await readFile(join(root, 'tests/eval/container/assertions.mjs'), 'utf8') : null
    async function assertions(input) {
      const path = join(record.isolation.home, 'tmp', `${name}-assertions.json`)
      const grader = join(record.isolation.home, 'tmp', `${name}-grader`)
      // Captured traces can exceed OS argument limits, so use the existing home mount.
      try {
        // Baselines also receive citation grading, after the subject has finished.
        if (input.final && checks.some(check => check.machine.type === 'citeCheck')) {
          for (const directory of ['scripts', 'schemas']) await cp(join(root, 'skills/repo-audit', directory),
            join(grader, directory), { recursive: true })
          input.skill = join(grader, 'scripts/repo-audit.mjs')
        }
        await writeFile(path, JSON.stringify({ kind: record.fixture.kind, ...input }), { mode: 0o600 })
        const result = await docker(['run', '--rm', ...options.slice(2), '--name', `${name}-assertions`, imageData.Id,
          'node', '--input-type=module', '-e', program, path])
        return JSON.parse(completed(result, 'machine assertions'))
      } finally {
        await rm(path, { force: true })
        await rm(grader, { recursive: true, force: true })
      }
    }
    if (checks.length && !record.fixtureSnapshot) record.fixtureSnapshot = await assertions({ action: 'snapshot' })
    const result = await docker(['start', '--attach', name], record.adapter.timeoutMs, record.adapter.outputLimitBytes)
    result.toolVersion = { ...version, stdout: `${toolchain.agent}\n` }
    if (checks.length && result.status === 'passed' && !result.outputTruncated) {
      const events = [...record.turns.map(turn => turn.result.stdout), result.stdout]
        .flatMap(stdout => stdout.trim().split(/\r?\n/).map(line => JSON.parse(line)))
      record.machineResults = await assertions({ action: 'evaluate', checks, before: record.fixtureSnapshot,
        events, installer: record.installer, final: record.turns.length === record.scenario.answers.length,
        skill: join(record.isolation.stagedPath, 'scripts/repo-audit.mjs') })
    }
    return result
  } finally {
    const removal = await docker(['rm', '--force', name])
    if (removal.status !== 'passed' && !/No such container/.test(removal.stderr)) completed(removal, 'cleanup')
    // The version query normally removes itself; explicit cleanup also covers
    // a client timeout. No resource is selected by a shared name or inventory.
    const versionRemoval = await docker(['rm', '--force', `${name}-version`])
    if (versionRemoval.status !== 'passed' && !/No such container/.test(versionRemoval.stderr)) completed(versionRemoval, 'version cleanup')
    const preparationRemoval = await docker(['rm', '--force', `${name}-prepare`])
    if (preparationRemoval.status !== 'passed' && !/No such container/.test(preparationRemoval.stderr)) completed(preparationRemoval, 'fixture preparation cleanup')
    const assertionRemoval = await docker(['rm', '--force', `${name}-assertions`])
    if (assertionRemoval.status !== 'passed' && !/No such container/.test(assertionRemoval.stderr)) completed(assertionRemoval, 'assertion cleanup')
    turn.removedAt = new Date().toISOString()
  }
}
