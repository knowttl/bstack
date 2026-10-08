import { cp, lstat, readFile, rm, symlink, writeFile, realpath, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { isInside } from '../lib/paths.mjs'
import { resolveTarget } from '../lib/repo.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { runCommand } from '../lib/run.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!['check-plan', 'check-id', 'valid', 'violation', 'expect'].every(key => options[key]?.trim())) {
    throw new CommandError('usage-error', [{ code: 'missing-proof-options', message: 'A proof needs a check plan, check ID, valid directory, violation directory and specific diagnostic.', fix: 'Supply --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text>.' }])
  }
  const target = await resolveTarget(options)
  const plan = inspectJSON(await readFile(options['check-plan'], 'utf8')).value
  const schema = JSON.parse(await readFile(new URL('../../schemas/check-plan.json', import.meta.url), 'utf8'))
  validateData(schema, plan)
  validateIds(plan.checks, '$/checks')
  const check = plan.checks.find(item => item.id === options['check-id'])
  if (!check || check.skipReason) throw new CommandError('failed', [{ code: 'unavailable-proof-check', message: 'Select an existing check without a skip reason.', fix: 'Review the check ID and its declared command.' }])
  const sources = await Promise.all([options.valid, options.violation].map(async path => {
    const root = await realpath(path)
    if (!(await stat(root)).isDirectory()) throw new Error(`Fixture is not a directory: ${path}`)
    return root
  }))
  if (sources[0] === sources[1]) throw new CommandError('usage-error', [{ code: 'identical-proof-fixtures', message: 'Valid and violation fixtures must differ.', fix: 'Supply a clean fixture and an independently seeded violation.' }])
  const directory = await createScratch(target)
  const cases = []
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.on('SIGINT', cancel)
  process.on('SIGTERM', cancel)
  try {
    for (const [index, kind] of ['valid', 'violation'].entries()) {
      const root = join(directory, kind)
      let execution = null
      let reason = null
      let status = 'blocked'
      try {
        await cp(sources[index], root, { recursive: true, dereference: true, filter: async (source, destination) => {
          if (!(await lstat(source)).isSymbolicLink()) return true
          const resolved = await realpath(source)
          if (!isInside(sources[index], resolved)) return true
          const copiedTarget = join(root, relative(sources[index], resolved))
          await symlink(relative(dirname(destination), copiedTarget), destination, (await stat(resolved)).isDirectory() ? 'dir' : 'file')
          return false
        } })
        execution = await runCommand({ root }, check.command, { signal: controller.signal })
        const normal = execution.toolVersion.status === 'passed' && execution.exitCode !== null && !execution.error &&
          !execution.signal && !execution.timedOut && !execution.cancelled
        const diagnostic = `${execution.stdout}\n${execution.stderr}`.includes(options.expect)
        status = !normal ? 'blocked' : kind === 'valid' ? execution.exitCode === 0 ? 'passed' : 'blocked'
          : execution.exitCode !== 0 && diagnostic ? 'passed' : 'failed'
        reason = status === 'passed' ? null : execution.error ?? (kind === 'valid' ? 'Clean control or tool setup did not pass.' : 'Violation did not fail with the expected diagnostic.')
      } catch (error) { reason = error.message }
      finally { await rm(root, { recursive: true, force: true }) }
      cases.push({ kind, source: sources[index], status, reason, execution })
      // A failed clean control cannot establish enforcement, regardless of violation output.
      if (status === 'blocked') break
    }
  } finally {
    process.removeListener('SIGINT', cancel)
    process.removeListener('SIGTERM', cancel)
  }
  const status = cases.some(item => item.status === 'blocked') ? 'blocked' : cases.every(item => item.status === 'passed') ? 'passed' : 'failed'
  const path = join(directory, 'proof.json')
  const data = { checkId: check.id, command: check.command, expectedDiagnostic: options.expect, status, cases, path,
    limitations: ['Proof covers only the supplied fixtures and the selected tool diagnostic. It does not establish unsupported syntax or dynamic dependencies.'] }
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
  return { status, data, problems: cases.filter(item => item.status !== 'passed').map(item => ({ code: 'rule-proof-' + item.status, message: `${item.kind}: ${item.reason}`, fix: 'Restore native tool setup or correct the rule and fixture, then rerun proof.' })) }
}
