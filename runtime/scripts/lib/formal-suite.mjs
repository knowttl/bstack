import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isAbsolute, posix } from 'node:path'
import { validateData } from './schema.mjs'
import { inspectJSON } from './json.mjs'
import { CommandError } from './result.mjs'
import { matchesPath, pathGlob } from './glob.mjs'
import { resolveFilePath } from './paths.mjs'
import { bullets, commandLines, link } from './render.mjs'
import schema from '../../schemas/formal-plan.json' with { type: 'json' }

// Every suite file other than model files lives at one of these suite-relative paths.
const gatePath = posix.join('scripts', 'map-coverage.mjs')
// The suite plan is the one source for every rendered file, so its name is fixed.
const planPath = 'suite.json'
// Generated text is the contract between the plan and the next agent, so its wording lives here once.
const honestLimits = [
  'A pass covers the model within its bounds, not the whole system.',
  'No tool connects a model to the code, so the model stays true only through the coverage gate and review.',
  'The coverage gate notices changes to the declared source paths only.',
  'Atomicity assumptions are trusted from documentation and not verified.',
  'A missing tool or runtime means unproven, never a pass.'
]

function invalid(code, message, path) {
  throw new CommandError('failed', [{ code, message, path, fix: 'Correct the suite plan and run formal scaffold again.' }])
}

function relativePath(value, path) {
  if (isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes('\0') || value.split(/[\\/]/).includes('..')) {
    invalid('unsafe-path', `Expected a repo-relative path without parent traversal: ${value}`, path)
  }
}

export function suiteDirectory(target) {
  return `.agents/skills/formal-${target}`
}

export function modelPath(suite, name) {
  return `${suite}/model/${name}`
}

function splitLocation(location) {
  const [, path, line] = location.match(/^(.*):([1-9][0-9]*)$/u)
  return { path, line: Number(line) }
}

