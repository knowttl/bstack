import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join, posix } from 'node:path'
import { validateData } from './schema.mjs'
import { inspectJSON } from './json.mjs'
import { CommandError } from './result.mjs'
import { pathGlob } from './glob.mjs'
import { bullets, commandLines, link } from './render.mjs'
import schema from '../../schemas/kit-plan.json' with { type: 'json' }

// Every generated file other than helpers lives at one of these kit-relative paths.
const gatePath = posix.join('scripts', 'map-coverage.mjs')
const reservedPaths = ['SKILL.md', 'kit.json', 'features/README.md']
// Launch waits at most this long for readiness unless the plan declares another limit.
const defaultReadySeconds = 30
// Generated text is the contract between the plan and the next agent, so its wording lives here once.
const entryContract = [
  'Each feature file starts with an H1 title and one paragraph describing the user-visible behavior.',
  'A `Source paths:` line then lists the repo paths that implement the feature, as backticked paths or `**` globs; change-impact checks read it.',
  'Exactly four H2 sections follow, in this order.',
  '',
  '1. `Sub-features` lists short IDs with one line for each behavior.',
  '2. `How to get to it (user POV)` lists every user entry point.',
  '3. `Driving it with <harness>` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.',
  '4. `Gotchas` lists traps that can waste or invalidate a verification run.'
]

function invalid(code, message, path) {
  throw new CommandError('failed', [{ code, message, path, fix: 'Correct the kit plan and run kit scaffold again.' }])
}

function relativePath(value, path) {
  if (isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes('\0') || value.split(/[\\/]/).includes('..')) {
    invalid('unsafe-path', `Expected a repo-relative path without parent traversal: ${value}`, path)
  }
}

export function kitDirectory(app) {
  return `.agents/skills/verify-${app}`
}

