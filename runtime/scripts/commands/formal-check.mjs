import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { repoFiles } from '../lib/discovery.mjs'
import { matchesPath, pathGlob } from '../lib/glob.mjs'
import { fileCitationProblems } from '../lib/citations.mjs'
import { hashBytes } from '../lib/fingerprint.mjs'
import { CommandError } from '../lib/result.mjs'
import { agentsPointer, managedFiles, readFormalPlan, stepProblems, suiteDirectory, tableHeading } from '../lib/formal-suite.mjs'

const repair = 'If the code changed, update the model and the suite plan and run formal scaffold --update; if a file was edited by hand, restore it the same way, then rerun every property check.'

async function readIfPresent(root, path) {
  return readFile(await resolveFilePath(root, path), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
}

function firstDifference(expected, actual) {
  const wanted = expected.split('\n')
  const found = actual.split('\n')
  return wanted.findIndex((line, index) => line !== found[index]) + 1 || wanted.length + 1
}

function tableOf(text) {
  const start = text.indexOf(`${tableHeading}\n`)
  return start < 0 ? '' : text.slice(start)
}

function managedProblems(files, actual, plan, suite) {
  const problems = []
  const properties = new Map(plan.properties.map(property => [`${suite}/properties/${property.id}.md`, property]))
  for (const file of files) {
    const text = actual.get(file.path)
    if (text === null) {
      problems.push({ code: 'file-missing', path: file.path, message: `${file.path} is missing from the applied suite.`, fix: repair })
    } else if (properties.has(file.path) && !text.split(/\r?\n/).some(line => line.startsWith('Source paths:'))) {
      problems.push({ code: 'source-paths-missing', path: file.path, message: `${file.path} has no "Source paths:" line, so the coverage gate cannot tell when its code changes.`, fix: repair })
    } else if (properties.has(file.path) && tableOf(text) !== tableOf(file.content)) {
      problems.push({ code: 'table-drift', path: file.path, message: `The transition table of ${file.path} differs from what suite.json renders, first at line ${firstDifference(tableOf(file.content), tableOf(text))} of the table.`, fix: repair })
    } else if (text !== file.content) {
      problems.push({ code: 'file-drift', path: file.path, message: `${file.path} differs from what suite.json renders, first at line ${firstDifference(file.content, text)}.`, fix: repair })
    }
  }
  return problems
}

export async function run(options) {
  if (!options.suite) throw new CommandError('usage-error', [{ code: 'missing-option', message: '--suite is required.', fix: 'Supply --suite <name>.' }])
  const target = await resolveTarget(options)
  const plan = await readFormalPlan(target.root, options.suite)
  const suite = suiteDirectory(plan.target)
  const managed = managedFiles(plan)
  const actual = new Map(await Promise.all(managed.map(async file => [file.path, await readIfPresent(target.root, file.path)])))
  const problems = managedProblems(managed, actual, plan, suite)
  const known = new Set(managed.map(file => file.path))
  for (const folder of ['properties', 'model']) {
    const listed = await readdir(join(target.root, suite, folder)).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
    for (const name of listed.sort()) {
      if (!known.has(`${suite}/${folder}/${name}`)) problems.push({ code: `orphan-${folder === 'model' ? 'model' : 'property'}-file`, path: `${suite}/${folder}/${name}`, message: `${suite}/${folder}/${name} belongs to no property in suite.json.`, fix: repair })
    }
  }
  const agents = await readIfPresent(target.root, 'AGENTS.md')
  if (!agents?.split(/\r?\n/).includes(agentsPointer(plan))) {
    problems.push({ code: 'pointer-missing', path: 'AGENTS.md', message: 'AGENTS.md lacks the line pointing agents at the suite.', fix: repair })
  }
  const files = await repoFiles(target.root)
  for (const property of plan.properties) {
    const propertyFile = `${suite}/properties/${property.id}.md`
    for (const path of property.sourcePaths) {
      const glob = pathGlob(path)
      if (!files.some(file => file.split('/').some((_, index, parts) => matchesPath(glob, parts.slice(0, index + 1).join('/'))))) {
        problems.push({ code: 'source-path-missing', path: propertyFile, message: `Source path ${path} of property ${property.id} matches no file in the repo.`,
          fix: 'Find where the code moved and correct its source paths in the suite plan with formal scaffold --update, or remove the property if it no longer exists.' })
      }
    }
    for (const problem of await fileCitationProblems(target.root, property.design)) {
      problems.push({ ...problem, code: `design-${problem.code}`, path: propertyFile, message: `Design citation ${property.design.location} of property ${property.id}: ${problem.message}`,
        fix: 'Reread the design section the property guards, confirm the property still states it, then correct the citation in the suite plan with formal scaffold --update.' })
    }
  }
  problems.push(...await stepProblems(target.root, plan))
  const pinned = plan.tool
  const bytes = await readFile(await resolveFilePath(target.root, pinned.path)).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
  if (bytes !== null && hashBytes(bytes) !== pinned.sha256) {
    problems.push({ code: 'tool-hash-mismatch', path: pinned.path, message: `${pinned.path} has sha256 ${hashBytes(bytes)}, not the pinned ${pinned.sha256}.`,
      fix: `Restore the pinned ${pinned.name} ${pinned.version} file, or review and repin it in the suite plan with formal scaffold --update.` })
  }
  if (problems.length) throw new CommandError('failed', problems)
  if (bytes === null) {
    throw new CommandError('blocked', [{ code: 'tool-missing', path: pinned.path, message: `${pinned.path} is missing, so every property of ${plan.target} is unproven, not passing.`,
      fix: `Put the pinned ${pinned.name} ${pinned.version} file with sha256 ${pinned.sha256} at ${pinned.path} and run formal check again.` }])
  }
  return { inputs: { target, name: plan.target }, data: { target: plan.target, properties: plan.properties.map(property => property.id), files: managed.length, tool: { path: pinned.path, sha256: pinned.sha256 } } }
}