export function validateFormalPlan(plan) {
  validateData(schema, plan)
  const suite = suiteDirectory(plan.target)
  relativePath(plan.tool.path, '$/tool/path')
  relativePath(plan.evidenceDirectory, '$/evidenceDirectory')
  const evidence = posix.normalize(plan.evidenceDirectory)
  if (evidence === suite || evidence.startsWith(`${suite}/`)) invalid('evidence-inside-suite', 'Evidence must not live inside the committed suite directory.', '$/evidenceDirectory')
  const ids = new Set()
  const modelNames = new Set()
  for (const [index, property] of plan.properties.entries()) {
    const at = `$/properties/${index}`
    if (ids.has(property.id)) invalid('duplicate-property', `Duplicate property ID: ${property.id}`, `${at}/id`)
    ids.add(property.id)
    for (const field of ['title', 'statement', 'harm']) {
      if (/[\r\n]/u.test(property[field])) invalid('invalid-property-metadata', `Property ${field} must be one line.`, `${at}/${field}`)
    }
    relativePath(splitLocation(property.design.location).path, `${at}/design/location`)
    if (property.check.cwd !== undefined) relativePath(property.check.cwd, `${at}/check/cwd`)
    const globs = property.sourcePaths.map(path => {
      if (/[`\r\n]/u.test(path)) invalid('invalid-source-path', 'Source paths cannot contain backticks or line breaks.', `${at}/sourcePaths`)
      return pathGlob(path)
    })
    for (const file of property.modelFiles) {
      const name = modelPath(suite, file.name)
      if (modelNames.has(name)) invalid('duplicate-model-file', `Model file ${file.name} is used by more than one entry.`, `${at}/modelFiles`)
      modelNames.add(name)
      // TLC reads the module named by its file, so a mismatch fails at run time with a message that hides the cause.
      if (file.name.endsWith('.tla') && !new RegExp(`^-{4,} MODULE ${file.name.slice(0, -4)} -{4,}\\s*$`, 'mu').test(file.content)) {
        invalid('module-name-mismatch', `${file.name} has no module header naming ${file.name.slice(0, -4)}.`, `${at}/modelFiles`)
      }
    }
    for (const step of property.steps) {
      const { path } = splitLocation(step.code)
      relativePath(path, `${at}/steps`)
      if (!path.split('/').some((_, index, parts) => globs.some(glob => matchesPath(glob, parts.slice(0, index + 1).join('/'))))) {
        invalid('step-outside-source-paths', `Step ${step.action} cites ${step.code}, which no declared source path of ${property.id} covers.`, `${at}/steps`)
      }
    }
  }
  return plan
}

export async function readFormalPlan(root, target) {
  const suite = suiteDirectory(target)
  let plan
  try { plan = inspectJSON(await readFile(await resolveFilePath(root, `${suite}/${planPath}`), 'utf8')).value } catch (error) {
    if (error instanceof CommandError) throw error
    throw new CommandError('blocked', [{ code: 'suite-unavailable', message: `No readable suite at ${suite}/${planPath}.`, fix: 'Apply the scaffolded suite first.' }])
  }
  validateFormalPlan(plan)
  if (plan.target !== target) throw new CommandError('failed', [{ code: 'suite-target-mismatch', path: `${suite}/${planPath}`, message: `Requested suite ${target} contains a plan for ${plan.target}.`, fix: `Restore suite.json for ${target} before checking or updating this suite.` }])
  return plan
}

// A step names a line that must still exist, so a deleted or truncated file is reported before a reader trusts the table.
export async function stepProblems(root, plan) {
  const problems = []
  for (const property of plan.properties) {
    for (const step of property.steps) {
      const { path, line } = splitLocation(step.code)
      let text = null
      try { text = await readFile(await resolveFilePath(root, path), 'utf8') } catch (error) {
        if (error instanceof CommandError) throw error
        if (error.code !== 'ENOENT') throw error
      }
      const lines = text === null ? 0 : text.split(/\r\n|\r|\n/u).length - (/[\r\n]$/u.test(text) ? 1 : 0)
      if (line > lines) {
        problems.push({ code: 'step-code-missing', path: `${suiteDirectory(plan.target)}/properties/${property.id}.md`,
          message: `Step ${step.action} of ${property.id} cites ${step.code}, but ${text === null ? 'the file does not exist' : `the file has ${lines} lines`}.`,
          fix: 'Find the code step the model step stands for, correct its citation in the suite plan with formal scaffold --update, and check the model still matches it.' })
      }
    }
  }
  return problems
}

// Backticks mark every path, command and diagnostic so a reader and the gate parse the same spans.
const code = text => `\`${text}\``

function tableRows(property) {
  return property.steps.map(step => `| ${code(step.action)} | ${code(step.code)} | ${step.atomicBecause} |`)
}

// The table is rendered under its own heading so formal check can compare it apart from the rest of the file.
export const tableHeading = '## Transition table'

export function propertyDocument(property) {
  return [
    `# ${property.title}`, '', property.statement, '',
    `Harm: ${property.harm}`,
    `Source paths: ${property.sourcePaths.map(code).join(', ')}`,
    `Design: ${code(property.design.location)}`,
    `Model files: ${property.modelFiles.map(file => code(`model/${file.name}`)).join(', ')}`,
    `Violation diagnostic: ${code(property.check.violation)}`, '',
    '## Check', '', ...commandLines('Command', property.check), '',
    '## Bounds', '', ...bullets(property.bounds), '',
    '## Assumptions', '', ...(property.assumptions.length ? bullets(property.assumptions) : ['- None recorded.']), '',
    tableHeading, '',
    'Each row is one action of the model, standing for one atomic step of the code.',
    `Change a row and its model action together with the code at ${property.sourcePaths.map(code).join(', ')}.`, '',
    '| Model step | Code step | Atomic because |', '|---|---|---|', ...tableRows(property), ''
  ].join('\n')
}

function skillDocument(plan) {
  const suite = suiteDirectory(plan.target)
  const { tool } = plan
  return [
    '---', `name: formal-${plan.target}`, `description: ${JSON.stringify(plan.description)}`, '---', '',
    `# Formal verification of ${plan.target}`, '',
    `${plan.description}`,
    `Each property below is checked by a model that stands for the code at its source paths, and its property file lists the exact code steps the model assumes are atomic.`,
    `Read a property file before changing code at its source paths.`,
    `Commands here mirror ${link('suite.json', 'suite.json')}, which holds the same commands in machine form.`, '',
    '## Properties', '',
    ...plan.properties.map(property => `- ${link(property.title, `properties/${property.id}.md`)} ${property.statement}`), '',
    '## Tool', '',
    `Tool: ${tool.name} ${tool.version}, pinned at ${code(tool.path)} with sha256 ${code(tool.sha256)}.`,
    `Confirm it before every run with \`sha256sum ${tool.path}\`; a missing file or a different hash means the property is unproven.`,
    'The project owns the tool: this suite installs, fetches and commits nothing.', '',
    '## Run', '',
    ...plan.properties.flatMap(property => [`${link(property.title, `properties/${property.id}.md`)}:`, '', ...commandLines('Command', property.check), '']),
    `Evidence and the tool's working files go to ${code(plan.evidenceDirectory)}, never into this suite.`,
    'Read the output in this order.',
    '',
    ...bullets([
      'The property\'s violation diagnostic with a nonzero exit is a finding: report it with the counterexample and never weaken the property to obtain a pass.',
      'Any other nonzero exit is a modeling error or a harness problem: correct the model or the setup, and never report it as a finding.',
      'Exit 0 means the property holds within its bounds and assumptions, which is a bounded result.'
    ]), '',
    '## Keep the model true', '',
    'When a change touches a property\'s source paths, reread that property\'s transition table against the new code.',
    'Update the model files and the table together, then rerun the check; the check cannot see a code change on its own.',
    `The coverage gate fails until a model file of the property changes or a commit message carries \`No-proof-impact: <id>: <reason>\`.`,
    `Run \`node ${suite}/${gatePath} --base origin/<default branch>\`.`, '',
    '## Limits', '', ...bullets(honestLimits), ''
  ].join('\n')
}

export function pointerDocument(plan) {
  return ['---', `name: formal-${plan.target}`, `description: ${JSON.stringify(plan.description)}`, '---', '',
    `Use the formal verification suite in ${link(suiteDirectory(plan.target), `../../../${suiteDirectory(plan.target)}/SKILL.md`)}.`, ''].join('\n')
}

export function agentsPointer(plan) {
  return `Check the model of ${plan.target} against the code with the suite in ${link(suiteDirectory(plan.target), `${suiteDirectory(plan.target)}/SKILL.md`)} before changing its source paths.`
}

export function suiteFiles(plan) {
  const suite = suiteDirectory(plan.target)
  return [
    { path: `${suite}/SKILL.md`, content: skillDocument(plan) },
    { path: `${suite}/${planPath}`, content: `${JSON.stringify(plan, null, 2)}\n` },
    ...plan.properties.map(property => ({ path: `${suite}/properties/${property.id}.md`, content: propertyDocument(property) })),
    ...plan.properties.flatMap(property => property.modelFiles.map(file => ({ path: modelPath(suite, file.name), content: file.content }))),
    { path: `${suite}/${gatePath}`, content: readFileSync(new URL('../../assets/map-coverage.mjs', import.meta.url), 'utf8') }
  ]
}

export function managedFiles(plan) {
  return [...suiteFiles(plan), { path: `.claude/skills/formal-${plan.target}/SKILL.md`, content: pointerDocument(plan) }]
}
