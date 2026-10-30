import { mkdir, mkdtemp, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run as check } from './formal-check.mjs'
import { modelPath, readFormalPlan, suiteDirectory } from '../lib/formal-suite.mjs'
import { isInside, resolveFilePath, resolvePath } from '../lib/paths.mjs'
import { CommandError } from '../lib/result.mjs'
import { runCommand } from '../lib/run.mjs'

export async function run(options) {
  if (!options.property) throw new CommandError('usage-error', [{ code: 'missing-option', message: '--property is required.', fix: 'Supply --property <id> from the suite.' }])
  const checked = await check(options)
  const target = checked.inputs.target
  const plan = await readFormalPlan(target.root, options.suite)
  const property = plan.properties.find(item => item.id === options.property)
  if (!property) throw new CommandError('usage-error', [{ code: 'property-unknown', message: `Unknown property ${options.property}.`, fix: `Choose one of: ${plan.properties.map(item => item.id).join(', ')}.` }])
  const cwd = await resolvePath(target.root, property.check.cwd ?? '.')
  const command = property.check.command
  const specs = command.filter(arg => arg.endsWith('.tla'))
  const configIndex = command.indexOf('-config')
  const config = command[configIndex + 1]
  const models = property.modelFiles.map(file => resolve(target.root, modelPath(suiteDirectory(plan.target), file.name)))
  if (!command.includes('tlc2.TLC') || specs.length !== 1 || configIndex < 0 || !config?.endsWith('.cfg')
    || ![specs[0], config].every(path => models.includes(resolve(cwd, path)))) {
    throw new CommandError('blocked', [{ code: 'chart-recipe-unsupported', message: 'Charting needs a direct Java TLC check with one suite .tla file and an explicit -config suite .cfg file.',
      fix: 'Use the documented TLA+ TLC recipe in the reviewed suite plan; Kani and wrapper commands have no chart recipe.' }])
  }
  const suite = await resolvePath(target.root, suiteDirectory(plan.target))
  const view = options.view ? await realpath(resolve(options.view)) : null
  if (view && isInside(suite, view)) throw new CommandError('usage-error', [{ code: 'view-inside-suite', message: 'The view module must stay outside the maintained suite.', fix: 'Keep the view in scratch or evidence and pass its path with --view.' }])
  const evidence = await resolvePath(target.root, plan.evidenceDirectory)
  await mkdir(evidence, { recursive: true })
  const out = await mkdtemp(join(evidence, `chart-${property.id}-`))
  const java = isAbsolute(command[0]) || !/[\\/]/.test(command[0]) ? command[0] : resolve(cwd, command[0])
  const execution = await runCommand(target, {
    executable: process.execPath,
    args: [fileURLToPath(new URL('../../scripts/statechart/statechart.ts', import.meta.url)), resolve(cwd, specs[0]), '--config', resolve(cwd, config), '--out', out,
      ...(view ? ['--view', view] : [])],
    cwd: relative(target.root, cwd) || '.', versionArgs: ['--version'], timeoutMs: 300000
  }, { env: { ...process.env, TLA2TOOLS: await resolveFilePath(target.root, plan.tool.path), JAVA: java } })
  if (execution.error || execution.timedOut || execution.cancelled || ![0, 1].includes(execution.exitCode)) {
    throw new CommandError('blocked', [{ code: 'chart-unproven', message: 'The chart run did not complete, so the property is unproven.', fix: 'Read the local execution diagnostics, repair the Java or model harness and rerun formal chart.' }], { path: out, execution })
  }
  const chart = await readFile(join(out, 'chart.mmd'), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
  return { status: execution.exitCode === 1 ? 'failed' : 'passed', inputs: checked.inputs,
    data: { path: out, report: join(out, 'report.md'), chart: chart === null ? null : join(out, 'chart.mmd'),
      outcome: execution.exitCode === 1 ? 'A model rule breaks; replay the report path against the transition table and real code.' : 'The checked model rules hold within their bounds.',
      diff: chart === null ? 'No chart: a large passing model exceeds the chart budget. Read report.md.' : `\u0060\u0060\u0060mermaid\n${chart}\u0060\u0060\u0060`, execution } }
}
