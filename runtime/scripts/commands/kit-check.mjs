import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath } from '../lib/paths.mjs'
import { repoFiles } from '../lib/discovery.mjs'
import { matchesPath, pathGlob } from '../lib/glob.mjs'
import { CommandError } from '../lib/result.mjs'
import { agentsPointer, kitDirectory, managedFiles, readKitPlan } from '../lib/kit.mjs'

const repair = 'If the product changed, edit the kit plan and run kit scaffold --update; if the file was edited by hand, restore it the same way, then re-drive the feature with kit prove.'

async function readIfPresent(root, path) {
  return readFile(await resolveFilePath(root, path), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
}

function firstDifference(expected, actual) {
  const wanted = expected.split('\n')
  const found = actual.split('\n')
  return wanted.findIndex((line, index) => line !== found[index]) + 1 || wanted.length + 1
}

export async function run(options) {
  if (!options.app) throw new CommandError('usage-error', [{ code: 'missing-option', message: '--app is required.', fix: 'Supply --app <name>.' }])
  const target = await resolveTarget(options)
  const plan = await readKitPlan(target.root, options.app)
  const kit = kitDirectory(plan.app)
  const problems = []
  const managed = managedFiles(plan)
  for (const file of managed) {
    const actual = await readIfPresent(target.root, file.path)
    if (actual === null) problems.push({ code: 'file-missing', path: file.path, message: `${file.path} is missing from the applied kit.`, fix: repair })
    else if (actual !== file.content) {
      problems.push({ code: 'file-drift', path: file.path, message: `${file.path} differs from what kit.json renders, first at line ${firstDifference(file.content, actual)}.`, fix: repair })
    }
  }
  const known = new Set(managed.map(file => file.path))
  const listed = await readdir(join(target.root, kit, 'features')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  for (const name of listed.sort()) {
    if (!known.has(`${kit}/features/${name}`)) problems.push({ code: 'orphan-feature-file', path: `${kit}/features/${name}`, message: `${kit}/features/${name} describes no feature in kit.json.`, fix: repair })
  }
  const agents = await readIfPresent(target.root, 'AGENTS.md')
  if (!agents?.split(/\r?\n/).includes(agentsPointer(plan))) {
    problems.push({ code: 'pointer-missing', path: 'AGENTS.md', message: 'AGENTS.md lacks the line pointing agents at the kit.', fix: repair })
  }
  const files = await repoFiles(target.root)
  for (const feature of plan.features) {
    for (const path of feature.sourcePaths) {
      const glob = pathGlob(path)
      const present = files.some(file => file.split('/').some((_, index, parts) => matchesPath(glob, parts.slice(0, index + 1).join('/'))))
      if (!present) {
        problems.push({ code: 'source-path-missing', path: `${kit}/features/${feature.id}.md`, message: `Source path ${path} of feature ${feature.id} matches no file in the repo.`,
          fix: 'Find where the feature moved and correct its source paths in the kit plan with kit scaffold --update, or remove the feature if it no longer exists.' })
      }
    }
  }
  if (problems.length) throw new CommandError('failed', problems)
  return { inputs: { target, app: plan.app }, data: { app: plan.app, features: plan.features.map(feature => feature.id), files: managed.length } }
}