export function validateKitPlan(plan, { forUpdate = false } = {}) {
  validateData(schema, plan)
  const { launch, evidence, helpers, features } = plan
  if (Object.keys(launch.ready).length !== 1 || !(launch.ready.url ?? launch.ready.output)) invalid('invalid-ready', 'Declare exactly one of ready.url or ready.output.', '$/launch/ready')
  if (launch.ready.output) {
    try { new RegExp(launch.ready.output) } catch { invalid('invalid-ready', `ready.output is not a valid pattern: ${launch.ready.output}`, '$/launch/ready/output') }
  }
  if (launch.timeoutSeconds !== undefined && !(launch.timeoutSeconds >= 1 && launch.timeoutSeconds <= 600)) invalid('invalid-timeout', 'timeoutSeconds must be between 1 and 600.', '$/launch/timeoutSeconds')
  relativePath(evidence.directory, '$/evidence/directory')
  const kit = kitDirectory(plan.app)
  const evidenceDirectory = posix.normalize(evidence.directory)
  if (evidenceDirectory === kit || evidenceDirectory.startsWith(`${kit}/`)) invalid('evidence-inside-kit', 'Evidence must not live inside the committed kit directory.', '$/evidence/directory')
  const commands = [['launch', launch], ['doctor', plan.doctor], ['cleanup', plan.cleanup], ...features.flatMap(feature => feature.steps.map((step, index) => [`features/${feature.id}/steps/${index}`, step]))]
  for (const [path, command] of commands) if (command.cwd !== undefined) relativePath(command.cwd, `$/${path}/cwd`)
  const helperPaths = new Set()
  for (const [index, helper] of helpers.entries()) {
    relativePath(helper.path, `$/helpers/${index}/path`)
    const normalized = posix.normalize(helper.path)
    if (reservedPaths.includes(normalized) || normalized.startsWith('features/') || helperPaths.has(normalized) || (plan.coverageGate && normalized === gatePath)) invalid('helper-collision', `Helper path collides with another kit file: ${helper.path}`, `$/helpers/${index}/path`)
    helperPaths.add(normalized)
  }
  const ids = new Set()
  for (const [index, feature] of features.entries()) {
    if (ids.has(feature.id)) invalid('duplicate-feature', `Duplicate feature ID: ${feature.id}`, `$/features/${index}/id`)
    ids.add(feature.id)
    if (!forUpdate) {
      for (const field of ['title', 'summary']) {
        if (/[\r\n]/u.test(feature[field]) || (field === 'summary' && feature[field].startsWith('Source paths:'))) invalid('invalid-feature-metadata', `Feature ${field} must be one line and cannot shadow the source declaration.`, `$/features/${index}/${field}`)
      }
    }
    for (const path of feature.sourcePaths) {
      if (forUpdate) relativePath(path, `$/features/${index}/sourcePaths`)
      else {
        if (/[`\r\n]/u.test(path)) invalid('invalid-source-path', 'Source paths cannot contain backticks or line breaks.', `$/features/${index}/sourcePaths`)
        pathGlob(path)
      }
    }
    for (const step of feature.steps) {
      for (const artifact of step.artifacts ?? []) {
        relativePath(artifact, `$/features/${index}/steps`)
        const normalized = posix.normalize(artifact.replaceAll('\\', '/'))
        if (!normalized.startsWith('{evidenceDir}/')) invalid('artifact-outside-evidence', `Captured artifacts must be inside {evidenceDir}: ${artifact}`, `$/features/${index}/steps`)
        if (normalized === `{evidenceDir}/${feature.id}.json`) invalid('evidence-collision', `Artifact path is reserved for the proof record: ${artifact}`, `$/features/${index}/steps`)
      }
      try { new RegExp(step.match) } catch { invalid('invalid-match', `Step match is not a valid pattern: ${step.match}`, `$/features/${index}/steps`) }
    }
  }
  return plan
}

export async function readKitPlan(root, app, options) {
  let plan
  try { plan = inspectJSON(await readFile(join(root, kitDirectory(app), 'kit.json'), 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('blocked', [{ code: 'kit-unavailable', message: `No readable kit at ${kitDirectory(app)}/kit.json.`, fix: 'Apply the scaffolded kit first.' }])
  }
  validateKitPlan(plan, options)
  if (plan.app !== app) throw new CommandError('failed', [{ code: 'kit-app-mismatch', path: `${kitDirectory(app)}/kit.json`, message: `Requested kit ${app} contains a plan for ${plan.app}.`, fix: `Restore kit.json for ${app} before checking, proving or updating this kit.` }])
  return plan
}

export function readySeconds(plan) {
  return plan.launch.timeoutSeconds ?? defaultReadySeconds
}

function documentedHelpers(plan) {
  const gate = { path: gatePath, purpose: 'Fail when a change touches a feature\'s source paths without updating its feature file or recording a no-impact reason.',
    invocation: `node ${kitDirectory(plan.app)}/${gatePath} --base origin/<default branch>` }
  return plan.coverageGate ? [...plan.helpers, gate] : plan.helpers
}

function skillDocument(plan) {
  const { app, launch, doctor, drive, evidence, cleanup, features } = plan
  const helpers = documentedHelpers(plan)
  const ready = launch.ready.url ? `a request to \`${launch.ready.url}\` succeeds` : `output matching \`${launch.ready.output}\` appears`
  return [
    '---', `name: verify-${app}`, `description: ${JSON.stringify(plan.description)}`, '---', '',
    `# Verify ${app}`, '',
    `Drive the real ${app} the way a user does: ${plan.surface}.`,
    `Commands here mirror ${link('kit.json', 'kit.json')}, which holds the same commands in machine form.`,
    'In any command, `{port}` is a free port, `{runDir}` a disposable directory and `{evidenceDir}` the evidence subdirectory, each chosen for the run.',
    `Read the ${link('feature map', 'features/README.md')} first, then follow the matching feature file.`, '',
    '## Launch', '',
    ...commandLines('Command', launch), `Ready when ${ready}. ${launch.readiness}`, `Isolation: ${plan.isolation}`, `Teardown: ${launch.teardown}`, '',
    '## Doctor', '',
    ...commandLines('Command', doctor), `Read-only. ${doctor.asserts}`, 'Run it first, and again after any failed drive.', '',
    '## Drive', '',
    `Harness: ${drive.harness}.`, '', ...bullets(drive.conventions), '',
    ...features.map(feature => `- ${link(feature.title, `features/${feature.id}.md`)}`), '',
    '## Evidence', '',
    `Directory: \`${evidence.directory}\`.`, '', ...bullets(evidence.standards), '',
    '## Cleanup', '',
    ...(cleanup.command ? [...commandLines('Command', cleanup), ''] : []),
    ...bullets(cleanup.notes), 'Cleanup removes what the run started and never the evidence directory.', '',
    '## Helpers', '',
    ...(helpers.length ? helpers.flatMap(helper => [`- \`${helper.path}\`: ${helper.purpose} Run \`${helper.invocation}\`.`]) : ['None.']), ''
  ].join('\n')
}

function featureDocument(plan, feature) {
  return [
    `# ${feature.title}`, '', feature.summary, '',
    `Source paths: ${feature.sourcePaths.map(path => `\`${path}\``).join(', ')}`, '',
    '## Sub-features', '', ...feature.subFeatures.map(item => `- \`${item.id}\` ${item.description}`), '',
    '## How to get to it (user POV)', '', ...bullets(feature.entryPoints), '',
    `## Driving it with ${plan.drive.harness}`, '', 'Preconditions:', '', ...bullets(feature.preconditions), '',
    ...feature.steps.flatMap(step => [
      `- **${step.label}.** ${step.expect}`,
      ...commandLines('Run', step).map(line => `  ${line}`),
      ...(step.artifacts?.length ? [`  Required artifacts: ${step.artifacts.map(path => `\`${path}\``).join(', ')}.`] : [])
    ]), '',
    '## Gotchas', '', ...(feature.gotchas.length ? bullets(feature.gotchas) : ['- None recorded.']), ''
  ].join('\n')
}

function indexDocument(plan) {
  return [
    `# ${plan.app} verification map`, '',
    `This directory is the maintained source for verifying the user-facing behavior of ${plan.app}.`,
    'Read the index before driving the app, then use the matching feature file as the recipe.', '',
    '## Baseline preconditions', '', ...(plan.baseline.length ? bullets(plan.baseline) : ['- None beyond the launch command.']), '',
    '## Driving conventions', '', ...bullets(plan.drive.conventions), '',
    '## Proof and skip reporting', '', ...bullets(plan.evidence.standards),
    '- Report an unreachable path with the attempted command and the unmet precondition.',
    '- Do not report a skipped entry point as verified through a different path.', '',
    '## Feature entry contract', '', ...entryContract, '',
    '## Features', '', ...plan.features.map(feature => `- ${link(feature.title, `./${feature.id}.md`)} ${feature.summary}`), ''
  ].join('\n')
}

export function pointerDocument(plan) {
  return ['---', `name: verify-${plan.app}`, `description: ${JSON.stringify(plan.description)}`, '---', '',
    `Use the verification kit in ${link(kitDirectory(plan.app), `../../../${kitDirectory(plan.app)}/SKILL.md`)}.`, ''].join('\n')
}

export function agentsPointer(plan) {
  return `Verify changes on the real product with the kit in ${link(kitDirectory(plan.app), `${kitDirectory(plan.app)}/SKILL.md`)}.`
}

export function kitFiles(plan) {
  const kit = kitDirectory(plan.app)
  return [
    { path: `${kit}/SKILL.md`, content: skillDocument(plan) },
    { path: `${kit}/kit.json`, content: `${JSON.stringify(plan, null, 2)}\n` },
    { path: `${kit}/features/README.md`, content: indexDocument(plan) },
    ...plan.features.map(feature => ({ path: `${kit}/features/${feature.id}.md`, content: featureDocument(plan, feature) })),
    ...plan.helpers.map(helper => ({ path: `${kit}/${posix.normalize(helper.path)}`, content: helper.content })),
    ...(plan.coverageGate ? [{ path: `${kit}/${gatePath}`, content: readFileSync(new URL('../../assets/map-coverage.mjs', import.meta.url), 'utf8') }] : [])
  ]
}

export function managedFiles(plan) {
  return [...kitFiles(plan), { path: `.claude/skills/verify-${plan.app}/SKILL.md`, content: pointerDocument(plan) }]
}
